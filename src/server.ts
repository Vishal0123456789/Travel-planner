
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();

import { ConversationContext, canEnterPlanning } from './types/state';
import { UDAIPUR_POIS } from './mocks/udaipur_sample';
import { generateItinerary } from './mcp/itineraryBuilder';
import { runEvaluations } from './evals/index';
import { handleEditRequest } from './controller/editFlow';
import { classifyIntent, extractConstraints, generateExplanation } from './llm/integration';
import { Itinerary } from './types/itinerary';
import { getRagForItinerary } from './rag/guards';
import { ragService } from './rag/service';
import { recalculateDaySchedule } from './utils/itineraryHelper';

// --- In-Memory Session Store ---
const sessions: Record<string, ConversationContext> = {};

function getOrCreateContext(sessionId: string): ConversationContext {
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            mode: 'IDLE',
            constraints: {},
            missing_critical_slots: [],
            assumptions: {},
            history: [],
            itinerary_version: 0
        };
    }
    return sessions[sessionId];
}

/**
 * Task 1 & 2: Canonical Header Builder
 */
function getCanonicalHeader(constraints: ConversationContext['constraints']): string {
    const days = constraints.duration_days || 2;
    const pace = constraints.pace || 'relaxed';
    const city = constraints.destination || 'Udaipur';
    return `${days}-day ${pace} trip to ${city}`;
}

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error("❌ CRITICAL ERROR: No Google API Key found in .env");
}

app.use(express.static(path.join(__dirname, 'ui')));
app.use('/leaflet', express.static(path.join(process.cwd(), 'node_modules/leaflet/dist')));

app.post('/api/send-email', async (req, res) => {
    try {
        const { email, itinerary } = req.body;

        console.log(`[Proxy] Sending itinerary email request for: ${email}`);

        const webhookUrl = process.env.N8N_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error("❌ ERROR: N8N_WEBHOOK_URL is not defined in environment.");
            res.status(500).json({ success: false, error: "Email service configuration missing." });
            return;
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, itinerary })
        });

        const result = await response.text();
        console.log(`[Proxy] n8n Response:`, result);

        if (response.ok) {
            res.json({ success: true, message: "Sent successfully" });
        } else {
            res.status(response.status).json({ success: false, error: result });
        }
    } catch (error: any) {
        console.error(`[Proxy Error]`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/message', async (req, res) => {
    try {
        const { message: userInput, sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: "Session ID is required" });
            return;
        }

        const context = getOrCreateContext(sessionId);
        console.log(`\n📩 [Session: ${sessionId}] User: "${userInput}"`);

        context.history.push({ role: 'user', content: userInput, timestamp: Date.now() });

        let intentResult = await classifyIntent(userInput);
        console.log(`Initial Intent Detected: ${intentResult.intent} (Confidence: ${intentResult.confidence})`);

        // Goal 3: Strict Intent Routing Priority
        // Check for explanation keywords to override intent
        const explanationKeywords = ['why', 'why did you', 'why is', 'tell me about', 'explain'];
        const isExplanationRequest = explanationKeywords.some(k => userInput.toLowerCase().includes(k));

        if (isExplanationRequest) {
            console.log("Keyword match for Explanation. Forcing EXPLAIN_DECISION.");
            intentResult.intent = 'EXPLAIN_DECISION';
        }

        // Check for "yes" to breakdown offer (Task: State-aware follow-up)
        const lastAIAssistantMsg = [...context.history].reverse().find(m => m.role === 'assistant');
        const userSaysPositive = userInput.toLowerCase().match(/^(yes|yup|sure|ok|okay|do it|show me|y)$|.*(show|breakdown|itinerary|yes).*/);

        // Only override if not already an explanation request
        if (intentResult.intent !== 'EXPLAIN_DECISION' && (intentResult.intent === 'CONFIRM_ACK' || userSaysPositive)) {
            if (lastAIAssistantMsg?.content.includes("show you the full breakdown") && context.current_itinerary) {
                console.log("User said YES to breakdown. Overriding intent to SHOW_CURRENT_PLAN.");
                intentResult.intent = 'SHOW_CURRENT_PLAN';
            }
        }

        // 1. EXPLAIN_DECISION
        if (intentResult.intent === 'EXPLAIN_DECISION') {
            console.log("Routing to: EXPLAIN_DECISION");
            if (!context.current_itinerary) {
                res.json({ text: "I haven't started a plan for you yet. Just tell me where you want to go and for how long!" });
                return;
            }

            const ragData = getRagForItinerary(context.current_itinerary);

            // Goal 4: Explanation Scope Enforcement
            // When explaining, we skip the "itinerarySummary" to prevent LLM from returning structure
            const explanationResult = await generateExplanation({
                evalResults: { passed: true, warnings: [] },
                userQuery: userInput,
                ragData
            });

            res.json({
                text: explanationResult.explanation_text,
                citation: explanationResult.citation,
                state: "explanation"
            });
            return;
        }

        // 2. EDIT_ITINERARY
        if (intentResult.intent === 'EDIT_ITINERARY') {
            console.log("Routing to: EDIT_ITINERARY");
            if (!context.current_itinerary) {
                res.json({ text: "I don't have a plan to edit yet! Would you like me to create one first?" });
                return;
            }

            const editResult = await handleEditRequest(userInput, context.current_itinerary, context);

            if (editResult.success && editResult.updatedItinerary) {
                context.current_itinerary = editResult.updatedItinerary;
                context.itinerary_version++;

                const semanticOps = ['add_by_category', 'replace_by_attribute', 'day_relaxation'];
                const isSemantic = editResult.op && semanticOps.includes(editResult.op);
                const responseText = isSemantic
                    ? `${editResult.diffSummary.join(". ")}. Would you like to see the updated itinerary?`
                    : `Done! ${editResult.diffSummary.join(". ")}. I've updated the itinerary for you.`;

                const ragData = getRagForItinerary(context.current_itinerary);
                res.json({
                    text: responseText,
                    itinerary: context.current_itinerary,
                    evaluations: editResult.evaluations,
                    ragSources: ragData,
                    state: "updated",
                    diff: editResult.diffSummary
                });
            } else {
                res.json({
                    text: editResult.failureReason,
                    error: true
                });
            }
            return;
        }

        // 3. SHOW_CURRENT_PLAN (with RAG)
        if (intentResult.intent === 'SHOW_CURRENT_PLAN') {
            console.log("Routing to: SHOW_CURRENT_PLAN");
            if (!context.current_itinerary) {
                res.json({ text: "I haven't started a plan for you yet. Just tell me where you want to go and for how long!" });
                return;
            }

            const ragData = getRagForItinerary(context.current_itinerary);

            const explanationResult = await generateExplanation({
                itinerarySummary: `This is your ${getCanonicalHeader(context.constraints)}. Total itinerary: ${JSON.stringify(context.current_itinerary)}`,
                evalResults: { passed: true, warnings: [] },
                userQuery: userInput,
                ragData
            });

            res.json({
                text: explanationResult.explanation_text,
                citation: explanationResult.citation,
                itinerary: context.current_itinerary,
                ragSources: ragData,
                state: "explanation"
            });
            return;
        }

        // 4. CREATE_TRIP or Re-Planning
        if (intentResult.intent === 'CREATE_TRIP' || (!context.current_itinerary && intentResult.intent !== 'UNKNOWN')) {
            console.log("Routing to: CREATE_TRIP/Initialization");

            const hadItinerary = !!context.current_itinerary;
            const prevDuration = context.constraints.duration_days;
            const prevPace = context.constraints.pace;

            const extraction = await extractConstraints(userInput);

            // Task 4 & 5: Strong No-Op Detection
            const newDuration = extraction.slots?.duration_days;
            const newPace = extraction.slots?.pace;

            const isFreshRequested = userInput.toLowerCase().match(/fresh|new|another|regenerate|re-plan|reset|start over/);

            if (hadItinerary && !isFreshRequested) {
                const isDurationIdentical = (newDuration !== undefined && newDuration !== null && newDuration === prevDuration);
                const isPaceIdentical = (newPace !== undefined && newPace !== null && newPace === prevPace);

                // If both are mentioned and both are same
                if (newDuration !== undefined && newDuration !== null && newPace !== undefined && newPace !== null) {
                    if (isDurationIdentical && isPaceIdentical) {
                        res.json({
                            text: `Your trip is already a ${getCanonicalHeader(context.constraints)}. Is there anything else you'd like to change?`,
                            itinerary: context.current_itinerary,
                            state: "unchanged"
                        });
                        return;
                    }
                }

                // Individual No-Ops (Task 3 & 4)
                if (isDurationIdentical && (newPace === undefined || newPace === null || isPaceIdentical)) {
                    res.json({
                        text: `Your trip is already planned for ${prevDuration} days.`,
                        itinerary: context.current_itinerary,
                        state: "unchanged"
                    });
                    return;
                }
                if (isPaceIdentical && (newDuration === undefined || newDuration === null || isDurationIdentical)) {
                    res.json({
                        text: `Your trip is already set to a ${prevPace} pace.`,
                        itinerary: context.current_itinerary,
                        state: "unchanged"
                    });
                    return;
                }
            }

            // Task 5: Validation Safeguard
            if (newDuration !== undefined && newDuration !== null && newDuration <= 0) {
                res.json({ text: "I'm sorry, but a trip must be at least 1 day long. How many days would you like to plan for?" });
                return;
            }

            // Merge slots (Task: Smart Merge - favors existing state over nulls)
            if (extraction.slots) {
                Object.keys(extraction.slots).forEach(key => {
                    const val = (extraction.slots as any)[key];
                    if (val !== undefined && val !== null) {
                        (context.constraints as any)[key] = val;
                    }
                });
            }

            // Task 1: Food Preference Clarification
            const mentionsFood = userInput.toLowerCase().includes('food') ||
                userInput.toLowerCase().includes('eat') ||
                userInput.toLowerCase().includes('cuisine') ||
                (context.constraints.interests?.some(i => i.toLowerCase().includes('food')));
            if (mentionsFood && !context.constraints.food_preference) {
                res.json({
                    text: "Do you have any food preference (vegetarian, street food, fine dining, or local cuisine)?",
                    state: "clarifying_food"
                });
                return;
            }

            // Task 2: Explicit default ONLY if state is truly empty
            if (context.constraints.duration_days === undefined || context.constraints.duration_days === null) {
                context.constraints.duration_days = 2;
            }
            if (!context.constraints.pace) {
                context.constraints.pace = 'relaxed';
            }
            if (!context.constraints.destination) {
                context.constraints.destination = 'Udaipur'; // MVP default
            }

            // Task 3: Confirmation Gate
            const { destination, duration_days, pace, interests, food_preference } = context.constraints;

            if (context.mode !== 'CONFIRMING_CONSTRAINTS' && !context.current_itinerary) {
                context.mode = 'CONFIRMING_CONSTRAINTS';
                const interestPart = interests && interests.length > 0 ? ` focused on ${interests.join(', ')}` : '';
                const foodPart = food_preference ? `, with ${food_preference} preference` : '';

                res.json({
                    text: `Planning a ${duration_days}-day ${pace} trip to ${destination}${interestPart}${foodPart}. Shall I proceed?`,
                    state: "confirming"
                });
                return;
            }

            // If we are here and we HAVE an itinerary, it means we are UPDATING
            const days = context.constraints.duration_days;
            const paceVal = context.constraints.pace;
            const foodPref = context.constraints.food_preference || 'no preference';

            // Task 3: Normalize for builder
            let paceForBuilder: 'relaxed' | 'packed' = 'relaxed';
            if (paceVal === 'packed') paceForBuilder = 'packed';

            console.log(`Generating Plan for: ${getCanonicalHeader(context.constraints)}`);
            let itinerary = generateItinerary(UDAIPUR_POIS, days, paceForBuilder, foodPref);

            // Goal 3 & 4: Auto-Stabilization Loop
            let evals = runEvaluations(itinerary, { pace: paceForBuilder });
            let stabilizationNote = "";
            let cycles = 0;

            while (!evals.passed && cycles < 3) {
                const durationError = evals.feasibility.errors.find(e => e.includes("exceeds allowed window"));
                if (!durationError) break;

                console.log(`[Stabilization] Cycle ${cycles + 1}: Itinerary failed feasibility. Attempting correction.`);

                // 1. Identify overloaded day
                const dayMatch = durationError.match(/Day (\d+)/);
                const dayNum = dayMatch ? parseInt(dayMatch[1]) : 1;
                const day = itinerary.days.find(d => d.day_number === dayNum);

                if (day) {
                    // 2. Remove lowest priority activity
                    const allActivities = day.blocks.flatMap(b => b.activities);
                    if (allActivities.length > 2) {
                        let lowestPoiId = "";
                        let lowestScore = Infinity;

                        allActivities.forEach(a => {
                            const poi = UDAIPUR_POIS.find(p => p.id === a.poi_id);
                            const score = poi?.popularity_score || 50;
                            if (score < lowestScore) {
                                lowestScore = score;
                                lowestPoiId = a.poi_id;
                            }
                        });

                        day.blocks.forEach(b => {
                            b.activities = b.activities.filter(a => a.poi_id !== lowestPoiId);
                        });

                        // 3 & 4. Recalculate and re-evaluate
                        recalculateDaySchedule(day);
                        evals = runEvaluations(itinerary, { pace: paceForBuilder });
                        stabilizationNote = "\n\nNote: I adjusted the plan slightly to keep each day within a comfortable limit.";
                        cycles++;
                        continue;
                    }
                }
                break;
            }

            context.current_itinerary = itinerary;
            context.mode = 'PRESENTING';
            context.itinerary_version++;

            let responseText = `I've created a fresh ${getCanonicalHeader(context.constraints)}. How does it look?`;
            if (hadItinerary) {
                if (days !== prevDuration && paceVal !== prevPace) {
                    responseText = `Done! I've updated your plan to a ${getCanonicalHeader(context.constraints)}.`;
                } else if (days !== prevDuration) {
                    responseText = `I've updated your trip to ${days} days. I've adjusted the plan for your ${getCanonicalHeader(context.constraints)}.`;
                } else if (paceVal !== prevPace) {
                    responseText = `I've switched your trip to a ${paceVal} pace. Here is your updated ${getCanonicalHeader(context.constraints)}.`;
                }
            }

            const totalItems = itinerary.days.reduce((acc, d) => acc + d.blocks.flatMap(b => b.activities).length, 0);
            const summaryText = `I've scheduled a ${days}-day ${paceVal} itinerary with ${totalItems} activities across the whole trip. Highlights include ${itinerary.days[0].blocks[0].activities[0]?.name || 'City Highlights'} on Day 1 and ${itinerary.days[days - 1].blocks.flatMap(b => b.activities).slice(-1)[0]?.name || 'final stops'} on your last day.`;

            const ragData = getRagForItinerary(itinerary);

            res.json({
                text: `${responseText}\n\n${summaryText}${stabilizationNote} Would you like me to show you the full breakdown?`,
                itinerary,
                evaluations: evals,
                ragSources: ragData,
                state: hadItinerary ? "updated" : "generated"
            });
            return;
        }


        // 5. CONFIRM_ACK
        if (intentResult.intent === 'CONFIRM_ACK') {
            console.log("Routing to: CONFIRM_ACK");

            if (context.mode === 'CONFIRMING_CONSTRAINTS') {
                console.log("User confirmed constraints. Triggering planning.");
                const days = context.constraints.duration_days || 2;
                const paceVal = context.constraints.pace || 'relaxed';
                const foodPref = context.constraints.food_preference || 'no preference';
                let paceForBuilder: 'relaxed' | 'packed' = 'relaxed';
                if (paceVal === 'packed') paceForBuilder = 'packed';

                const itinerary = generateItinerary(UDAIPUR_POIS, days, paceForBuilder, foodPref);
                context.current_itinerary = itinerary;
                context.mode = 'PRESENTING';
                context.itinerary_version++;

                const ragData = getRagForItinerary(itinerary);
                res.json({
                    text: `Great! I've created your ${days}-day ${paceVal} trip. Would you like to see the breakdown?`,
                    itinerary,
                    ragSources: ragData,
                    state: "generated"
                });
                return;
            }

            res.json({
                text: "Great! Let me know if you want to make any other changes or if you're ready to move to the next step.",
                state: "confirmed"
            });
            return;
        }

        // 5. UNKNOWN
        console.log("Routing to: UNKNOWN");
        res.json({
            text: "I'm not quite sure what you mean. You can ask me to plan a trip, change an existing plan, or just show you the details of your current itinerary.",
            state: "clarify"
        });

    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Travel Planner Server running at port ${PORT}`);
    // Perform RAG Integrity Check on Startup
    ragService.performIntegrityCheck(UDAIPUR_POIS.map(p => ({ id: p.id, name: p.name })));
});

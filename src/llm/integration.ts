
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
import { IntentResult, ConstraintExtractionResult, ExplanationContext, ExplanationResult } from '../types/llm';
import { EditCommand } from '../types/edit';
import { Itinerary } from '../types/itinerary';
import { UDAIPUR_POIS } from '../mocks/udaipur_sample';
import {
    SYSTEM_PROMPT_INTENT,
    SYSTEM_PROMPT_EXTRACT,
    SYSTEM_PROMPT_EDIT,
    SYSTEM_PROMPT_EXPLAIN
} from '../prompts/systemPrompts';

dotenv.config();

const rawKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || "";
// Stricter regex: remove quotes AND any character that isn't Alphanumeric, hyphen, or underscore
const cleanKey = rawKey.replace(/["']/g, "").replace(/[^a-zA-Z0-9\-_]/g, "").trim();

if (!cleanKey) {
    console.error("❌ No Gemini API key found in process.env. Ensure GOOGLE_GENAI_API_KEY is set.");
}

const genAI = new GoogleGenerativeAI(cleanKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Helper to call Gemini and parse JSON safely
 */
async function callGeminiJSON(systemPrompt: string, userPrompt: string): Promise<any> {
    const prompt = `${systemPrompt}\n\nUser Input: "${userPrompt}"\n\nOutput Valid JSON only. Do not wrap in markdown block.`;

    try {
        let result = await model.generateContent(prompt);
        let response = await result.response;
        let text = response.text();

        // Sanitize markdown backticks if any
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(text);
    } catch (e: any) {
        console.error("Gemini Error:", e);
        throw new Error("Failed to communicate with AI. Check API key and model availability.");
    }
}

/**
 * Step 10: Classify Intent
 */
export async function classifyIntent(userInput: string): Promise<IntentResult> {
    return await callGeminiJSON(SYSTEM_PROMPT_INTENT, userInput);
}

/**
 * Step 11: Extract Constraints
 */
export async function extractConstraints(userInput: string): Promise<ConstraintExtractionResult> {
    const prompt = `${SYSTEM_PROMPT_EXTRACT}\n\nAvailable POIs for context: ${JSON.stringify(UDAIPUR_POIS.map(p => p.name))}`;
    return await callGeminiJSON(prompt, userInput);
}

/**
 * Step 12: Interpret Edit
 */
export async function interpretEdit(userInput: string, currentItinerary: Itinerary): Promise<EditCommand> {
    const context = `
    CURRENT_ITINERARY: ${JSON.stringify(currentItinerary)}
    AVAILABLE_POIS: ${JSON.stringify(UDAIPUR_POIS.map(p => ({ id: p.id, name: p.name })))}
    `;
    return await callGeminiJSON(SYSTEM_PROMPT_EDIT, `${context}\n\nUSER_REQUEST: ${userInput}`);
}

/**
 * Step 13: Generate Explanation
 */
export async function generateExplanation(context: ExplanationContext): Promise<ExplanationResult> {
    const result = await callGeminiJSON(SYSTEM_PROMPT_EXPLAIN, JSON.stringify(context));
    return result as ExplanationResult;
}


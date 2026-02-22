# 🌍 AI Travel Planner: Udaipur Edition

An advanced, multimodal travel planning companion designed to create, narrate, and verify personalized itineraries for Udaipur, India. This project integrates state-of-the-art LLM capabilities with regional Retrieval-Augmented Generation (RAG) and automated feasibility evaluations.

---

## ✨ Key Features

### 🎙️ Multimodal Interaction
- **Native Voice Input (STT)**: Hands-free planning using the browser's Web Speech API. Features a pulsing red microphone indicator.
- **Automated Narration (TTS)**: The AI speaks back to you! It provides smart summaries of your trip, complete with a "Stop Speech" control and dynamic status animations.

### 🗺️ Intelligent Visualization
- **Dynamic Mapping**: Real-time rendering of your trip route using **Leaflet.js** and **OpenStreetMap**.
- **Visual Timeline**: A sleek, day-by-day breakdown of activities, travel times, and density.

### 🛡️ Trust & Verification
- **Regional RAG System**: Every landmark is verified against a curated database. Look for the **✓ Verified** badge to see direct source links (Wikipedia, Official Tourism sites, etc.).
- **Automated Evaluations**: The system performs three layers of checks on every plan:
  - **Feasibility**: Ensures travel times and activity durations are realistic.
  - **Grounding**: Verifies that POIs exist in the regional database.
  - **Edit Correctness**: Confirms that manual edits don't break the itinerary logic.

### 📧 Seamless Export
- **n8n Integration**: "Email Me This Itinerary" allows users to export their full plan via a production-ready n8n webhook workflow.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (Modern Glassmorphism Design)
- **Backend**: Node.js, Express, TypeScript
- **AI Core**: Google Gemini (gemini-2.0-flash)
- **Maps**: Leaflet.js
- **Automation**: n8n (for Email Workflows)
- **Data**: Regional POI JSON & RAG Knowledge Base

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### 2. Installation
```bash
git clone https://github.com/Vishal0123456789/Travel-planner.git
cd Travel-planner
npm install
```

### 3. Configuration
Create a `.env` file in the root directory and add the following:
```env
GOOGLE_GENAI_API_KEY=your_gemini_api_key
N8N_WEBHOOK_URL=https://projectmilestone.app.n8n.cloud/webhook/generate-itinerary
PORT=3000
```

### 4. Running Locally
```bash
# Start development server (with hot-reload via ts-node)
npm run dev
```
Visit `http://localhost:3000` to start planning.

---

## 🏗️ Deployment

The project is optimized for deployment on platforms like **Render**, **Heroku**, or **Vercel**.

1. **Build the Project**:
   ```bash
   npm run build
   ```
   This generates a production-ready `dist/` folder containing the compiled JS and all static assets (UI, data).

2. **Start Production Server**:
   ```bash
   npm start
   ```

### Deployment Checklist:
- Ensure `N8N_WEBHOOK_URL` is set to the production endpoint.
- Set `NODE_ENV=production`.
- Use the **Render** "Web Service" type for seamless Node + Static support.

---

## 📜 License
This project is licensed under the ISC License.

---

*Handcrafted for Udaipur exploration. 🏰✨*

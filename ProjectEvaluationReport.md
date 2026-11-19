# Smart Care 2 — Project Evaluation Report

**Date:** 25 May 2026

## 1. Overview
This report summarizes the work completed on the Smart Care 2 project, including backend LLM assistant fixes, analytics feature implementation, and dashboard updates.

The goal was to make the AI doctor assistant functional with Gemini, add production-grade logging, and build a real clinical analytics display that shows daily patient and appointment counts.

## 2. Backend Improvements

### 2.1 Gemini-only AI assistant flow
- File: `backend/controllers/assistantController.js`
- Implemented a Gemini-first LLM call flow.
- Added `hasValidGeminiKey()` and `hasValidOpenAIKey()` helper functions.
- Gemini is used if `GEMINI_API_KEY` exists and begins with `AIza`.
- The code now does not fall back to OpenAI when Gemini is available.
- Added a `console.log("ENV GEMINI:", process.env.GEMINI_API_KEY)` startup log.

### 2.2 Dynamic Gemini model discovery
- Added `listGeminiModels(apiKey)` to fetch available Gemini models using `https://generativelanguage.googleapis.com/v1/models?key=...`.
- Cached model lists for 5 minutes to limit API calls.
- Preferred model order:
  - `gemini-1.5-flash`
  - `gemini-3.5-flash`
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
  - `gemini-2.0-flash`
- If preferred models are unavailable, the code falls back to any available `gemini-*` model.

### 2.3 Gemini request payload and retries
- Used `system_instruction` and `contents` payload shape for Gemini.
- Converted messages to `MODEL` / `USER` roles to match Gemini expectations.
- Added retry handling for `RetryInfo` responses from Gemini.
- If a `RetryInfo` with delay is returned, the request waits up to 15 seconds and retries once.
- Logged Gemini request start, response, and any errors.

### 2.4 Medical system prompt
- Added an advanced medical system prompt in `assistantController.js`.
- The prompt guides Gemini to provide:
  - symptom analysis
  - possible conditions
  - follow-up questions
  - precautions and self-care advice
  - emergency warning signs
- It supports English, Hindi, and Punjabi, and uses empathetic clinical language.

### 2.5 Conversation persistence fix
- File: `backend/models/Conversation.js`
- Removed the strict enum restriction from `model`.
- This allows saving newer Gemini model names like `gemini-3.5-flash`.

### 2.6 Analytics endpoint
- Files:
  - `backend/controllers/analyticsController.js`
  - `backend/routes/analyticsRoutes.js`
- Added `GET /api/analytics/daily?days=7`.
- The endpoint returns:
  - `days`: labels for the last N days
  - `patients`: new patient counts per day
  - `appointments`: appointment counts per day
- Patient counts are aggregated by `Patient.createdAt`.
- Appointment counts are aggregated by `Appointment.date`.
- The query range is limited to 1–30 days for performance.

### 2.7 Route registration
- File: `backend/server.js`
- Added the analytics route mount:
  - `app.use("/api/analytics", analyticsRoutes);`

## 3. Frontend Improvements

### 3.1 Dashboard analytics controls and chart
- File: `frontend/src/components/Dashboard.js`
- Added state for:
  - `analyticsDays`
  - `analyticsPatients`
  - `analyticsAppointments`
  - `analyticsView`
  - `analyticsRange`
- Added dashboard selectors:
  - `View`: `All metrics`, `New patients`, `Appointments`
  - `Days`: `7 days`, `14 days`, `30 days`
- Updated the dashboard to fetch analytics data from `/api/analytics/daily?days=<N>`.
- Rendered a simple bar chart inside the dashboard that updates based on selected view and date range.
- Display now shows actual counts for recent patient/appointment activity rather than a static card.

### 3.2 User experience
- The chart title now shows the selected range: `Clinical analytics — Last X days`.
- The chart hides the unused metric when a single view is selected.
- The dashboard now gives the user a choice to analyze different metrics interactively.

## 4. Testing and verification

### 4.1 Backend tests
- Confirmed the analytics endpoint returns valid JSON.
- Verified the AI assistant route returns successful Gemini responses for sample medical queries such as `heart attack symptoms`.
- Confirmed model persistence works with `gemini-3.5-flash`.

### 4.2 Frontend build
- Ran `cd frontend && npm run build` successfully.
- Build completed with existing unrelated ESLint warnings in `src/pages/AIAssistantPage.js`, but no fatal errors.

## 5. Remaining considerations

### 5.1 Gemini billing / quota
- The backend code now uses Gemini properly, but long-term reliability depends on the Google Cloud project having the necessary Gemini quotas and model access.
- If the key returns quota or model access errors, the project may still fail until billing or permissions are fixed.

### 5.2 Optional fallback behavior
- Currently the design is Gemini-first.
- If you want, I can add an explicit configuration toggle for OpenAI fallback during temporary Gemini outages.

## 6. How to run the project

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### Analytics API
```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3001/api/analytics/daily?days=7"
```

## 7. Changed files

- `backend/controllers/assistantController.js`
- `backend/models/Conversation.js`
- `backend/controllers/analyticsController.js`
- `backend/routes/analyticsRoutes.js`
- `backend/server.js`
- `frontend/src/components/Dashboard.js`

---

If you want, I can also add a second PDF version with screenshots and exact command history in the report.
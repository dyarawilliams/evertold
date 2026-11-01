# EverTold — AI Development Instructions

## Project Overview
EverTold is an open-source, AI-powered family oral history preservation platform.

Tagline: Every story deserves to live on.

The application allows families to record, transcribe, organize, search, and preserve personal stories.

## Technology Stack
- React
- Vite
- Tailwind CSS v4
- Node.js
- Express
- SQLite
- Dexie / IndexedDB
- Python
- FastAPI
- faster-whisper
- Gemma
- Ollama

## Architecture
Maintain a modular monorepo:

- apps/web: React frontend
- apps/api: Express backend
- services/transcription: Python transcription service
- ai: AI prompts and configurations
- docs: Project documentation
- data: Local application data

## Visual Identity
Use a warm, nostalgic, editorial design.

- Ivory: #F8F5EF
- Sage: #8C9B83
- Terracotta: #B87558
- Charcoal: #30332F

Use serif headings and sans-serif body typography.

Design for desktop, tablet, and mobile.

Prioritize accessibility, responsive layouts, and clear navigation.

## AI Behavior
- Whisper handles speech transcription.
- Gemma analyzes transcripts.
- Never invent historical facts.
- Preserve the original transcript.
- Clearly identify AI-generated content.
- Allow users to edit and approve AI-generated insights.
- Connect generated insights to supporting transcript excerpts.
- Represent uncertain information as unknown rather than guessing.

## Privacy
- Obtain consent before recording.
- Do not expose private audio or transcripts.
- Never commit recordings, personal archives, or .env files.
- Provide deletion and export functionality.
- Use synthetic data in public demonstrations.

## Development Rules
- Inspect existing files before editing.
- Do not rebuild working functionality unnecessarily.
- Build one feature at a time.
- Use reusable components and modular services.
- Validate API requests.
- Handle errors and loading states.
- Write tests for important functionality.
- Explain significant changes before implementing them.

## Development Workflow
For each feature:
1. Explain the implementation plan.
2. Identify the files that need changes.
3. Implement the feature.
4. Run relevant tests.
5. Explain how to verify the result.
6. Report any outstanding issues.
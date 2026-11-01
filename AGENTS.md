# EverTold — Project Instructions

## Project Identity
**Name:** EverTold  
**Tagline:** Every story deserves to live on.

EverTold is an open-source, AI-powered family oral history preservation platform. It helps families record conversations, transcribe stories, organize memories, and preserve family histories.

## Technology Stack
- Frontend: React, Vite, Tailwind CSS v4
- Backend: Node.js, Express
- Database: SQLite with better-sqlite3
- Browser storage: IndexedDB with Dexie
- Speech recognition: Whisper using faster-whisper
- Language model: Gemma through Ollama
- Transcription API: Python FastAPI
- Validation: Zod

## Architecture
Maintain separate frontend, backend, and AI transcription services.

- `apps/web`: React frontend
- `apps/api`: Express backend
- `services/transcription`: Python Whisper service
- `ai`: AI prompts and model-related configuration
- `docs`: Technical and project documentation

## Design Guidelines
Use a warm, nostalgic, editorial visual identity.

Colors:
- Ivory: #F8F5EF
- Sage: #8C9B83
- Terracotta: #B87558
- Charcoal: #30332F

Use elegant serif headings, readable sans-serif body text, accessible contrast, responsive layouts, and consistent spacing.

## AI Guidelines
- Whisper handles speech-to-text transcription.
- Gemma analyzes transcripts and generates summaries and structured insights.
- Never invent names, dates, relationships, locations, or historical events.
- Clearly distinguish original testimony from AI-generated content.
- Allow users to review, edit, and approve AI-generated insights.
- Link generated insights to their supporting transcript excerpts.

## Privacy and Security
- Obtain consent before recording people.
- Keep original recordings intact unless the user requests deletion.
- Do not expose server filesystem paths to the frontend.
- Never commit private recordings, transcripts, or environment files.
- Provide deletion and archive export capabilities.
- Use fictional or synthetic stories in public demonstrations.

## Development Standards
- Write modular, reusable code.
- Use clear naming conventions.
- Validate API inputs.
- Handle loading, error, and empty states.
- Follow accessibility best practices.
- Add tests for important functionality.
- Avoid unnecessary dependencies.
- Explain significant architectural decisions.

## Development Approach
Build and test one complete feature at a time. Before modifying existing architecture, inspect the relevant files and explain the proposed changes. Do not replace working implementations without a clear reason.

# EverTold

Every story deserves to live on.

EverTold is an open-source platform for preserving family oral histories. This repository is the foundation: a React app, an Express API with SQLite, and a Python transcription service. Recording, transcription, and story organization are not implemented yet.

## Layout

| Path | Role |
| --- | --- |
| `apps/web` | React, Vite, Tailwind CSS v4, and Dexie |
| `apps/api` | Express, Zod, and SQLite through better-sqlite3 |
| `services/transcription` | FastAPI transcription service |
| `ai/gemma` | Gemma model configuration for Ollama |
| `ai/transcription` | faster-whisper model configuration |
| `ai/prompts` | Prompt text used by later language-model features |
| `data/audio` | Local recordings. Not committed. |
| `data/exports` | Local archive exports. Not committed. |
| `docs` | Project documentation |
| `tests` | Foundation checks for the API, browser database, and transcription service |

npm workspaces cover `apps/web` and `apps/api`. The transcription service stays a Python project.

## Prerequisites

- Node.js 22 or newer
- Python 3.11 or newer

Ollama and faster-whisper are not required to run this foundation.

## Setup

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -e "services/transcription[dev]"
cp .env.example .env
```

## Development

```bash
npm run dev
```

- Web: http://127.0.0.1:5173
- API health: http://127.0.0.1:3001/health
- API health through the web proxy: http://127.0.0.1:5173/api/health
- Transcription health: http://127.0.0.1:8000/health

The Vite dev server proxies `/api` to the Express server. Express does not call the transcription service yet. `TRANSCRIPTION_URL` is reserved for that later work.

Run one process with `npm run dev:web`, `npm run dev:api`, or `npm run dev:transcription`.

`npm run build` compiles the web app and the API. `npm start -w @evertold/api` runs the compiled API.

## Checks

```bash
npm run typecheck
npm test
```

## Configuration

Environment variables are listed in `.env.example`. Copy it to `.env`. `.env` is gitignored.

- The API reads the repository-root `.env` and checks it with Zod before listening.
- Relative `DATABASE_PATH` values are resolved from the repository root. The default file is `data/evertold.sqlite`.
- When `OLLAMA_MODEL` is unset, the default comes from `ai/gemma/model.json`.
- Whisper defaults come from `ai/transcription/model.json` unless `WHISPER_MODEL`, `WHISPER_DEVICE`, or `WHISPER_COMPUTE_TYPE` is set.
- Health responses do not include filesystem paths.

The browser database is Dexie, named `evertold`, and defined in `apps/web/src/db/index.ts`. It has no tables yet.

## Whisper

Speech-to-text is not wired up. The dependency is optional so setup does not download the Whisper runtime before that feature exists:

```bash
.venv/bin/pip install -e "services/transcription[whisper]"
```

## License

[MIT](LICENSE)

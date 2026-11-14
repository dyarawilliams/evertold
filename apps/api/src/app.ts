import os from "node:os";
import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import type { AppDatabase } from "./db/sqlite.js";
import { migrate } from "./db/migrate.js";
import { errorHandler } from "./http/errors.js";
import { healthRouter } from "./routes/health.js";
import { insightsRouter } from "./routes/insights.js";
import { mediaRouter } from "./routes/media.js";
import { statusRouter } from "./routes/status.js";
import { storiesRouter } from "./routes/stories.js";
import { defaultFetch, type FetchLike } from "./services/fetch.js";

export type AppConfig = {
  WEB_ORIGIN: string;
  TRANSCRIPTION_URL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  repoRoot?: string;
};

export type ServiceConfig = {
  webOrigin: string;
  transcriptionUrl: string | null;
  ollamaBaseUrl: string | null;
  ollamaModel: string | null;
  repoRoot: string | null;
  audioDir: string;
  fetchImpl: FetchLike;
};

declare global {
  namespace Express {
    interface Locals {
      database: AppDatabase;
      services: ServiceConfig;
    }
  }
}

export type CreateAppOptions = {
  env: AppConfig;
  database: AppDatabase;
  audioDir?: string;
  fetchImpl?: FetchLike;
};

export function createApp(options: CreateAppOptions): Express {
  migrate(options.database);
  const app = express();
  app.disable("x-powered-by");
  app.locals.database = options.database;
  app.locals.services = {
    webOrigin: options.env.WEB_ORIGIN,
    transcriptionUrl: options.env.TRANSCRIPTION_URL ?? null,
    ollamaBaseUrl: options.env.OLLAMA_BASE_URL ?? null,
    ollamaModel: options.env.OLLAMA_MODEL ?? null,
    repoRoot: options.env.repoRoot ?? null,
    audioDir: options.audioDir ?? path.join(os.tmpdir(), "evertold-audio"),
    fetchImpl: options.fetchImpl ?? defaultFetch,
  };
  app.use(cors({ origin: options.env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use(statusRouter);
  app.use(storiesRouter);
  app.use(mediaRouter);
  app.use(insightsRouter);
  app.use((_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "No API route matched this request.",
    });
  });
  app.use(errorHandler);
  return app;
}

export function getDatabase(app: Express): AppDatabase {
  return app.locals.database;
}

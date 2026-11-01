import cors from "cors";
import express, { type Express } from "express";
import type { AppDatabase } from "./db/sqlite.js";
import { errorHandler } from "./http/errors.js";
import { healthRouter } from "./routes/health.js";

export type AppConfig = {
  WEB_ORIGIN: string;
};

declare global {
  namespace Express {
    interface Locals {
      database: AppDatabase;
    }
  }
}

export type CreateAppOptions = {
  env: AppConfig;
  database: AppDatabase;
};

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.locals.database = options.database;
  app.use(cors({ origin: options.env.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(healthRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
  app.use(errorHandler);
  return app;
}

export function getDatabase(app: Express): AppDatabase {
  return app.locals.database;
}

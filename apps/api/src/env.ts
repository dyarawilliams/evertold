import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const httpUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Expected an http(s) URL.");

export const envSchema = z.object({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PATH: z.string().min(1).default("data/evertold.sqlite"),
  WEB_ORIGIN: httpUrl.default("http://127.0.0.1:5173"),
  TRANSCRIPTION_URL: httpUrl.default("http://127.0.0.1:8000"),
  OLLAMA_BASE_URL: httpUrl.default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema> & {
  repoRoot: string;
  databasePath: string;
};

export function loadEnvironment(cwd = process.cwd()): Env {
  const repoRoot = findRepoRoot(cwd);
  const envFile = path.join(repoRoot, ".env");
  if (fs.existsSync(envFile)) {
    loadEnv({ path: envFile, quiet: true });
  }
  return parseEnv(process.env, repoRoot);
}

export function parseEnv(source: NodeJS.ProcessEnv, repoRoot: string): Env {
  const model = source.OLLAMA_MODEL?.trim() || readGemmaModel(repoRoot);
  const parsed = envSchema.parse({ ...source, OLLAMA_MODEL: model });
  return {
    ...parsed,
    repoRoot,
    databasePath: resolveDatabasePath(repoRoot, parsed.DATABASE_PATH),
  };
}

export function findRepoRoot(start: string): string {
  let current = path.resolve(start);

  for (;;) {
    const manifestPath = path.join(current, "package.json");
    const agentsPath = path.join(current, "AGENTS.md");
    if (fs.existsSync(manifestPath) && fs.existsSync(agentsPath)) {
      const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (isRecord(manifest) && manifest.name === "evertold") {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not find the EverTold repository root.");
    }
    current = parent;
  }
}

function readGemmaModel(repoRoot: string): string {
  const configPath = path.join(repoRoot, "ai", "gemma", "model.json");
  const raw: unknown = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!isRecord(raw) || typeof raw.model !== "string" || raw.model.trim() === "") {
    throw new Error("ai/gemma/model.json must include a non-empty model name.");
  }
  return raw.model;
}

function resolveDatabasePath(repoRoot: string, databasePath: string): string {
  if (databasePath === ":memory:" || path.isAbsolute(databasePath)) {
    return databasePath;
  }
  return path.join(repoRoot, databasePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import fs from "node:fs";
import path from "node:path";
import { isRecord, type FetchLike } from "./fetch.js";
import type { InsightDraft } from "../stories/ground.js";

export type OllamaResult =
  | { ok: true; draft: InsightDraft }
  | { ok: false; reason: "unavailable" | "invalid" };

export function loadInsightsPrompt(repoRoot: string): string | null {
  const promptPath = path.join(repoRoot, "ai", "prompts", "insights.txt");
  if (!fs.existsSync(promptPath)) {
    return null;
  }
  const prompt = fs.readFileSync(promptPath, "utf8").trim();
  return prompt === "" ? null : prompt;
}

export async function requestInsightDraft(options: {
  baseUrl: string;
  model: string;
  prompt: string;
  transcript: string;
  fetchImpl: FetchLike;
}): Promise<OllamaResult> {
  let response: Response;
  try {
    response = await options.fetchImpl(joinUrl(options.baseUrl, "/api/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [
          { role: "system", content: options.prompt },
          { role: "user", content: options.transcript },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const draft = readDraft(payload);
  return draft ? { ok: true, draft } : { ok: false, reason: "invalid" };
}

function readDraft(payload: unknown): InsightDraft | null {
  if (!isRecord(payload) || !isRecord(payload.message)) {
    return null;
  }
  const content = payload.message.content;
  const parsed = typeof content === "string" ? parseModelJson(content) : content;
  if (!isRecord(parsed) || typeof parsed.summary !== "string") {
    return null;
  }
  return {
    summary: parsed.summary,
    people: readItems(parsed.people),
    places: readItems(parsed.places),
    moments: readItems(parsed.moments),
    topics: readItems(parsed.topics),
    unknowns: readUnknowns(parsed.unknowns),
  };
}

export function parseModelJson(content: string): unknown | null {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const jsonText = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
}

function readItems(value: unknown): InsightDraft["people"] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: InsightDraft["people"] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.label !== "string" || typeof entry.excerpt !== "string") {
      continue;
    }
    const label = entry.label.trim().slice(0, 200);
    const excerpt = entry.excerpt.trim().slice(0, 2_000);
    if (!label || !excerpt) {
      continue;
    }
    items.push({ label, excerpt });
    if (items.length === 30) {
      break;
    }
  }
  return items;
}

function readUnknowns(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const notes: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const note = entry.trim().slice(0, 300);
    if (!note) {
      continue;
    }
    notes.push(note);
    if (notes.length === 20) {
      break;
    }
  }
  return notes;
}

function joinUrl(base: string, pathname: string): string {
  return `${base.replace(/\/$/, "")}${pathname}`;
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../db/sqlite.js";
import { DEMO_TITLE, DEMO_TRANSCRIPT, buildDemoInsights } from "./demo.js";
import { groundInsights } from "./ground.js";
import {
  insightsSchema,
  type Insights,
  type Story,
  type StoryPatch,
  type TranscriptSource,
  type UpdateResult,
} from "./types.js";

type StoryRow = {
  id: string;
  title: string;
  consent: number;
  transcript: string;
  original_transcript: string;
  transcript_source: string;
  transcript_model: string | null;
  insights_json: string | null;
  insights_approved: number;
  audio_filename: string | null;
  audio_mime: string | null;
  saved: number;
  demo: number;
  created_at: string;
  updated_at: string;
};

type StoredStory = Story & {
  audioFilename: string | null;
};

const DEFAULT_TITLE = "Untitled story";

export function createStory(
  database: AppDatabase,
  input: { title?: string; consent: boolean; transcript?: string },
): Story {
  const now = new Date().toISOString();
  const transcript = input.transcript ?? "";
  const hasTranscript = transcript.trim() !== "";
  const id = randomUUID();
  database
    .prepare(
      `INSERT INTO stories (
        id, title, consent, transcript, original_transcript, transcript_source,
        transcript_model, insights_json, insights_approved, audio_filename,
        audio_mime, saved, demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, 0, 0, ?, ?)`,
    )
    .run(
      id,
      input.title?.trim() || DEFAULT_TITLE,
      input.consent ? 1 : 0,
      transcript,
      hasTranscript ? transcript : "",
      hasTranscript ? "manual" : "none",
      now,
      now,
    );
  return requireStory(database, id);
}

export function createDemoStory(database: AppDatabase): Story {
  const now = new Date().toISOString();
  const id = randomUUID();
  const insights = buildDemoInsights();
  database
    .prepare(
      `INSERT INTO stories (
        id, title, consent, transcript, original_transcript, transcript_source,
        transcript_model, insights_json, insights_approved, audio_filename,
        audio_mime, saved, demo, created_at, updated_at
      ) VALUES (?, ?, 1, ?, ?, 'demo', NULL, ?, 0, NULL, NULL, 1, 1, ?, ?)`,
    )
    .run(id, DEMO_TITLE, DEMO_TRANSCRIPT, DEMO_TRANSCRIPT, JSON.stringify(insights), now, now);
  return requireStory(database, id);
}

export function listStories(database: AppDatabase, saved?: boolean): Story[] {
  const rows =
    saved === undefined
      ? database
          .prepare<unknown[], StoryRow>("SELECT * FROM stories ORDER BY updated_at DESC")
          .all()
      : database
          .prepare<[number], StoryRow>(
            "SELECT * FROM stories WHERE saved = ? ORDER BY updated_at DESC",
          )
          .all(saved ? 1 : 0);
  return rows.map((row) => toPublic(mapRow(row)));
}

export function getStory(database: AppDatabase, id: string): Story | null {
  const stored = getStored(database, id);
  return stored ? toPublic(stored) : null;
}

export function updateStory(database: AppDatabase, id: string, patch: StoryPatch): UpdateResult {
  const current = getStored(database, id);
  if (!current) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "That story is not on this computer.",
    };
  }

  const title = patch.title ?? current.title;
  const consent = patch.consent ?? current.consent;
  const transcript = patch.transcript ?? current.transcript;
  let originalTranscript = current.originalTranscript;
  let transcriptSource = current.transcriptSource;
  if (
    patch.transcript !== undefined &&
    current.originalTranscript.trim() === "" &&
    patch.transcript.trim() !== ""
  ) {
    originalTranscript = patch.transcript;
    if (transcriptSource === "none") {
      transcriptSource = "manual";
    }
  }

  let insights = current.insights;
  let insightsApproved = patch.insightsApproved ?? current.insightsApproved;

  if (patch.insights === null) {
    insights = null;
    insightsApproved = false;
  } else if (patch.insights) {
    const locked = lockInsightSource(current);
    if (!locked.ok) {
      return locked;
    }
    const grounded = groundInsights(transcript, patch.insights, {
      source: locked.source,
      model: locked.model,
      edited: false,
    });
    if (!grounded.ok) {
      return {
        ok: false,
        status: 400,
        error: "ungrounded_insights",
        message: grounded.message,
      };
    }
    const unchanged =
      current.insights !== null &&
      insightContentKey(current.insights) === insightContentKey(grounded.insights);
    insights = unchanged ? current.insights : { ...grounded.insights, edited: true };
  } else if (patch.transcript !== undefined && current.insights) {
    const grounded = groundInsights(transcript, current.insights, {
      source: current.insights.source,
      model: current.insights.model,
      edited: current.insights.edited,
    });
    if (!grounded.ok || grounded.removed > 0) {
      return {
        ok: false,
        status: 400,
        error: "ungrounded_insights",
        message:
          "Some insight excerpts are no longer in the transcript. Edit the insights or generate them again before saving.",
      };
    }
    insights = grounded.insights;
  }

  const saved = patch.saved ?? current.saved;
  if (saved && !consent) {
    return {
      ok: false,
      status: 400,
      error: "consent_required",
      message: "Record consent before saving this memory.",
    };
  }
  if (saved && transcript.trim() === "") {
    return {
      ok: false,
      status: 400,
      error: "transcript_required",
      message: "Add a transcript before saving this memory.",
    };
  }
  if (insightsApproved && !insights) {
    return {
      ok: false,
      status: 400,
      error: "insights_required",
      message: "There are no insights to approve.",
    };
  }

  writeStory(database, id, {
    title,
    consent,
    transcript,
    originalTranscript,
    transcriptSource,
    transcriptModel: current.transcriptModel,
    insights,
    insightsApproved,
    saved,
  });
  return { ok: true, story: requireStory(database, id) };
}

export function saveWhisperTranscript(
  database: AppDatabase,
  id: string,
  transcript: string,
  model: string,
): Story | null {
  const current = getStored(database, id);
  if (!current) {
    return null;
  }
  writeStory(database, id, {
    title: current.title,
    consent: current.consent,
    transcript,
    originalTranscript: transcript,
    transcriptSource: "whisper",
    transcriptModel: model,
    insights: null,
    insightsApproved: false,
    saved: current.saved,
  });
  return getStory(database, id);
}

export function saveGeneratedInsights(
  database: AppDatabase,
  id: string,
  insights: Insights,
): Story | null {
  const parsed = insightsSchema.parse(insights);
  const current = getStored(database, id);
  if (!current) {
    return null;
  }
  writeStory(database, id, {
    title: current.title,
    consent: current.consent,
    transcript: current.transcript,
    originalTranscript: current.originalTranscript,
    transcriptSource: current.transcriptSource,
    transcriptModel: current.transcriptModel,
    insights: parsed,
    insightsApproved: false,
    saved: current.saved,
  });
  return getStory(database, id);
}

export function readAudio(
  database: AppDatabase,
  id: string,
): { filename: string; mime: string } | null {
  const stored = getStored(database, id);
  if (!stored?.audioFilename || !stored.audioMime) {
    return null;
  }
  return { filename: stored.audioFilename, mime: stored.audioMime };
}

export function attachAudio(
  database: AppDatabase,
  audioDir: string,
  id: string,
  mime: string,
  bytes: Buffer,
  extension: string,
): Story | null {
  const current = getStored(database, id);
  if (!current) {
    return null;
  }
  const filename = writeAudioFile(audioDir, id, extension, bytes);
  if (current.audioFilename && current.audioFilename !== filename) {
    removeAudioFile(audioDir, current.audioFilename);
  }
  database
    .prepare(
      "UPDATE stories SET audio_filename = ?, audio_mime = ?, updated_at = ? WHERE id = ?",
    )
    .run(filename, mime, new Date().toISOString(), id);
  return getStory(database, id);
}

export function deleteStory(database: AppDatabase, audioDir: string, id: string): boolean {
  const current = getStored(database, id);
  if (!current) {
    return false;
  }
  database.prepare("DELETE FROM stories WHERE id = ?").run(id);
  if (current.audioFilename) {
    removeAudioFile(audioDir, current.audioFilename);
  }
  return true;
}

export function safeAudioPath(audioDir: string, filename: string): string | null {
  const base = path.basename(filename);
  if (base !== filename || base === "" || base === "." || base === "..") {
    return null;
  }
  const root = path.resolve(audioDir);
  const resolved = path.resolve(root, base);
  if (resolved !== path.join(root, base)) {
    return null;
  }
  return resolved;
}

function writeAudioFile(audioDir: string, id: string, extension: string, bytes: Buffer): string {
  fs.mkdirSync(audioDir, { recursive: true });
  const filename = `${id}${extension}`;
  const fullPath = safeAudioPath(audioDir, filename);
  if (!fullPath) {
    throw new Error("Could not store the recording.");
  }
  fs.writeFileSync(fullPath, bytes);
  return filename;
}

function removeAudioFile(audioDir: string, filename: string): void {
  const fullPath = safeAudioPath(audioDir, filename);
  if (fullPath) {
    fs.rmSync(fullPath, { force: true });
  }
}

function lockInsightSource(
  current: StoredStory,
): { ok: true; source: Insights["source"]; model: string | null } | UpdateResult & { ok: false } {
  if (current.demo) {
    return { ok: true, source: "demo", model: null };
  }
  if (current.insights?.source === "ollama") {
    return { ok: true, source: "ollama", model: current.insights.model };
  }
  return {
    ok: false,
    status: 400,
    error: "insights_not_generated",
    message:
      "Generate insights before editing them. EverTold will not label typed notes as model output.",
  };
}

function writeStory(
  database: AppDatabase,
  id: string,
  story: {
    title: string;
    consent: boolean;
    transcript: string;
    originalTranscript: string;
    transcriptSource: TranscriptSource;
    transcriptModel: string | null;
    insights: Insights | null;
    insightsApproved: boolean;
    saved: boolean;
  },
): void {
  database
    .prepare(
      `UPDATE stories SET
        title = ?,
        consent = ?,
        transcript = ?,
        original_transcript = ?,
        transcript_source = ?,
        transcript_model = ?,
        insights_json = ?,
        insights_approved = ?,
        saved = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      story.title,
      story.consent ? 1 : 0,
      story.transcript,
      story.originalTranscript,
      story.transcriptSource,
      story.transcriptModel,
      story.insights ? JSON.stringify(story.insights) : null,
      story.insightsApproved ? 1 : 0,
      story.saved ? 1 : 0,
      new Date().toISOString(),
      id,
    );
}

function requireStory(database: AppDatabase, id: string): Story {
  const story = getStory(database, id);
  if (!story) {
    throw new Error("Story disappeared after it was written.");
  }
  return story;
}

function getStored(database: AppDatabase, id: string): StoredStory | null {
  const row = database.prepare<[string], StoryRow>("SELECT * FROM stories WHERE id = ?").get(id);
  return row ? mapRow(row) : null;
}

function mapRow(row: StoryRow): StoredStory {
  return {
    id: row.id,
    title: row.title,
    consent: row.consent === 1,
    transcript: row.transcript,
    originalTranscript: row.original_transcript,
    transcriptSource: asSource(row.transcript_source),
    transcriptModel: row.transcript_model,
    insights: readInsights(row.insights_json),
    insightsApproved: row.insights_approved === 1,
    hasAudio: row.audio_filename !== null,
    audioMime: row.audio_mime,
    saved: row.saved === 1,
    demo: row.demo === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audioFilename: row.audio_filename,
  };
}

function toPublic(story: StoredStory): Story {
  return {
    id: story.id,
    title: story.title,
    consent: story.consent,
    transcript: story.transcript,
    originalTranscript: story.originalTranscript,
    transcriptSource: story.transcriptSource,
    transcriptModel: story.transcriptModel,
    insights: story.insights,
    insightsApproved: story.insightsApproved,
    hasAudio: story.hasAudio,
    audioMime: story.audioMime,
    saved: story.saved,
    demo: story.demo,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
}

function insightContentKey(insights: Insights): string {
  return JSON.stringify({
    summary: insights.summary,
    people: insights.people,
    places: insights.places,
    moments: insights.moments,
    topics: insights.topics,
    unknowns: insights.unknowns,
  });
}

function asSource(value: string): TranscriptSource {
  switch (value) {
    case "none":
    case "manual":
    case "whisper":
    case "demo":
      return value;
    default: {
      throw new Error(`Unknown transcript source: ${value}`);
    }
  }
}

function readInsights(value: string | null): Insights | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    const result = insightsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

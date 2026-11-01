import type { AppDatabase } from "./sqlite.js";

export function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      consent INTEGER NOT NULL,
      transcript TEXT NOT NULL,
      original_transcript TEXT NOT NULL,
      transcript_source TEXT NOT NULL,
      transcript_model TEXT,
      insights_json TEXT,
      insights_approved INTEGER NOT NULL,
      audio_filename TEXT,
      audio_mime TEXT,
      saved INTEGER NOT NULL,
      demo INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS stories_saved_updated
      ON stories (saved, updated_at DESC);
  `);
}

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function openDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  if (filename !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }
  return database;
}

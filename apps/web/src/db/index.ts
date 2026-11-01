import { Dexie, type EntityTable } from "dexie";
import type { Story } from "../lib/types.js";

export type LocalMemory = {
  id: string;
  title: string;
  summary: string | null;
  saved: boolean;
  demo: boolean;
  updatedAt: string;
  story: Story;
};

export type PendingRecording = {
  id: string;
  title: string;
  mime: string;
  blob: Blob;
  createdAt: string;
};

/**
 * Browser database for EverTold.
 * Version 1 had no tables. Version 2 stores saved memories and recordings that
 * have not reached the API yet.
 */
export class EverToldDatabase extends Dexie {
  memories!: EntityTable<LocalMemory, "id">;
  recordings!: EntityTable<PendingRecording, "id">;

  constructor() {
    super("evertold");
    this.version(1).stores({});
    this.version(2).stores({
      memories: "id, updatedAt, saved, demo",
      recordings: "id, createdAt",
    });
  }
}

export const db = new EverToldDatabase();

export async function rememberStory(story: Story): Promise<void> {
  try {
    await db.memories.put({
      id: story.id,
      title: story.title,
      summary: story.insights?.summary ?? null,
      saved: story.saved,
      demo: story.demo,
      updatedAt: story.updatedAt,
      story,
    });
  } catch {
    // The API holds the story. Browser storage can be unavailable.
  }
}

export async function rememberStories(stories: Story[]): Promise<void> {
  try {
    await db.memories.bulkPut(
      stories.map((story) => ({
        id: story.id,
        title: story.title,
        summary: story.insights?.summary ?? null,
        saved: story.saved,
        demo: story.demo,
        updatedAt: story.updatedAt,
        story,
      })),
    );
  } catch {
    // The library can still render from the API response.
  }
}

export async function forgetStory(id: string): Promise<void> {
  try {
    await db.memories.delete(id);
    await db.recordings.delete(id);
  } catch {
    // Deletion on the API is the source of truth.
  }
}

export async function savedMemories(): Promise<LocalMemory[]> {
  const rows = await db.memories.toArray();
  return rows
    .filter((row) => row.saved)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

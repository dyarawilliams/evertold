import { z } from "zod";

export const insightItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(2_000),
});

export const insightsSchema = z.object({
  source: z.enum(["ollama", "demo"]),
  model: z.string().min(1).nullable(),
  edited: z.boolean(),
  summary: z.string().trim().min(1).max(4_000),
  people: z.array(insightItemSchema).max(30),
  places: z.array(insightItemSchema).max(30),
  moments: z.array(insightItemSchema).max(30),
  topics: z.array(insightItemSchema).max(30),
  unknowns: z.array(z.string().trim().min(1).max(300)).max(20),
});

export const createStorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  consent: z.boolean(),
  transcript: z.string().max(100_000).optional(),
});

export const patchStorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  consent: z.boolean().optional(),
  transcript: z.string().max(100_000).optional(),
  insights: insightsSchema.nullable().optional(),
  insightsApproved: z.boolean().optional(),
  saved: z.boolean().optional(),
});

export type InsightItem = z.infer<typeof insightItemSchema>;
export type Insights = z.infer<typeof insightsSchema>;
export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type PatchStoryInput = z.infer<typeof patchStorySchema>;

export type TranscriptSource = "none" | "manual" | "whisper" | "demo";
export type InsightSource = Insights["source"];

export type Story = {
  id: string;
  title: string;
  consent: boolean;
  transcript: string;
  originalTranscript: string;
  transcriptSource: TranscriptSource;
  transcriptModel: string | null;
  insights: Insights | null;
  insightsApproved: boolean;
  hasAudio: boolean;
  audioMime: string | null;
  saved: boolean;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoryPatch = PatchStoryInput;

export type UpdateFailure = {
  ok: false;
  status: number;
  error: string;
  message: string;
};

export type UpdateSuccess = {
  ok: true;
  story: Story;
};

export type UpdateResult = UpdateSuccess | UpdateFailure;

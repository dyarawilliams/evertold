export type InsightItem = {
  label: string;
  excerpt: string;
};

export type InsightSource = "ollama" | "demo";

export type Insights = {
  source: InsightSource;
  model: string | null;
  edited: boolean;
  summary: string;
  people: InsightItem[];
  places: InsightItem[];
  moments: InsightItem[];
  topics: InsightItem[];
  unknowns: string[];
};

export type TranscriptSource = "none" | "manual" | "whisper" | "demo";

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

export type StoryPatch = {
  title?: string;
  consent?: boolean;
  transcript?: string;
  insights?: Insights | null;
  insightsApproved?: boolean;
  saved?: boolean;
};

export type ServiceStatus = {
  transcription: { available: boolean; message: string };
  gemma: { available: boolean; model: string | null; message: string };
};

export type ApiFailure = {
  ok: false;
  status: number;
  error: string;
  message: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

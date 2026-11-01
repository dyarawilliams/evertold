import type { ApiFailure, ApiResult, ServiceStatus, Story, StoryPatch } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStory(value: unknown): value is Story {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.consent === "boolean" &&
    typeof value.transcript === "string" &&
    typeof value.originalTranscript === "string" &&
    isTranscriptSource(value.transcriptSource) &&
    (value.transcriptModel === null || typeof value.transcriptModel === "string") &&
    (value.insights === null || isRecord(value.insights)) &&
    typeof value.insightsApproved === "boolean" &&
    typeof value.hasAudio === "boolean" &&
    (value.audioMime === null || typeof value.audioMime === "string") &&
    typeof value.saved === "boolean" &&
    typeof value.demo === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isTranscriptSource(value: unknown): boolean {
  return value === "none" || value === "manual" || value === "whisper" || value === "demo";
}

async function request(path: string, init?: RequestInit): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return failure(0, "offline", "The API is not reachable on this computer.");
  }

  if (response.status === 204) {
    return { ok: true, data: null };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return failure(response.status, readError(body), readMessage(body));
  }
  return { ok: true, data: body };
}

function asStory(result: ApiResult<unknown>): ApiResult<Story> {
  if (!result.ok) {
    return result;
  }
  if (!isStory(result.data)) {
    return failure(502, "invalid_response", "The story response was not usable.");
  }
  return { ok: true, data: result.data };
}

function failure(status: number, error: string, message: string): ApiFailure {
  return { ok: false, status, error, message };
}

function readError(body: unknown): string {
  if (isRecord(body) && typeof body.error === "string") {
    return body.error;
  }
  return "request_failed";
}

function readMessage(body: unknown): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim() !== "") {
    return body.message;
  }
  return "The request failed.";
}

export function getStatus(): Promise<ApiResult<ServiceStatus>> {
  return request("/api/status").then((result) => {
    if (!result.ok) {
      return result;
    }
    if (!isStatus(result.data)) {
      return failure(502, "invalid_response", "The status response was not usable.");
    }
    return { ok: true, data: result.data };
  });
}

export function listStories(saved?: boolean): Promise<ApiResult<Story[]>> {
  const query = saved === undefined ? "" : `?saved=${saved ? "true" : "false"}`;
  return request(`/api/stories${query}`).then((result) => {
    if (!result.ok) {
      return result;
    }
    if (!isRecord(result.data) || !Array.isArray(result.data.stories)) {
      return failure(502, "invalid_response", "The library response was not usable.");
    }
    return { ok: true, data: result.data.stories.filter(isStory) };
  });
}

export function createStory(input: {
  title?: string;
  consent: boolean;
  transcript?: string;
}): Promise<ApiResult<Story>> {
  return request("/api/stories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(asStory);
}

export function createDemoStory(): Promise<ApiResult<Story>> {
  return request("/api/stories/demo", { method: "POST" }).then(asStory);
}

export function getStory(id: string): Promise<ApiResult<Story>> {
  return request(`/api/stories/${encodeURIComponent(id)}`).then(asStory);
}

export function patchStory(id: string, patch: StoryPatch): Promise<ApiResult<Story>> {
  return request(`/api/stories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).then(asStory);
}

export function deleteStory(id: string): Promise<ApiResult<null>> {
  return request(`/api/stories/${encodeURIComponent(id)}`, { method: "DELETE" }).then((result) => {
    if (!result.ok) {
      return result;
    }
    return { ok: true, data: null };
  });
}

export function uploadAudio(id: string, audio: Blob, mime: string): Promise<ApiResult<Story>> {
  return request(`/api/stories/${encodeURIComponent(id)}/audio`, {
    method: "POST",
    headers: { "content-type": mime },
    body: audio,
  }).then(asStory);
}

export function transcribeStory(id: string): Promise<ApiResult<Story>> {
  return request(`/api/stories/${encodeURIComponent(id)}/transcribe`, { method: "POST" }).then(asStory);
}

export function generateInsights(id: string): Promise<ApiResult<Story>> {
  return request(`/api/stories/${encodeURIComponent(id)}/insights`, { method: "POST" }).then(asStory);
}

export async function downloadExport(id: string): Promise<ApiResult<null>> {
  let response: Response;
  try {
    response = await fetch(`/api/stories/${encodeURIComponent(id)}/export`);
  } catch {
    return failure(0, "offline", "The API is not reachable on this computer.");
  }
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return failure(response.status, readError(body), readMessage(body));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `evertold-${id}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true, data: null };
}

function isStatus(value: unknown): value is ServiceStatus {
  if (!isRecord(value) || !isRecord(value.transcription) || !isRecord(value.gemma)) {
    return false;
  }
  return (
    typeof value.transcription.available === "boolean" &&
    typeof value.transcription.message === "string" &&
    typeof value.gemma.available === "boolean" &&
    typeof value.gemma.message === "string" &&
    (value.gemma.model === null || typeof value.gemma.model === "string")
  );
}

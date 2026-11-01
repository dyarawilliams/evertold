import { z } from "zod";
import { isRecord, type FetchLike } from "./fetch.js";

const whisperSchema = z.object({
  source: z.literal("whisper"),
  model: z.string().min(1),
  text: z.string().trim().min(1),
  segments: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
      }),
    )
    .optional(),
});

export type WhisperTranscript = z.infer<typeof whisperSchema>;

export type TranscriptionResult =
  | { ok: true; transcript: WhisperTranscript }
  | { ok: false; status: number; error: string; message: string };

const UNAVAILABLE = {
  ok: false as const,
  status: 503,
  error: "whisper_unavailable",
  message: "Whisper is not reachable. No transcript was created.",
};

export async function transcribeAudio(options: {
  serviceUrl: string;
  audio: Buffer;
  mime: string;
  fetchImpl: FetchLike;
}): Promise<TranscriptionResult> {
  let response: Response;
  try {
    response = await options.fetchImpl(joinUrl(options.serviceUrl, "/transcribe"), {
      method: "POST",
      headers: { "content-type": options.mime },
      body: new Uint8Array(options.audio),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return UNAVAILABLE;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: readCode(payload) ?? "whisper_unavailable",
      message:
        readMessage(payload) ??
        "Whisper did not transcribe this recording. No transcript was created.",
    };
  }

  const parsed = whisperSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      error: "whisper_invalid",
      message: "Whisper returned a response that was not usable. No transcript was saved.",
    };
  }
  return { ok: true, transcript: parsed.data };
}

function joinUrl(base: string, pathname: string): string {
  return `${base.replace(/\/$/, "")}${pathname}`;
}

function readCode(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.error !== "string") {
    return null;
  }
  return payload.error;
}

function readMessage(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.message !== "string" || payload.message.trim() === "") {
    return null;
  }
  return payload.message;
}

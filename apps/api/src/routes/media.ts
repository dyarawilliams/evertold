import fs from "node:fs";
import express, { Router, type Request, type Response } from "express";
import { parseStoryId, sendError } from "../http/respond.js";
import { attachAudio, getStory, readAudio, safeAudioPath, saveWhisperTranscript } from "../stories/repository.js";
import { transcribeAudio } from "../services/transcriptionClient.js";

export const mediaRouter = Router();

const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
};

mediaRouter.post(
  "/api/stories/:id/audio",
  express.raw({
    limit: MAX_AUDIO_BYTES,
    type: (req) => mimeBase(req.headers["content-type"]).startsWith("audio/"),
  }),
  (req, res) => {
    const story = requireStory(req, res);
    if (!story) {
      return;
    }
    if (!story.consent) {
      sendError(res, 403, "consent_required", "Consent is required before storing a recording.");
      return;
    }
    const mime = mimeBase(req.headers["content-type"]);
    const extension = AUDIO_EXTENSIONS[mime];
    if (!extension) {
      sendError(
        res,
        415,
        "unsupported_audio",
        "Upload a WAV, MP3, M4A, WebM, OGG, or AAC recording.",
      );
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      sendError(res, 400, "empty_audio", "The recording file was empty.");
      return;
    }
    if (req.body.length > MAX_AUDIO_BYTES) {
      sendError(res, 413, "audio_too_large", "That recording is larger than 40 MB.");
      return;
    }

    const saved = attachAudio(
      req.app.locals.database,
      req.app.locals.services.audioDir,
      story.id,
      mime,
      req.body,
      extension,
    );
    if (!saved) {
      sendError(res, 404, "not_found", "That story is not on this computer.");
      return;
    }
    res.setHeader("cache-control", "private, no-store");
    res.status(200).json(saved);
  },
);

mediaRouter.get("/api/stories/:id/audio", (req, res) => {
  const story = requireStory(req, res);
  if (!story) {
    return;
  }
  const audio = readAudio(req.app.locals.database, story.id);
  if (!audio) {
    sendError(res, 404, "not_found", "This story does not have a recording.");
    return;
  }
  const fullPath = safeAudioPath(req.app.locals.services.audioDir, audio.filename);
  if (!fullPath || !fs.existsSync(fullPath)) {
    sendError(res, 404, "not_found", "This story does not have a recording.");
    return;
  }
  sendAudio(req, res, fullPath, audio.mime);
});

mediaRouter.post("/api/stories/:id/transcribe", async (req, res, next) => {
  try {
    const story = requireStory(req, res);
    if (!story) {
      return;
    }
    if (story.demo) {
      sendError(
        res,
        400,
        "demo_story",
        "This synthetic story is not audio. It was not transcribed by Whisper.",
      );
      return;
    }
    if (!story.consent) {
      sendError(res, 403, "consent_required", "Consent is required before transcription.");
      return;
    }
    const audio = readAudio(req.app.locals.database, story.id);
    const serviceUrl = req.app.locals.services.transcriptionUrl;
    if (!audio || !serviceUrl) {
      sendError(
        res,
        audio ? 503 : 400,
        audio ? "whisper_unavailable" : "no_audio",
        audio
          ? "Whisper is not configured. No transcript was created."
          : "Add a recording before asking Whisper to transcribe it.",
      );
      return;
    }
    const fullPath = safeAudioPath(req.app.locals.services.audioDir, audio.filename);
    if (!fullPath || !fs.existsSync(fullPath)) {
      sendError(res, 404, "not_found", "This story does not have a recording.");
      return;
    }

    const result = await transcribeAudio({
      serviceUrl,
      audio: fs.readFileSync(fullPath),
      mime: audio.mime,
      fetchImpl: req.app.locals.services.fetchImpl,
    });
    if (!result.ok) {
      sendError(res, result.status, result.error, result.message);
      return;
    }

    const saved = saveWhisperTranscript(
      req.app.locals.database,
      story.id,
      result.transcript.text,
      result.transcript.model,
    );
    if (!saved) {
      sendError(res, 404, "not_found", "That story is not on this computer.");
      return;
    }
    res.setHeader("cache-control", "private, no-store");
    res.status(200).json(saved);
  } catch (error) {
    next(error);
  }
});

function requireStory(req: Request, res: Response) {
  const id = parseStoryId(req.params.id);
  if (!id) {
    sendError(res, 404, "not_found", "That story is not on this computer.");
    return null;
  }
  const story = getStory(req.app.locals.database, id);
  if (!story) {
    sendError(res, 404, "not_found", "That story is not on this computer.");
    return null;
  }
  return story;
}

function sendAudio(req: Request, res: Response, fullPath: string, mime: string): void {
  const stat = fs.statSync(fullPath);
  res.setHeader("content-type", mime);
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("accept-ranges", "bytes");

  const range = req.headers.range;
  if (!range) {
    res.status(200);
    res.setHeader("content-length", String(stat.size));
    fs.createReadStream(fullPath).pipe(res);
    return;
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader("content-range", `bytes */${stat.size}`).end();
    return;
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (start >= stat.size || end >= stat.size || start > end) {
    res.status(416).setHeader("content-range", `bytes */${stat.size}`).end();
    return;
  }
  res.status(206);
  res.setHeader("content-range", `bytes ${start}-${end}/${stat.size}`);
  res.setHeader("content-length", String(end - start + 1));
  fs.createReadStream(fullPath, { start, end }).pipe(res);
}

function mimeBase(contentType: string | string[] | undefined): string {
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  return (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

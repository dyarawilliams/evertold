import { Router, type Request, type Response } from "express";
import { validateBody } from "../http/validate.js";
import { parseStoryId, sendError, sendJson } from "../http/respond.js";
import {
  createDemoStory,
  createStory,
  deleteStory,
  getStory,
  listStories,
  updateStory,
} from "../stories/repository.js";
import { createStorySchema, patchStorySchema, type Story } from "../stories/types.js";

export const storiesRouter = Router();

storiesRouter.get("/api/stories", (req, res) => {
  const saved = savedFilter(req.query.saved);
  if (saved === "invalid") {
    sendError(res, 400, "invalid_request", "Use saved=true or saved=false.");
    return;
  }
  sendJson(res, 200, { stories: listStories(req.app.locals.database, saved) });
});

storiesRouter.post("/api/stories", validateBody(createStorySchema), (req, res) => {
  const input = createStorySchema.parse(req.body);
  const story = createStory(req.app.locals.database, input);
  sendJson(res, 201, story);
});

storiesRouter.post("/api/stories/demo", (req, res) => {
  const story = createDemoStory(req.app.locals.database);
  sendJson(res, 201, story);
});

storiesRouter.get("/api/stories/:id/export", (req, res) => {
  const story = findStory(req, res);
  if (!story) {
    return;
  }
  res.setHeader("content-disposition", `attachment; filename="evertold-${story.id}.json"`);
  sendJson(res, 200, {
    exportedAt: new Date().toISOString(),
    notice: story.demo
      ? "Synthetic demonstration. This story was not produced by Whisper or Gemma."
      : "Export of a story stored on this computer. Insight sources are labeled on the story.",
    story,
  });
});

storiesRouter.get("/api/stories/:id", (req, res) => {
  const story = findStory(req, res);
  if (!story) {
    return;
  }
  sendJson(res, 200, story);
});

storiesRouter.patch("/api/stories/:id", validateBody(patchStorySchema), (req, res) => {
  const id = parseStoryId(req.params.id);
  if (!id) {
    sendError(res, 404, "not_found", "That story is not on this computer.");
    return;
  }
  const result = updateStory(req.app.locals.database, id, patchStorySchema.parse(req.body));
  if (!result.ok) {
    sendError(res, result.status, result.error, result.message);
    return;
  }
  sendJson(res, 200, result.story);
});

storiesRouter.delete("/api/stories/:id", (req, res) => {
  const id = parseStoryId(req.params.id);
  if (!id) {
    sendError(res, 404, "not_found", "That story is not on this computer.");
    return;
  }
  const deleted = deleteStory(req.app.locals.database, req.app.locals.services.audioDir, id);
  if (!deleted) {
    sendError(res, 404, "not_found", "That story is not on this computer.");
    return;
  }
  res.setHeader("cache-control", "private, no-store");
  res.status(204).end();
});

function findStory(req: Request, res: Response): Story | null {
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

function savedFilter(value: unknown): boolean | undefined | "invalid" {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return "invalid";
}

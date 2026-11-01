import { Router } from "express";
import { parseStoryId, sendError, sendJson } from "../http/respond.js";
import { groundInsights } from "../stories/ground.js";
import { getStory, saveGeneratedInsights } from "../stories/repository.js";
import { loadInsightsPrompt, requestInsightDraft } from "../services/ollama.js";

export const insightsRouter = Router();

const UNAVAILABLE =
  "Gemma is not reachable through Ollama. No insights were generated.";

insightsRouter.post("/api/stories/:id/insights", async (req, res, next) => {
  try {
    const id = parseStoryId(req.params.id);
    if (!id) {
      sendError(res, 404, "not_found", "That story is not on this computer.");
      return;
    }
    const story = getStory(req.app.locals.database, id);
    if (!story) {
      sendError(res, 404, "not_found", "That story is not on this computer.");
      return;
    }
    if (story.demo) {
      sendJson(res, 200, story);
      return;
    }
    if (story.transcript.trim() === "") {
      sendError(res, 400, "transcript_required", "Add a transcript before asking for insights.");
      return;
    }

    const services = req.app.locals.services;
    if (!services.ollamaBaseUrl || !services.ollamaModel || !services.repoRoot) {
      sendError(res, 503, "gemma_unavailable", UNAVAILABLE);
      return;
    }
    const prompt = loadInsightsPrompt(services.repoRoot);
    if (!prompt) {
      sendError(
        res,
        503,
        "gemma_unavailable",
        "The insights prompt is missing. No insights were generated.",
      );
      return;
    }

    const drafted = await requestInsightDraft({
      baseUrl: services.ollamaBaseUrl,
      model: services.ollamaModel,
      prompt,
      transcript: story.transcript,
      fetchImpl: services.fetchImpl,
    });
    if (!drafted.ok) {
      sendError(
        res,
        drafted.reason === "unavailable" ? 503 : 502,
        drafted.reason === "unavailable" ? "gemma_unavailable" : "gemma_invalid",
        drafted.reason === "unavailable"
          ? UNAVAILABLE
          : "Gemma returned a response that was not usable. No insights were saved.",
      );
      return;
    }

    const grounded = groundInsights(story.transcript, drafted.draft, {
      source: "ollama",
      model: services.ollamaModel,
      edited: false,
    });
    if (!grounded.ok) {
      sendError(res, 422, "ungrounded_insights", grounded.message);
      return;
    }

    const saved = saveGeneratedInsights(req.app.locals.database, story.id, grounded.insights);
    if (!saved) {
      sendError(res, 404, "not_found", "That story is not on this computer.");
      return;
    }
    sendJson(res, 200, saved);
  } catch (error) {
    next(error);
  }
});

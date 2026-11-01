import { Router } from "express";
import { sendJson } from "../http/respond.js";
import { readServiceStatus } from "../services/status.js";

export const statusRouter = Router();

statusRouter.get("/api/status", async (req, res, next) => {
  try {
    const services = req.app.locals.services;
    const status = await readServiceStatus({
      transcriptionUrl: services.transcriptionUrl,
      ollamaBaseUrl: services.ollamaBaseUrl,
      ollamaModel: services.ollamaModel,
      fetchImpl: services.fetchImpl,
    });
    sendJson(res, 200, status);
  } catch (error) {
    next(error);
  }
});

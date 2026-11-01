import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

function sendHealth(_req: Request, res: Response): void {
  res.json({ status: "ok", service: "api" });
}

// /health is for process checks. /api/health is the same payload behind the Vite /api proxy.
healthRouter.get("/health", sendHealth);
healthRouter.get("/api/health", sendHealth);

import type { Response } from "express";

export function sendJson(res: Response, status: number, body: unknown): void {
  res.setHeader("cache-control", "private, no-store");
  res.status(status).json(body);
}

export function sendError(res: Response, status: number, error: string, message: string): void {
  sendJson(res, status, { error, message });
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function parseStoryId(value: string | string[] | undefined): string | null {
  const id = routeParam(value);
  return UUID.test(id) ? id : null;
}

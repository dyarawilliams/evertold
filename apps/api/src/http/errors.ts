import type { ErrorRequestHandler } from "express";

type JsonParseError = SyntaxError & {
  status?: number;
  type?: string;
};

function isJsonParseError(error: unknown): error is JsonParseError {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "internal_error" });
};

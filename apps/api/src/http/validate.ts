import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export type ValidationIssue = {
  path: string;
  message: string;
};

export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        path: issue.path.map((segment) => String(segment)).join("."),
        message: issue.message,
      }));
      res.status(400).json({ error: "invalid_request", issues });
      return;
    }

    req.body = result.data;
    next();
  };
}

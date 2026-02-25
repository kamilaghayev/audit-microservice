import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join("; ") || "Validation failed";
      res.status(400).json({ error: message, details: parsed.error.flatten() });
      return;
    }
    (req as Request & { body: z.infer<T> }).body = parsed.data;
    next();
  };
}

import { Request, Response, NextFunction } from "express";

/**
 * Custom application error with an HTTP status code.
 * Thrown inside route handlers and caught by the global error handler.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Common Error Factory Classes ───────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super("Validation failed", 422);
    this.errors = errors;
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429);
  }
}

// ─── Async Handler Wrapper ──────────────────────────────────────────────────────

/**
 * Wraps an async Express route handler so that any thrown error is passed to next().
 * Eliminates the need for try/catch blocks in every route.
 *
 * Usage:
 *   router.get("/items", asyncHandler(async (req, res) => {
 *     const items = await db.getItems();
 *     res.json(items);
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Global Error Handler Middleware ────────────────────────────────────────────

/**
 * Express global error handler.
 * Must be registered AFTER all routes: app.use(globalErrorHandler)
 *
 * - Handles AppError instances with their status codes and messages.
 * - Handles Prisma known request errors (unique constraint, not found).
 * - Handles Zod validation errors.
 * - Handles JWT errors.
 * - Falls back to 500 Internal Server Error for unexpected errors.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default values
  let statusCode = 500;
  let message = "Internal server error";
  let details: any = undefined;

  // ── ValidationError (with field-level details) ────────────────────────────
  if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.errors;
  }
  // ── AppError ──────────────────────────────────────────────────────────────
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // ── Prisma errors ─────────────────────────────────────────────────────────
  else if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as any;
    switch (prismaErr.code) {
      case "P2002": {
        statusCode = 409;
        const target = prismaErr.meta?.target;
        message = target
          ? `A record with that ${Array.isArray(target) ? target.join(", ") : target} already exists`
          : "Unique constraint violation";
        break;
      }
      case "P2025": {
        statusCode = 404;
        message = "Record not found";
        break;
      }
      case "P2003": {
        statusCode = 400;
        message = "Foreign key constraint failed";
        break;
      }
      default: {
        statusCode = 400;
        message = "Database request error";
        break;
      }
    }
  }
  // ── Zod validation errors ─────────────────────────────────────────────────
  else if (err.name === "ZodError") {
    statusCode = 422;
    message = "Validation failed";
    const zodErr = err as any;
    details = zodErr.errors?.map((e: any) => ({
      path: e.path.join("."),
      message: e.message,
    }));
  }
  // ── JWT errors ────────────────────────────────────────────────────────────
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }
  // ── Multer file upload errors ─────────────────────────────────────────────
  else if (err.name === "MulterError") {
    statusCode = 400;
    const multerErr = err as any;
    switch (multerErr.code) {
      case "LIMIT_FILE_SIZE":
        message = "File is too large";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field";
        break;
      default:
        message = "File upload error";
    }
  }

  // Log unexpected errors
  if (statusCode === 500) {
    console.error("[Rally Error]", err);
  }

  // Build response body
  const response: Record<string, any> = {
    error: message,
    statusCode,
  };

  if (details) {
    response.details = details;
  }

  // Include stack trace in development mode for 500 errors
  if (process.env.NODE_ENV !== "production" && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export default {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  ValidationError,
  RateLimitError,
  asyncHandler,
  globalErrorHandler,
};

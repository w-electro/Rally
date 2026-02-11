import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";

/**
 * Shape of the JWT payload stored in tokens.
 */
export interface JwtPayload {
  id: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Extend Express Request to include the authenticated user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Extracts and verifies a Bearer token from the Authorization header.
 * Returns the decoded payload or null if invalid/missing.
 */
function extractAndVerifyToken(req: Request): JwtPayload | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Required authentication middleware.
 * Rejects the request with 401 if no valid token is present.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const payload = extractAndVerifyToken(req);

  if (!payload) {
    res.status(401).json({
      error: "Unauthorized",
      message: "A valid authentication token is required to access this resource.",
    });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Optional authentication middleware.
 * Attaches the user if a valid token is present, but does not reject the request otherwise.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
export function authenticateOptional(req: Request, res: Response, next: NextFunction): void {
  const payload = extractAndVerifyToken(req);

  if (payload) {
    req.user = payload;
  }

  next();
}

/**
 * Generate an access token for a user.
 */
export function generateAccessToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiry as string }
  );
}

/**
 * Generate a refresh token for a user.
 */
export function generateRefreshToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiry as string }
  );
}

/**
 * Verify a refresh token and return the decoded payload.
 * Returns null if the token is invalid or expired.
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export default {
  authenticate,
  authenticateOptional,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};

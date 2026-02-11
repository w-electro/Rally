import jwt from 'jsonwebtoken';
import config from '../config';

export interface TokenPayload {
  id: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate an access token for a user.
 * Contains the user's id and username. Expires in 7 days.
 */
export function generateAccessToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/**
 * Generate a refresh token for a user.
 * Contains only the user's id. Expires in 30 days.
 */
export function generateRefreshToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtRefreshSecret,
    { expiresIn: '30d' }
  );
}

/**
 * Verify an access token and return its decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

/**
 * Verify a refresh token and return its decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

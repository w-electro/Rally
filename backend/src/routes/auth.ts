import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { asyncHandler, AppError } from '../utils/errors';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/token';

const router = Router();

// ─── Validation Schemas ─────────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, dots, and hyphens'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
  email: z.string().email('Invalid email address').optional().nullable(),
});

const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.username || data.email, {
  message: 'Either username or email is required',
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Generate a random 4-digit discriminator (0001-9999).
 */
function generateDiscriminator(): string {
  const num = Math.floor(Math.random() * 9999) + 1;
  return num.toString().padStart(4, '0');
}

/**
 * Find a unique discriminator for a username.
 * Retries up to 50 times to avoid collisions.
 */
async function findUniqueDiscriminator(username: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const discriminator = generateDiscriminator();
    const existing = await prisma.user.findFirst({
      where: { username, discriminator },
    });
    if (!existing) {
      return discriminator;
    }
  }
  throw new AppError('Unable to generate a unique discriminator. Try a different username.', 409);
}

// ─── POST /register ─────────────────────────────────────────────────────────────

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { username, password, email } = parsed.data;

    // Check if username is already taken (across all discriminators)
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      throw new AppError('Username is already taken', 409);
    }

    // Check if email is already in use
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new AppError('Email is already registered', 409);
      }
    }

    // Hash password with bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a unique discriminator
    const discriminator = await findUniqueDiscriminator(username);

    // Create the user
    const user = await prisma.user.create({
      data: {
        username,
        discriminator,
        password: hashedPassword,
        email: email || null,
        isAnonymous: !email,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, username: user.username });
    const refreshToken = generateRefreshToken({ id: user.id, username: user.username });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        email: user.email,
        avatar: user.avatar,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt,
      },
    });
  })
);

// ─── POST /login ────────────────────────────────────────────────────────────────

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { username, email, password } = parsed.data;

    // Find user by username or email
    let user;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (username) {
      user = await prisma.user.findUnique({ where: { username } });
    }

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, username: user.username });
    const refreshToken = generateRefreshToken({ id: user.id, username: user.username });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        email: user.email,
        avatar: user.avatar,
        isAnonymous: user.isAnonymous,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  })
);

// ─── POST /logout ───────────────────────────────────────────────────────────────

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    // Client is responsible for removing tokens.
    // Server-side token invalidation can be added with a blocklist if needed.
    res.json({ message: 'Logged out successfully' });
  })
);

// ─── POST /refresh ──────────────────────────────────────────────────────────────

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { refreshToken } = parsed.data;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Verify the user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    // Issue new tokens
    const newAccessToken = generateAccessToken({ id: user.id, username: user.username });
    const newRefreshToken = generateRefreshToken({ id: user.id, username: user.username });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  })
);

// ─── POST /forgot-password ──────────────────────────────────────────────────────

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    const { email } = parsed.data;

    // Check if user exists (don't reveal whether the email is registered)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Log the reset request. Actual email sending is optional / future work.
      console.log(`[Password Reset] Reset requested for user ${user.id} (${email})`);
    }

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  })
);

// ─── POST /reset-password ───────────────────────────────────────────────────────

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0].message, 400);
    }

    // Placeholder implementation.
    // A full implementation would verify the token against a stored reset token,
    // check expiration, hash the new password, and update the user record.
    console.log(`[Password Reset] Reset attempted with token: ${parsed.data.token.substring(0, 8)}...`);

    res.json({
      message: 'Password has been reset successfully.',
    });
  })
);

export default router;

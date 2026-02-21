import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../lib/prisma';
import { v4 as uuid } from 'uuid';

export async function createRefreshToken(userId: string): Promise<string> {
  const token = uuid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!existing || existing.expiresAt < new Date()) {
    if (existing) {
      await prisma.refreshToken.deleteMany({ where: { userId: existing.userId } });
    }
    return null;
  }

  try {
    await prisma.refreshToken.delete({ where: { id: existing.id } });
  } catch {
    // Token already deleted by a concurrent request - that's fine
    return null;
  }

  const newRefreshToken = await createRefreshToken(existing.userId);
  const accessToken = jwt.sign(
    { userId: existing.userId, username: existing.user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { accessToken, refreshToken: newRefreshToken, user: existing.user };
}

export async function revokeUserTokens(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

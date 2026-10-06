import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export function generateAccessToken(userId: string, email: string) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ id: userId, email }, process.env.JWT_SECRET, { expiresIn: '15m', jwtid: randomUUID() });
}
export function generateRefreshToken(userId: string) {
  if (!process.env.REFRESH_SECRET) throw new Error('REFRESH_SECRET is not configured');
  return jwt.sign({ id: userId }, process.env.REFRESH_SECRET, { expiresIn: '7d', jwtid: randomUUID() });
}

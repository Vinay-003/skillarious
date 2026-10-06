import { expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from './generateToken.ts';
it('rotates distinct refresh tokens even within the same second and uses bounded TTLs', () => {
  vi.stubEnv('JWT_SECRET', 'unit-test-secret'); vi.stubEnv('REFRESH_SECRET', 'unit-test-refresh');
  try {
    expect(generateRefreshToken('test-user')).not.toBe(generateRefreshToken('test-user'));
    const access = jwt.decode(generateAccessToken('test-user', 'test@example.test')) as jwt.JwtPayload;
    expect(access.exp! - access.iat!).toBe(900);
  } finally { vi.unstubAllEnvs(); }
});

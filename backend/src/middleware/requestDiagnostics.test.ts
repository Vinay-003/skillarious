import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { requestDiagnostics } from './requestDiagnostics.ts';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('logs a request template and status without query, body, headers or identifiers', () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('LOG_REQUESTS', '1');
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const res: any = new EventEmitter(); res.setHeader = vi.fn(); res.statusCode = 503;
  const next = vi.fn();
  requestDiagnostics({ method: 'POST', route: { path: '/verify' }, url: '/verify?otp=private-code', body: { password: 'private-password' }, headers: { authorization: 'private-token' } } as any, res, next);
  res.emit('finish');
  const entry = JSON.parse(log.mock.calls[0][0]);
  expect(entry).toMatchObject({ event: 'http_request', method: 'POST', route: '/verify', status: 503 });
  expect(entry.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(JSON.stringify(entry)).not.toContain('private'); expect(next).toHaveBeenCalledOnce();
});
it('can disable diagnostics while retaining a generated request id', () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('LOG_REQUESTS', '0');
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const res: any = new EventEmitter(); res.setHeader = vi.fn();
  requestDiagnostics({ method: 'GET' } as any, res, vi.fn()); res.emit('finish');
  expect(log).not.toHaveBeenCalled(); expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
});

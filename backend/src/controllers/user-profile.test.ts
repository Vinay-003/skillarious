import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ writes: [] as Record<string, unknown>[], error: false }));
vi.mock('../db/index.js', () => ({ db: {
  select: () => ({ from: () => ({ where: async () => [{ id: 'fixture-user' }] }) }),
  update: () => ({ set: (data: Record<string, unknown>) => ({ where: () => ({ returning: async () => {
    if (state.error) throw new Error('fixture private query payload');
    state.writes.push(data); return [{ ...data, password: 'private', refreshToken: 'private' }];
  } }) }) }),
} }));
import { updateProfile } from './User.ts';
function response() { const res: any = { statusCode: 200 }; res.status = vi.fn((code: number) => { res.statusCode = code; return res; }); res.json = vi.fn((body: unknown) => { res.body = body; return res; }); return res; }
beforeEach(() => { state.writes = []; state.error = false; });
describe('profile input boundaries', () => {
  it.each([{ name: {} }, { name: ' ' }, { name: 'x'.repeat(101) }, { name: 'Name', age: '12junk' }, { name: 'Name', age: 0 }, { name: 'Name', age: 121 }, { name: 'Name', phone: 123 }])('rejects malformed profile fields without writes', async body => {
    const res = response(); await updateProfile({ user: { id: 'fixture-user' }, body } as any, res);
    expect(res.statusCode).toBe(400); expect(state.writes).toHaveLength(0);
  });
  it('trims name, clears age and cannot write roles or credentials', async () => {
    const res = response(); await updateProfile({ user: { id: 'fixture-user' }, body: { name: ' Name ', age: null, isAdmin: true, role: 'admin', password: 'private' } } as any, res);
    expect(res.statusCode).toBe(200); expect(state.writes[0]).toEqual({ name: 'Name', age: null });
    expect(res.body.data.password).toBeUndefined(); expect(res.body.data.refreshToken).toBeUndefined();
  });
});

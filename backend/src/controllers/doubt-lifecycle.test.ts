import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ inserted: null as any, access: 'enrolled' as string | null, rows: [] as any[] }));
vi.mock('../db/index.ts', () => ({ db: {
  insert: () => ({ values: (value: any) => { state.inserted = value; return { returning: async () => [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', ...value }] }; } }),
  select: () => { const chain: any = { from: () => chain, where: () => chain, orderBy: async () => state.rows, limit: async () => state.rows }; return chain; },
} }));
vi.mock('../utils/access.ts', async importOriginal => ({ ...await importOriginal<any>(), getCourseForContent: async () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', getContentAccess: async () => state.access }));
import { createDoubt, getDoubts } from './Doubt.ts';
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
function response() { const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }; return res; }
beforeEach(() => { state.inserted = null; state.access = 'enrolled'; state.rows = []; });
it('persists required legacy message along with title and description', async () => {
  const res = response(); await createDoubt({ user, body: { contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: ' Photosynthesis ', description: ' Explain light reactions ' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(201); expect(state.inserted.message).toBe('Explain light reactions'); expect(state.inserted.resolved).toBe(false);
});
it('cannot create a doubt outside enrollment', async () => {
  state.access = null; const res = response(); await createDoubt({ user, body: { contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Title', description: 'Description' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(403); expect(state.inserted).toBeNull();
});
it('all filter loads the student list instead of reporting invalid filter', async () => {
  const res = response(); await getDoubts({ user, query: { filter: 'all' } } as any, res);
  expect(res.status).not.toHaveBeenCalledWith(400); expect(res.json).toHaveBeenCalledWith({ success: true, doubts: [] });
});

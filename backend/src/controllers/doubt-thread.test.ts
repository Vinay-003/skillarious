import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ doubt: null as any, access: 'enrolled' as string | null, messages: [] as any[], updated: null as any, locked: false }));
vi.mock('../db/index.ts', () => {
  const store: any = {
    select: () => { const query: any = { from: () => query, where: () => query, for: () => { state.locked = true; return query; }, limit: async () => state.doubt ? [{ ...state.doubt }] : [] }; return query; },
    insert: () => ({ values: (values: any) => ({ returning: async () => { const message = { id: 'message', ...values }; state.messages.push(message); return [message]; } }) }),
    update: () => ({ set: (values: any) => { state.updated = values; const query: any = { where: () => { Object.assign(state.doubt, values); return query; }, returning: async () => [state.doubt], then: (resolve: any) => resolve([]) }; return query; } }),
  }; store.transaction = async (work: any) => work(store); return { db: store };
});
vi.mock('../utils/access.ts', async importOriginal => ({ ...await importOriginal<any>(), getCourseForContent: async () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', getContentAccess: async () => state.access }));
import { createDoubt, replyToDoubt, resolveDoubt } from './Doubt.ts';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const doubtId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const request = (id = userId) => ({ user: { id }, params: { id: doubtId }, body: { content: 'How does this work?' } });
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
beforeEach(() => { state.doubt = { id: doubtId, userId, contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'open', resolved: false }; state.access = 'enrolled'; state.messages = []; state.updated = null; state.locked = false; });
it('student follow-up stays open and owning educator answer is labeled as a response', async () => {
  let res = response(); await replyToDoubt(request() as any, res as any);
  expect(res.status).toHaveBeenCalledWith(201); expect(state.messages[0].isResponse).toBe(false); expect(state.doubt.status).toBe('open');
  state.access = 'owner'; res = response(); await replyToDoubt(request('educator') as any, res as any);
  expect(res.status).toHaveBeenCalledWith(201); expect(state.messages[1].isResponse).toBe(true); expect(state.doubt.status).toBe('answered');
});
it('another enrolled student cannot reply to or resolve a private thread', async () => {
  const res = response(); await replyToDoubt(request('other-student') as any, res as any);
  expect(res.status).toHaveBeenCalledWith(403); expect(state.messages).toHaveLength(0);
  const resolve = response(); await resolveDoubt(request('other-student') as any, resolve as any);
  expect(resolve.status).toHaveBeenCalledWith(403); expect(state.updated).toBeNull();
});
it('refunded student cannot post new private course replies', async () => {
  state.access = null; const res = response(); await replyToDoubt(request() as any, res as any);
  expect(res.status).toHaveBeenCalledWith(403); expect(state.messages).toHaveLength(0);
});
it('resolved thread rejects student follow-up without changing saved state', async () => {
  state.doubt.resolved = true; state.doubt.status = 'resolved'; const res = response(); await replyToDoubt(request() as any, res as any);
  expect(res.status).toHaveBeenCalledWith(409); expect(state.messages).toHaveLength(0); expect(state.doubt.resolved).toBe(true);
});
it('resolve persists both status fields and replies recheck resolved state under a lock', async () => {
  const res = response(); await resolveDoubt(request() as any, res as any);
  expect(state.updated).toEqual({ resolved: true, status: 'resolved' });
  state.doubt.resolved = false; await replyToDoubt(request() as any, response() as any);
  expect(state.locked).toBe(true);
});
it('invalid typed and oversized question payloads are rejected before insert', async () => {
  for (const body of [{ title: 42, description: 'Question' }, { title: 'x'.repeat(201), description: 'Question' }, { title: 'Title', description: 'x'.repeat(10001) }]) {
    const res = response(); await createDoubt({ user: { id: userId }, body: { contentId: state.doubt.contentId, ...body } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
  }
  expect(state.messages).toHaveLength(0);
});

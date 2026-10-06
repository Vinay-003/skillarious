import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn(), update: vi.fn() } }));
vi.mock('../db/index.ts', () => ({ db }));
import { addPlaylistCourse, createPlaylist, deletePlaylist, recordHistory, setLike, setSubscription } from './Library.ts';

const userId = 'd940b3f7-e532-41a7-bd94-eae81417f450';
const courseId = '5d72360b-3698-4a45-a5a2-eb6d788c3035';
const playlistId = 'cde6bfa3-6837-40da-b7fd-dd9901992161';
const res = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as any;
const req = (params: object = {}, body: object = {}) => ({ user: { id: userId }, params, body }) as any;
const query = (rows: unknown[]) => {
  const q: any = {};
  for (const name of ['from', 'innerJoin', 'leftJoin', 'where', 'limit', 'orderBy', 'groupBy']) q[name] = vi.fn().mockReturnValue(q);
  q.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return q;
};

describe('student library writes', () => {
  beforeEach(() => vi.resetAllMocks());
  it('validates identifiers before querying or writing', async () => {
    const response = res();
    await setLike(req({ courseId: 'invalid' }), response);
    await setSubscription(req({ educatorId: 'invalid' }), response);
    await recordHistory(req({ courseId: 'invalid' }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('requires a real owned playlist before adding a course', async () => {
    db.select.mockReturnValue(query([]));
    const response = res();
    await addPlaylistCourse(req({ playlistId, courseId }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('requires a real owned playlist before deletion', async () => {
    db.delete.mockReturnValue({ where: () => ({ returning: async () => [] }) });
    const response = res();
    await deletePlaylist(req({ playlistId }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });
  it('rejects empty playlist names without writes', async () => {
    const response = res();
    await createPlaylist(req({}, { name: '   ' }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

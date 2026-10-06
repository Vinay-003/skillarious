import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as any[], failure: null as Error | null, select: vi.fn() }));
vi.mock('../db/index.ts', () => ({ db: { select: state.select } }));

import { getAverageRating, getCourseReviews } from './Review.ts';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const invoke = async (handler: typeof getAverageRating, id = courseId) => {
  const res = response();
  await handler({ params: { courseId: id } } as any, res as any);
  return res;
};

beforeEach(() => {
  state.rows = [];
  state.failure = null;
  state.select.mockReset().mockImplementation(() => {
    const query: any = {
      from: () => query,
      where: () => query,
      orderBy: () => state.failure ? Promise.reject(state.failure) : Promise.resolve(state.rows),
      then: (resolve: any, reject: any) => state.failure ? Promise.reject(state.failure).then(resolve, reject) : Promise.resolve(state.rows).then(resolve, reject),
    };
    return query;
  });
});

describe.each([
  ['reviews', getCourseReviews],
  ['average', getAverageRating],
] as const)('%s public handler', (_name, handler) => {
  it('rejects malformed course IDs without touching the database', async () => {
    const res = await invoke(handler, 'not-a-uuid');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid course ID' });
    expect(state.select).not.toHaveBeenCalled();
  });

  it('returns a genuine server error without exposing or logging a raw database exception', async () => {
    const secret = 'private database query details';
    state.failure = new Error(secret);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await invoke(handler);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(JSON.stringify(res.json.mock.calls)).not.toContain(secret);
      expect(log.mock.calls.flat().some(argument => argument instanceof Error && argument.message.includes(secret))).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
});

it('returns empty reviews for a valid nonexistent course and passes through results', async () => {
  let res = await invoke(getCourseReviews);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ success: true, reviews: [] });
  state.rows = [{ id: 'review-1', rating: 5 }];
  res = await invoke(getCourseReviews);
  expect(res.json).toHaveBeenCalledWith({ success: true, reviews: state.rows });
});

it('returns numeric zero for an empty average and converts finite database strings', async () => {
  for (const [raw, expected] of [[null, 0], ['4.25', 4.25], ['Infinity', 0], ['not a number', 0]] as const) {
    state.rows = [{ averageRating: raw }];
    const res = await invoke(getAverageRating);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, averageRating: expected });
  }
});

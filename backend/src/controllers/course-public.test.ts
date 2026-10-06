import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const { db } = vi.hoisted(() => ({ db: { select: vi.fn() } }));
vi.mock('../db/index.ts', () => ({ db }));
import { getSingleCourse, searchCourses, getCoursesByCategory, getCoursesByEducator } from './Course.ts';

const id = '5d72360b-3698-4a45-a5a2-eb6d788c3035';
const dialect = new PgDialect();
let conditions: { sql: string; params: unknown[] }[];
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as any;
const query = (rows: unknown[]) => {
  const q: any = {};
  for (const key of ['from', 'innerJoin', 'leftJoin']) q[key] = vi.fn().mockReturnValue(q);
  q.where = vi.fn((condition) => {
    conditions.push(dialect.sqlToQuery(condition));
    return q;
  });
  q.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return q;
};
beforeEach(() => {
  vi.clearAllMocks();
  conditions = [];
  db.select.mockImplementation(() => query([{ id }]));
});

describe('public course input and catalogue filters', () => {
  it.each([
    [getSingleCourse, { params: { id: 'not-a-uuid' } }],
    [getCoursesByEducator, { params: { id: 'not-a-uuid' } }],
    [getCoursesByCategory, { query: {} }],
    [searchCourses, { query: { name: { a: 'bad' } } }],
    [searchCourses, { query: { name: ['bad'] } }],
    [searchCourses, { query: { name: ' '.repeat(3) } }],
    [searchCourses, { query: { description: 'x'.repeat(201) } }],
    [searchCourses, { query: { name: 'valid', about: { nested: 'bad' } } }],
    [getCoursesByCategory, { query: { query: ['bad'] } }],
    [getCoursesByCategory, { query: { query: { nested: 'bad' } } }],
    [getCoursesByCategory, { query: { query: '   ' } }],
    [getCoursesByCategory, { query: { query: 'x'.repeat(201) } }],
  ])('rejects invalid input before querying', async (handler, request) => {
    const res = response();
    await handler(request as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns 404 for well-formed nonexistent course IDs', async () => {
    db.select.mockImplementation(() => query([]));
    const res = response();
    await getSingleCourse({ params: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it('keeps a valid course detail response, including dismissed course lookup', async () => {
    const res = response();
    await getSingleCourse({ params: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id } }));
    expect(conditions[0].sql).not.toContain('is_dismissed');
  });

  it('searches only supplied trimmed prefixes and excludes dismissed courses', async () => {
    const res = response();
    await searchCourses({ query: { name: '  Java  ', about: ' code ' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ courses: [{ id }] }));
    expect(conditions[0].params).toEqual(expect.arrayContaining(['Java%', 'code%', false]));
    expect(conditions[0].params).not.toContain('undefined%');
    expect(conditions[0].sql).toContain('is_dismissed');
  });

  it('supports one search field without generating missing-field predicates', async () => {
    await searchCourses({ query: { name: 'Go' } } as any, response());
    expect(conditions[0].params).toEqual(['Go%', false]);
  });

  it('returns category matches with a trimmed prefix and delisting predicate', async () => {
    const res = response();
    await getCoursesByCategory({ query: { query: '  Science ' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(conditions[0].params).toEqual(expect.arrayContaining(['Science%', false]));
    expect(conditions[0].sql).toContain('is_dismissed');
  });

  it('lists a valid educator’s visible courses', async () => {
    const res = response();
    await getCoursesByEducator({ params: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ courses: [{ id }] }));
    expect(conditions[0].params).toEqual(expect.arrayContaining([id, false]));
    expect(conditions[0].sql).toContain('is_dismissed');
  });
});

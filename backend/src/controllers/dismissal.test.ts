import { describe, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({ db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock('../db/index.ts', () => ({ db }));
import { deleteCourse } from './Course.ts';
import { deleteModule } from './Module.ts';
const id = '5d72360b-3698-4a45-a5a2-eb6d788c3035';
const query = (rows: unknown[]) => {
  const q: any = {};
  for (const key of ['from', 'innerJoin', 'where', 'limit']) q[key] = vi.fn().mockReturnValue(q);
  q.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return q;
};
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as any;
describe('educator removal preserves learner records', () => {
  it('soft dismisses a course instead of deleting it', async () => {
    db.select.mockReturnValueOnce(query([{ courses: { educatorId: id } }])).mockReturnValueOnce(query([{ id }]));
    db.update.mockReturnValue({ set: () => ({ where: async () => [] }) });
    const res = response();
    await deleteCourse({ params: { CourseId: id }, user: { id } } as any, res);
    expect(db.update).toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('soft dismisses a module instead of deleting it', async () => {
    db.select.mockReturnValueOnce(query([{ isEducator: true }])).mockReturnValueOnce(query([{ modules: { id } }]));
    db.update.mockReturnValue({ set: () => ({ where: async () => [] }) });
    const res = response();
    await deleteModule({ params: { moduleId: id }, user: { id } } as any, res);
    expect(db.update).toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

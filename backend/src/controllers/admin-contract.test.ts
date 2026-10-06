import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: { select: vi.fn(), update: vi.fn(), transaction: vi.fn() } }));
vi.mock('../db/index.ts', () => ({ db }));
vi.mock('../utils/sendEmail.ts', () => ({ sendEmail: vi.fn() }));
import { getAdminUsers, getAdminCourses, getAdminLogs, getAdminReports, resolveAdminReport, moderateCourse, registerAdmin } from './Admin.ts';
import { getDoubts } from './Doubt.ts';

const id = 'd940b3f7-e532-41a7-bd94-eae81417f450';
function response() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}
function query(rows: unknown[]) {
  const q: any = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
  for (const key of ['from', 'where', 'orderBy', 'limit']) q[key].mockReturnValue(q);
  q.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return q;
}

describe('admin API contracts', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists users without credential fields', async () => {
    db.select.mockReturnValue(query([{ id, name: 'Member', email: 'm@example.com' }]));
    const res = response();
    await getAdminUsers({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id, name: 'Member', email: 'm@example.com' }] });
  });
  it('lists courses and action logs from storage', async () => {
    db.select.mockReturnValueOnce(query([{ id, name: 'Course' }])).mockReturnValueOnce(query([{ action: 'BAN_USER' }]));
    const courses = response(); const logs = response();
    await getAdminCourses({} as any, courses); await getAdminLogs({} as any, logs);
    expect(courses.json).toHaveBeenCalledWith({ success: true, data: [{ id, name: 'Course' }] });
    expect(logs.json).toHaveBeenCalledWith({ success: true, data: [{ action: 'BAN_USER' }] });
  });
  it('lists persisted reports, never synthesized empty success', async () => {
    db.select.mockReturnValue(query([{ id, status: 'open' }]));
    const res = response(); await getAdminReports({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id, status: 'open' }] });
  });
  it('rejects report resolution without a stored report', async () => {
    db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [] }) }) });
    db.transaction.mockImplementation(async (cb: any) => cb(db));
    const res = response(); await resolveAdminReport({ params: { reportId: id }, body: { resolution: 'Reviewed' }, user: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('does not approve a nonexistent course', async () => {
    db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [] }) }) });
    db.transaction.mockImplementation(async (cb: any) => cb(db));
    const res = response(); await moderateCourse.approveCourse({ params: { courseId: id }, user: { id } } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('rejects invalid invite registration before database writes', async () => {
    const res = response(); await registerAdmin({ body: { name: 'A', email: 'bad', password: '123', inviteToken: '' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('accepts frontend all filter', async () => {
    db.select.mockReturnValue(query([])); const res = response();
    await getDoubts({ query: { filter: 'all' }, user: { id } } as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, doubts: [] });
  });
});

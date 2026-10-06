import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../controllers/Auth.ts', () => ({ authenticateUser: (req: any, res: any, next: any) => req.headers.authorization === 'Bearer allowed' ? (req.user = { id: 'admin' }, next()) : res.sendStatus(401) }));
vi.mock('../middleware/adminAuth.ts', () => ({ isAdmin: (req: any, res: any, next: any) => req.headers.authorization === 'Bearer allowed' ? next() : res.sendStatus(403), isSuperAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../controllers/Admin.ts', () => {
  const list = (_req: any, res: any) => res.json({ success: true, data: [] });
  return { registerAdmin: (_req: any, res: any) => res.status(400).json({ success: false }), getAdminUsers: list, getAdminCourses: list, getAdminLogs: list, getAdminReports: list, resolveAdminReport: list, getPlatformOverview: list, getUserAnalytics: list, getEngagementAnalytics: list, getRevenueAnalytics: list, getReviewAnalytics: list, getEducatorAnalytics: list, inviteAdmin: list, moderateUser: { banUser: list, unbanUser: list }, moderateCourse: { approveCourse: list, dismissCourse: list }, moderateModule: { dismissModule: list }, moderateContent: { dismissContent: list } };
});
vi.mock('../middleware/adminLogger.ts', () => ({ logAdminAction: () => (_req: any, _res: any, next: any) => next() }));
import router from './admin.ts';

const app = express(); app.use(express.json()); app.use('/admin', router);
describe('admin route authentication', () => {
  it('permits invite registration without a bearer token (subject to invite validation)', async () => {
    expect((await request(app).post('/admin/register').send({})).status).toBe(400);
  });
  it('requires authentication for every admin read and approval', async () => {
    for (const path of ['/overview', '/users', '/courses', '/logs', '/reports']) expect((await request(app).get(`/admin${path}`)).status).toBe(401);
    expect((await request(app).post('/admin/moderate/course/123/approve')).status).toBe(401);
  });
  it('mounts list and approval routes behind guard', async () => {
    expect((await request(app).get('/admin/reports').set('Authorization', 'Bearer allowed')).status).toBe(200);
    expect((await request(app).post('/admin/moderate/course/123/approve').set('Authorization', 'Bearer allowed')).status).toBe(200);
  });
});

import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../controllers/Auth.ts', () => ({ authenticateUser: (req: any, res: any, next: any) => req.headers.authorization === 'Bearer allowed' ? (req.user = { id: 'd940b3f7-e532-41a7-bd94-eae81417f450' }, next()) : res.sendStatus(401) }));
vi.mock('../controllers/Student.ts', () => ({ getEnrolledCourses: (_req: any, res: any) => res.json({ success: true, data: [] }) }));
vi.mock('../controllers/Library.ts', () => {
  const list = (_req: any, res: any) => res.json({ success: true, data: [] });
  return { listHistory: list, recordHistory: list, listLikes: list, setLike: list, removeLike: list, listPlaylists: list, createPlaylist: list, deletePlaylist: list, addPlaylistCourse: list, removePlaylistCourse: list, listSubscriptions: list, setSubscription: list, removeSubscription: list };
});
import router from './student.ts';
const app = express(); app.use('/student', router);

describe('student library route authentication', () => {
  it('guards every collection read and write', async () => {
    for (const name of ['history', 'likes', 'playlists', 'subscriptions']) {
      expect((await request(app).get(`/student/${name}`)).status).toBe(401);
    }
    expect((await request(app).post('/student/playlists')).status).toBe(401);
    expect((await request(app).put('/student/likes/123')).status).toBe(401);
    expect((await request(app).delete('/student/playlists/123/courses/456')).status).toBe(401);
  });
  it('mounts authenticated collection endpoints', async () => {
    expect((await request(app).get('/student/playlists').set('Authorization', 'Bearer allowed')).status).toBe(200);
    expect((await request(app).put('/student/history/123').set('Authorization', 'Bearer allowed')).status).toBe(200);
  });
});

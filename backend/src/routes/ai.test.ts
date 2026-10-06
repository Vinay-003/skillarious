import request from 'supertest';
import express from 'express';
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ access: null as string | null, downloads: vi.fn(), answer: vi.fn() }));
vi.mock('../controllers/Auth.ts', () => ({ authenticateUser: (req: any, _res: any, next: any) => { req.user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }; next(); } }));
vi.mock('../utils/access.ts', () => ({ getCourseForContent: async () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', getContentAccess: async () => state.access }));
vi.mock('../utils/storage.ts', () => ({ downloadMedia: state.downloads }));
vi.mock('../db/index.ts', () => ({ db: { select: () => { const builder: any = { from: () => builder, where: () => builder, limit: async () => [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Biology', description: 'Photosynthesis', fileUrl: 'storage://course-content/2026-10/note.txt' }] }; return builder; } } }));
vi.mock('../utils/learningAI.ts', async importOriginal => ({ ...await importOriginal<any>(), requestLearningAnswer: state.answer }));
import aiRoute from './ai.ts';
const app = express(); app.use(express.json()); app.use(aiRoute);
beforeEach(() => { state.access = null; state.downloads.mockReset(); state.answer.mockReset(); });
it('denies unauthorized private notes before download or provider call', async () => {
  const result = await request(app).post('/ask').send({ contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', question: 'Explain photosynthesis' });
  expect(result.status).toBe(403); expect(state.downloads).not.toHaveBeenCalled(); expect(state.answer).not.toHaveBeenCalled();
});
it('rejects arbitrary URL/tool input and ambiguous context', async () => {
  expect((await request(app).post('/ask').send({ question: 'Explain', url: 'http://localhost/private' })).status).toBe(400);
  expect((await request(app).post('/ask').send({ question: 'Explain', courseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).status).toBe(400);
});
it('returns authorized text-only context and server-generated read references', async () => {
  state.access = 'enrolled'; state.downloads.mockResolvedValue(Buffer.from('Photosynthesis uses light energy.')); state.answer.mockResolvedValue({ answer: 'Light becomes energy.', model: 'free/deepseek-v4.1-flash', fallback: false });
  const result = await request(app).post('/ask').send({ contentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', question: 'Explain photosynthesis' });
  expect(result.status).toBe(200); expect(result.body.sources.length).toBeGreaterThan(0); expect(result.body.toolReferences[0].access).toBe('enrolled');
  expect(state.answer.mock.calls[0][1][0].text).toContain('Photosynthesis');
});

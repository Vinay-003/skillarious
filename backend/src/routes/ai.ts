import { Router, type Request, type Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateUser } from '../controllers/Auth.ts';
import { db } from '../db/index.ts';
import { coursesTable, contentTable, doubtsTable, educatorsTable, usersTable, reviewsTable } from '../db/schema.ts';
import { getContentAccess, getCourseForContent } from '../utils/access.ts';
import { downloadMedia } from '../utils/storage.ts';
import { LearningError, rankCourses, requestLearningAnswer, retrieveExcerpts, validateQuestion } from '../utils/learningAI.ts';
import { parsePdfNotes } from '../utils/parseNotes.ts';

const router = Router();
type AuthRequest = Request & { user?: { id: string } };
const askSchema = z.object({ question: z.string().min(1).max(2000), courseId: z.string().uuid().optional(), contentId: z.string().uuid().optional(), doubtId: z.string().uuid().optional() }).strict().refine(value => [value.courseId, value.contentId, value.doubtId].filter(Boolean).length === 1, 'Choose exactly one learning context');
const requests = new Map<string, { started: number; count: number; busy: boolean }>();
function quota(userId: string) {
  const now = Date.now();
  for (const [id, entry] of requests) if (now - entry.started > 3600000 && !entry.busy) requests.delete(id);
  if (!requests.has(userId) && requests.size >= 10000) throw new LearningError('Assistant is busy. Try again later.', 503);
  const entry = requests.get(userId) || { started: now, count: 0, busy: false };
  if (entry.busy || entry.count >= 20) throw new LearningError('Please wait before asking more questions (20 per hour).', 429);
  entry.count++; entry.busy = true; requests.set(userId, entry);
  return () => { entry.busy = false; };
}
function fail(res: Response, error: unknown) {
  const status = error instanceof LearningError ? error.status : error instanceof z.ZodError ? 400 : 503;
  return res.status(status).json({ success: false, message: error instanceof LearningError ? error.message : status === 400 ? 'Provide a valid question and learning context.' : 'Learning context is currently unavailable.' });
}

router.use(authenticateUser);
router.post('/ask', async (req: AuthRequest, res) => {
  let release: (() => void) | undefined;
  try {
    const input = askSchema.parse(req.body);
    const question = validateQuestion(input.question);
    release = quota(req.user!.id);
    let text = '', label = '', title = '';
    const toolReferences: Array<{ name: string; resourceId: string; access: string }> = [];
    if (input.courseId) {
      const [course] = await db.select({ id: coursesTable.id, name: coursesTable.name, description: coursesTable.description, about: coursesTable.about }).from(coursesTable).where(and(eq(coursesTable.id, input.courseId), eq(coursesTable.isDismissed, false))).limit(1);
      if (!course) throw new LearningError('Course not found.', 404);
      text = `${course.name}\n${course.description || ''}\n${course.about || ''}`;
      label = `course-${course.id}`; title = course.name;
      toolReferences.push({ name: 'read_public_course', resourceId: course.id, access: 'public overview' });
    } else {
      let contentId = input.contentId;
      if (input.doubtId) {
        const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, input.doubtId)).limit(1);
        if (!doubt) throw new LearningError('Question not found.', 404);
        const courseId = await getCourseForContent(doubt.contentId);
        const access = courseId && await getContentAccess(req.user!.id, courseId);
        if (!access || doubt.userId !== req.user!.id && access !== 'owner') throw new LearningError('This question is private.', 403);
        text = `${doubt.title}\n${doubt.description}\n`;
        contentId = doubt.contentId;
        toolReferences.push({ name: 'read_authorized_doubt', resourceId: doubt.id, access: String(access) });
      }
      const courseId = await getCourseForContent(contentId!);
      const access = courseId && await getContentAccess(req.user!.id, courseId);
      if (!access) throw new LearningError('Enroll in this course to use its learning assistant.', 403);
      const [content] = await db.select().from(contentTable).where(eq(contentTable.id, contentId!)).limit(1);
      if (!content) throw new LearningError('Learning material not found.', 404);
      title = content.title; text += `${title}\n${content.description || ''}\n`;
      label = `content-${content.id}`;
      toolReferences.push({ name: 'read_authorized_content', resourceId: content.id, access: String(access) });
      if (/\.pdf$/i.test(content.fileUrl) || /\.txt$/i.test(content.fileUrl)) {
        // Only stored, validated Supabase references can be downloaded. No user URLs/SSRF.
        const bytes = await downloadMedia(content.fileUrl, 10 * 1024 * 1024);
        if (bytes.length > 10 * 1024 * 1024) throw new LearningError('Notes exceed the 10 MB assistant limit. Ask about a smaller document.', 422);
        if (/\.pdf$/i.test(content.fileUrl)) {
          text += await parsePdfNotes(bytes);
        } else text += bytes.toString('utf8');
        toolReferences.push({ name: 'extract_note_text', resourceId: content.id, access: 'text only; up to 80 pages' });
      }
    }
    const excerpts = retrieveExcerpts(text, question, label);
    const result = await requestLearningAnswer(question, excerpts);
    return res.json({ success: true, ...result, sources: excerpts.map(({ id, text }) => ({ id, title, excerpt: text.slice(0, 350) })), toolReferences, disclosure: 'AI explanations can be wrong. Check the sources or ask your educator.' });
  } catch (error) { return fail(res, error); } finally { release?.(); }
});

router.post('/recommend', async (req: AuthRequest, res) => {
  let release: (() => void) | undefined;
  try {
    const { subject } = z.object({ subject: z.string().trim().min(2).max(200) }).strict().parse(req.body);
    release = quota(req.user!.id);
    // Ratings are calculated from stored student reviews, not model guesses.
    const ratingSummary = db.select({ courseId: reviewsTable.courseId, rating: sql<number>`avg(${reviewsTable.rating})`.mapWith(Number).as('rating'), reviewCount: sql<number>`count(*)`.mapWith(Number).as('review_count') }).from(reviewsTable).groupBy(reviewsTable.courseId).as('rating_summary');
    const courses = await db.select({ id: coursesTable.id, name: coursesTable.name, description: coursesTable.description, price: coursesTable.price, educatorId: educatorsTable.id, educatorName: usersTable.name, rating: sql<number>`coalesce(${ratingSummary.rating}, 0)`.mapWith(Number), reviewCount: sql<number>`coalesce(${ratingSummary.reviewCount}, 0)`.mapWith(Number) }).from(coursesTable)
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id)).innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id)).leftJoin(ratingSummary, eq(ratingSummary.courseId, coursesTable.id))
      .where(and(eq(coursesTable.isDismissed, false), eq(usersTable.isBanned, false))).limit(500);
    const recommendations = rankCourses(courses, subject);
    return res.json({ success: true, recommendations, method: 'Topic match plus Bayesian-smoothed student ratings (prior 3.5/5, weight 5).', toolReferences: [{ name: 'rank_public_catalog', access: 'public course and aggregated review data' }] });
  } catch (error) { return fail(res, error); } finally { release?.(); }
});

export default router;

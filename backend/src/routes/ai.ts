import { Router, type Request, type Response } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateUser } from '../controllers/Auth.ts';
import { db } from '../db/index.ts';
import { coursesTable, contentTable, doubtsTable, educatorsTable, usersTable, reviewsTable, aiConversationsTable, aiMessagesTable } from '../db/schema.ts';
import { getContentAccess, getCourseForContent } from '../utils/access.ts';
import { downloadMedia } from '../utils/storage.ts';
import { LearningError, rankCourses, requestLearningAnswer, retrieveExcerpts, validateQuestion } from '../utils/learningAI.ts';
import { parsePdfNotes } from '../utils/parseNotes.ts';

const router = Router();
type AuthRequest = Request & { user?: { id: string } };
const askSchema = z.object({ question: z.string().min(1).max(2000), courseId: z.string().uuid().optional(), contentId: z.string().uuid().optional(), doubtId: z.string().uuid().optional(), conversationId: z.string().uuid().optional() }).strict().refine(value => [value.courseId, value.contentId, value.doubtId].filter(Boolean).length === 1, 'Choose exactly one learning context');
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
       const [course] = await db.select({ id: coursesTable.id, name: coursesTable.name, description: coursesTable.description, about: coursesTable.about, educatorId: coursesTable.educatorId }).from(coursesTable).where(and(eq(coursesTable.id, input.courseId), eq(coursesTable.isDismissed, false))).limit(1);
      if (!course) throw new LearningError('Course not found.', 404);
       const [educator] = await db.select({ userId: educatorsTable.userId, bio: educatorsTable.bio, about: educatorsTable.about }).from(educatorsTable).where(eq(educatorsTable.id, course.educatorId)).limit(1);
       const [educatorUser] = educator ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, educator.userId)).limit(1) : [];
       const catalog = await db.select({ id: coursesTable.id, name: coursesTable.name, description: coursesTable.description, educatorName: usersTable.name }).from(coursesTable)
         .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
         .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
         .where(and(eq(coursesTable.isDismissed, false), eq(usersTable.isBanned, false))).limit(30);
       text = `${course.name}\n${course.description || ''}\n${course.about || ''}\nEducator: ${educatorUser?.name || 'Unknown'}\n${educator?.bio || ''}\n${educator?.about || ''}\nPublic catalog:\n${catalog.map(item => `${item.id}: ${item.name} — ${item.description || ''} — Educator: ${item.educatorName}`).join('\n')}`;
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
     let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
     if (input.conversationId) {
       const contextType = input.courseId ? 'course' : input.contentId ? 'content' : 'doubt';
       const contextId = input.courseId || input.contentId || input.doubtId;
       const [conversation] = await db.select({ id: aiConversationsTable.id, userId: aiConversationsTable.userId, contextType: aiConversationsTable.contextType, contextId: aiConversationsTable.contextId, archived: aiConversationsTable.archived }).from(aiConversationsTable).where(and(eq(aiConversationsTable.id, input.conversationId), eq(aiConversationsTable.userId, req.user!.id))).limit(1);
       if (!conversation) throw new LearningError('Conversation not found.', 404);
       if (conversation.archived) throw new LearningError('This conversation is archived.', 409);
       if (conversation.contextType !== contextType || conversation.contextId !== contextId) throw new LearningError('Conversation context does not match this learning request.', 400);
       history = (await db.select({ role: aiMessagesTable.role, content: aiMessagesTable.content }).from(aiMessagesTable).where(eq(aiMessagesTable.conversationId, input.conversationId)).orderBy(desc(aiMessagesTable.createdAt)).limit(12)).reverse().filter((item): item is { role: 'user' | 'assistant'; content: string } => item.role === 'user' || item.role === 'assistant');
     }
     const excerpts = retrieveExcerpts(text, question, label);
     const result = await requestLearningAnswer(question, excerpts, { history });
     if (input.conversationId) {
       await db.insert(aiMessagesTable).values([
         { conversationId: input.conversationId, role: 'user', content: question.slice(0, 12000) },
         { conversationId: input.conversationId, role: 'assistant', content: result.answer, model: result.model, sources: excerpts.map(source => ({ id: source.id, title })) },
       ]);
       await db.update(aiConversationsTable).set({ updatedAt: new Date() }).where(and(eq(aiConversationsTable.id, input.conversationId), eq(aiConversationsTable.userId, req.user!.id)));
     }
    return res.json({ success: true, ...result, sources: excerpts.map(({ id, text }) => ({ id, title, excerpt: text.slice(0, 350) })), toolReferences, disclosure: 'AI explanations can be wrong. Check the sources or ask your educator.' });
  } catch (error) { return fail(res, error); } finally { release?.(); }
});

const conversationSchema = z.object({ contextType: z.enum(['course', 'content', 'doubt']), contextId: z.string().uuid(), title: z.string().trim().min(1).max(200) }).strict();
router.get('/conversations', async (req: AuthRequest, res) => {
  try {
    const contextType = typeof req.query.contextType === 'string' ? req.query.contextType : undefined;
    const contextId = typeof req.query.contextId === 'string' ? req.query.contextId : undefined;
    if (contextType && !['course', 'content', 'doubt'].includes(contextType)) return res.status(400).json({ success: false, message: 'Invalid conversation context.' });
    const filters = [eq(aiConversationsTable.userId, req.user!.id), eq(aiConversationsTable.archived, false)];
    if (contextType) filters.push(eq(aiConversationsTable.contextType, contextType));
    if (contextId) filters.push(eq(aiConversationsTable.contextId, contextId));
    const rows = await db.select().from(aiConversationsTable).where(and(...filters)).orderBy(desc(aiConversationsTable.updatedAt)).limit(100);
    return res.json({ success: true, conversations: rows });
  } catch (error) { return fail(res, error); }
});
router.post('/conversations', async (req: AuthRequest, res) => {
  try {
    const input = conversationSchema.parse(req.body);
    const [existing] = await db.select().from(aiConversationsTable).where(and(eq(aiConversationsTable.userId, req.user!.id), eq(aiConversationsTable.contextType, input.contextType), eq(aiConversationsTable.contextId, input.contextId), eq(aiConversationsTable.archived, false))).orderBy(desc(aiConversationsTable.updatedAt)).limit(1);
    if (existing) return res.json({ success: true, conversation: existing, existing: true });
    const [row] = await db.insert(aiConversationsTable).values({ ...input, userId: req.user!.id }).returning();
    return res.status(201).json({ success: true, conversation: row });
  } catch (error) { return fail(res, error); }
});
router.get('/conversations/:id', async (req: AuthRequest, res) => {
  try {
    const [conversation] = await db.select().from(aiConversationsTable).where(and(eq(aiConversationsTable.id, req.params.id), eq(aiConversationsTable.userId, req.user!.id))).limit(1);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    const messages = await db.select().from(aiMessagesTable).where(eq(aiMessagesTable.conversationId, conversation.id)).orderBy(aiMessagesTable.createdAt).limit(100);
    return res.json({ success: true, conversation, messages });
  } catch (error) { return fail(res, error); }
});
router.post('/conversations/:id/archive', async (req: AuthRequest, res) => {
  try {
    const [row] = await db.update(aiConversationsTable).set({ archived: true, updatedAt: new Date() }).where(and(eq(aiConversationsTable.id, req.params.id), eq(aiConversationsTable.userId, req.user!.id))).returning();
    if (!row) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    return res.json({ success: true, conversation: row });
  } catch (error) { return fail(res, error); }
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

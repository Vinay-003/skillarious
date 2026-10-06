import type { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { doubtsTable, messagesTable } from '../db/schema.ts';
import { getContentAccess, getCourseForContent, isUuid } from '../utils/access.ts';

type AuthRequest = Request & { user?: { id: string } };
class DoubtFailure extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(res: Response, error: unknown, message: string) {
  return res.status(error instanceof DoubtFailure ? error.status : 500).json({ success: false, message: error instanceof DoubtFailure ? error.message : message });
}
const fields = { id: doubtsTable.id, fileId: doubtsTable.fileId, classId: doubtsTable.classId, date: doubtsTable.date, educatorAssigned: doubtsTable.educatorAssigned, resolved: doubtsTable.resolved, userId: doubtsTable.userId, contentId: doubtsTable.contentId, title: doubtsTable.title, description: doubtsTable.description, status: doubtsTable.status };

async function allowed(req: AuthRequest, doubt: typeof doubtsTable.$inferSelect) {
  if (doubt.userId === req.user?.id) return true;
  const courseId = await getCourseForContent(doubt.contentId);
  return courseId ? await getContentAccess(req.user!.id, courseId) === 'owner' : false;
}

export async function createDoubt(req: AuthRequest, res: Response) {
  try {
    const { contentId, title, description } = req.body ?? {};
    if (!isUuid(contentId) || typeof title !== 'string' || !title.trim() || title.length > 200 || typeof description !== 'string' || !description.trim() || description.length > 10000) return res.status(400).json({ success: false, message: 'Valid contentId, title (1-200 characters) and description (1-10,000 characters) are required' });
    const courseId = await getCourseForContent(contentId);
    if (!courseId) return res.status(404).json({ success: false, message: 'Content not found' });
    if (!await getContentAccess(req.user!.id, courseId)) return res.status(403).json({ success: false, message: 'Course enrollment required' });
    const [doubt] = await db.insert(doubtsTable).values({ date: new Date(), classId: contentId, contentId, userId: req.user!.id, title: title.trim(), description: description.trim(), message: description.trim(), status: 'open', resolved: false }).returning();
    return res.status(201).json({ success: true, data: doubt });
  } catch (error) { return fail(res, error, 'Error creating doubt'); }
}

export async function getDoubtsByContent(req: AuthRequest, res: Response) {
  try {
    const { contentId } = req.params;
    if (!isUuid(contentId)) return res.status(400).json({ success: false, message: 'Invalid content ID' });
    const courseId = await getCourseForContent(contentId);
    if (!courseId) return res.status(404).json({ success: false, message: 'Content not found' });
    const access = await getContentAccess(req.user!.id, courseId);
    if (!access) return res.status(403).json({ success: false, message: 'Access denied' });
    const doubts = await db.select(fields).from(doubtsTable).where(access === 'owner' ? eq(doubtsTable.contentId, contentId) : and(eq(doubtsTable.contentId, contentId), eq(doubtsTable.userId, req.user!.id))).orderBy(desc(doubtsTable.date));
    return res.json({ success: true, doubts });
  } catch (error) { return fail(res, error, 'Error fetching doubts'); }
}

export async function getDoubts(req: AuthRequest, res: Response) {
  try {
    const filter = String(req.query.filter || '');
    if (filter && !['all', 'open', 'resolved'].includes(filter)) return res.status(400).json({ success: false, message: 'Invalid filter' });
    const doubts = await db.select(fields).from(doubtsTable).where(and(eq(doubtsTable.userId, req.user!.id), ...(['open', 'resolved'].includes(filter) ? [eq(doubtsTable.resolved, filter === 'resolved')] : []))).orderBy(desc(doubtsTable.date));
    return res.json({ success: true, doubts });
  } catch (error) { return fail(res, error, 'Error fetching doubts'); }
}

export async function getDoubtDetails(req: AuthRequest, res: Response) {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid doubt ID' });
    const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, req.params.id)).limit(1);
    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found' });
    if (!await allowed(req, doubt)) return res.status(403).json({ success: false, message: 'Access denied' });
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.doubtId, doubt.id));
    return res.json({ success: true, doubt: { ...doubt, messages } });
  } catch (error) { return fail(res, error, 'Error fetching doubt details'); }
}

export async function replyToDoubt(req: AuthRequest, res: Response) {
  try {
    const doubtId = req.params.id;
    const text = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!isUuid(doubtId) || !text || text.length > 10000) return res.status(400).json({ success: false, message: 'Valid doubt ID and reply are required' });
    const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, doubtId)).limit(1);
    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found' });
    const courseId = await getCourseForContent(doubt.contentId);
    const access = courseId && await getContentAccess(req.user!.id, courseId);
    const isOwner = access === 'owner';
    if (!access || !isOwner && doubt.userId !== req.user!.id) return res.status(403).json({ success: false, message: 'Access denied' });
    const message = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(doubtsTable).where(eq(doubtsTable.id, doubtId)).for('update').limit(1);
      if (!current) throw new DoubtFailure(404, 'Doubt not found');
      if (current.resolved && !isOwner) throw new DoubtFailure(409, 'Doubt is resolved');
      const [created] = await tx.insert(messagesTable).values({ doubtId, text, isResponse: Boolean(isOwner) }).returning();
      await tx.update(doubtsTable).set({ status: isOwner ? 'answered' : 'open', resolved: false }).where(eq(doubtsTable.id, doubtId));
      return created;
    });
    return res.status(201).json({ success: true, data: message });
  } catch (error) { return fail(res, error, 'Error replying to doubt'); }
}

export async function resolveDoubt(req: AuthRequest, res: Response) {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid doubt ID' });
    const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, req.params.id)).limit(1);
    if (!doubt) return res.status(404).json({ success: false, message: 'Doubt not found' });
    if (!await allowed(req, doubt)) return res.status(403).json({ success: false, message: 'Access denied' });
    const [updated] = await db.update(doubtsTable).set({ resolved: true, status: 'resolved' }).where(eq(doubtsTable.id, doubt.id)).returning();
    return res.json({ success: true, data: updated });
  } catch (error) { return fail(res, error, 'Error resolving doubt'); }
}

export function getRealtimeStatus(_req: Request, res: Response) {
  return res.json({ success: true, data: { doubtsChannel: 'disabled', messagesChannel: 'disabled' } });
}

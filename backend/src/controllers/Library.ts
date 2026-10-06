import type { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { coursesTable, educatorsTable, usersTable } from '../db/schema.ts';
import { courseHistoryTable, courseLikesTable, playlistsTable, playlistCoursesTable, educatorSubscriptionsTable } from '../db/librarySchema.ts';
import { getContentAccess, isUuid } from '../utils/access.ts';

type AuthRequest = Request & { user: { id: string } };
const invalid = (res: Response) => res.status(400).json({ success: false, message: 'Invalid identifier' });
const failure = (res: Response) => res.status(500).json({ success: false, message: 'Unable to update library' });
const ok = (res: Response, data: unknown) => res.json({ success: true, data });

async function visibleCourse(courseId: string) {
  const [course] = await db.select({ id: coursesTable.id }).from(coursesTable)
    .where(and(eq(coursesTable.id, courseId), eq(coursesTable.isDismissed, false))).limit(1);
  return Boolean(course);
}

const courseFields = { id: coursesTable.id, name: coursesTable.name, description: coursesTable.description, thumbnail: coursesTable.thumbnail, educatorId: coursesTable.educatorId, educatorName: usersTable.name };

export async function listHistory(req: AuthRequest, res: Response) {
  try {
    const rows = await db.select({ ...courseFields, viewedAt: courseHistoryTable.viewedAt }).from(courseHistoryTable)
      .innerJoin(coursesTable, eq(courseHistoryTable.courseId, coursesTable.id))
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
      .where(eq(courseHistoryTable.userId, req.user.id))
      .orderBy(desc(courseHistoryTable.viewedAt));
    return ok(res, rows);
  } catch { return failure(res); }
}

export async function recordHistory(req: AuthRequest, res: Response) {
  const { courseId } = req.params;
  if (!isUuid(courseId)) return invalid(res);
  try {
    if (!await visibleCourse(courseId)) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!await getContentAccess(req.user.id, courseId)) return res.status(403).json({ success: false, message: 'Course access required' });
    await db.insert(courseHistoryTable).values({ userId: req.user.id, courseId, viewedAt: new Date() })
      .onConflictDoUpdate({ target: [courseHistoryTable.userId, courseHistoryTable.courseId], set: { viewedAt: new Date() } });
    return ok(res, { courseId });
  } catch { return failure(res); }
}

export async function listLikes(req: AuthRequest, res: Response) {
  try {
    const rows = await db.select(courseFields).from(courseLikesTable)
      .innerJoin(coursesTable, eq(courseLikesTable.courseId, coursesTable.id))
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
      .where(and(eq(courseLikesTable.userId, req.user.id), eq(coursesTable.isDismissed, false)))
      .orderBy(desc(courseLikesTable.createdAt));
    return ok(res, rows);
  } catch { return failure(res); }
}

export async function setLike(req: AuthRequest, res: Response) {
  const { courseId } = req.params;
  if (!isUuid(courseId)) return invalid(res);
  try {
    if (!await visibleCourse(courseId)) return res.status(404).json({ success: false, message: 'Course not found' });
    await db.insert(courseLikesTable).values({ userId: req.user.id, courseId }).onConflictDoNothing();
    return ok(res, { courseId, liked: true });
  } catch { return failure(res); }
}

export async function removeLike(req: AuthRequest, res: Response) {
  const { courseId } = req.params;
  if (!isUuid(courseId)) return invalid(res);
  try {
    await db.delete(courseLikesTable).where(and(eq(courseLikesTable.userId, req.user.id), eq(courseLikesTable.courseId, courseId)));
    return ok(res, { courseId, liked: false });
  } catch { return failure(res); }
}

export async function listPlaylists(req: AuthRequest, res: Response) {
  try {
    const playlists = await db.select().from(playlistsTable).where(eq(playlistsTable.userId, req.user.id)).orderBy(desc(playlistsTable.createdAt));
    const rows = await db.select({ playlistId: playlistCoursesTable.playlistId, ...courseFields }).from(playlistCoursesTable)
      .innerJoin(playlistsTable, eq(playlistCoursesTable.playlistId, playlistsTable.id))
      .innerJoin(coursesTable, eq(playlistCoursesTable.courseId, coursesTable.id))
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
      .where(and(eq(playlistsTable.userId, req.user.id), eq(coursesTable.isDismissed, false)))
      .orderBy(desc(playlistCoursesTable.createdAt));
    return ok(res, playlists.map(playlist => ({ ...playlist, courses: rows.filter(row => row.playlistId === playlist.id).map(({ playlistId, ...course }) => course) })));
  } catch { return failure(res); }
}

export async function createPlaylist(req: AuthRequest, res: Response) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 120) return res.status(400).json({ success: false, message: 'Playlist name must be 1–120 characters' });
  try {
    const [playlist] = await db.insert(playlistsTable).values({ name, userId: req.user.id }).returning();
    return res.status(201).json({ success: true, data: { ...playlist, courses: [] } });
  } catch { return failure(res); }
}

export async function deletePlaylist(req: AuthRequest, res: Response) {
  const { playlistId } = req.params;
  if (!isUuid(playlistId)) return invalid(res);
  try {
    const [deleted] = await db.delete(playlistsTable).where(and(eq(playlistsTable.id, playlistId), eq(playlistsTable.userId, req.user.id))).returning({ id: playlistsTable.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Playlist not found' });
    return ok(res, { playlistId });
  } catch { return failure(res); }
}

async function ownedPlaylist(userId: string, playlistId: string) {
  const [row] = await db.select({ id: playlistsTable.id }).from(playlistsTable)
    .where(and(eq(playlistsTable.id, playlistId), eq(playlistsTable.userId, userId))).limit(1);
  return Boolean(row);
}

export async function addPlaylistCourse(req: AuthRequest, res: Response) {
  const { playlistId, courseId } = req.params;
  if (!isUuid(playlistId) || !isUuid(courseId)) return invalid(res);
  try {
    if (!await ownedPlaylist(req.user.id, playlistId)) return res.status(404).json({ success: false, message: 'Playlist not found' });
    if (!await visibleCourse(courseId)) return res.status(404).json({ success: false, message: 'Course not found' });
    await db.insert(playlistCoursesTable).values({ playlistId, courseId }).onConflictDoNothing();
    return ok(res, { playlistId, courseId });
  } catch { return failure(res); }
}

export async function removePlaylistCourse(req: AuthRequest, res: Response) {
  const { playlistId, courseId } = req.params;
  if (!isUuid(playlistId) || !isUuid(courseId)) return invalid(res);
  try {
    if (!await ownedPlaylist(req.user.id, playlistId)) return res.status(404).json({ success: false, message: 'Playlist not found' });
    await db.delete(playlistCoursesTable).where(and(eq(playlistCoursesTable.playlistId, playlistId), eq(playlistCoursesTable.courseId, courseId)));
    return ok(res, { playlistId, courseId });
  } catch { return failure(res); }
}

export async function listSubscriptions(req: AuthRequest, res: Response) {
  try {
    const rows = await db.select({ id: educatorsTable.id, name: usersTable.name, pfp: usersTable.pfp, bio: educatorsTable.bio, subscribedAt: educatorSubscriptionsTable.createdAt })
      .from(educatorSubscriptionsTable)
      .innerJoin(educatorsTable, eq(educatorSubscriptionsTable.educatorId, educatorsTable.id))
      .innerJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
      .where(eq(educatorSubscriptionsTable.userId, req.user.id)).orderBy(desc(educatorSubscriptionsTable.createdAt));
    return ok(res, rows);
  } catch { return failure(res); }
}

export async function setSubscription(req: AuthRequest, res: Response) {
  const { educatorId } = req.params;
  if (!isUuid(educatorId)) return invalid(res);
  try {
    const [educator] = await db.select({ userId: educatorsTable.userId }).from(educatorsTable).where(eq(educatorsTable.id, educatorId)).limit(1);
    if (!educator) return res.status(404).json({ success: false, message: 'Educator not found' });
    if (educator.userId === req.user.id) return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    await db.insert(educatorSubscriptionsTable).values({ userId: req.user.id, educatorId }).onConflictDoNothing();
    return ok(res, { educatorId, subscribed: true });
  } catch { return failure(res); }
}

export async function removeSubscription(req: AuthRequest, res: Response) {
  const { educatorId } = req.params;
  if (!isUuid(educatorId)) return invalid(res);
  try {
    await db.delete(educatorSubscriptionsTable).where(and(eq(educatorSubscriptionsTable.userId, req.user.id), eq(educatorSubscriptionsTable.educatorId, educatorId)));
    return ok(res, { educatorId, subscribed: false });
  } catch { return failure(res); }
}

import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { contentTable, coursesTable, educatorsTable, modulesTable, transactionsTable } from '../db/schema.ts';

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function isCourseOwner(userId: string, courseId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(courseId)) return false;
  const rows = await db.select({ id: coursesTable.id }).from(coursesTable)
    .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
    .where(and(eq(coursesTable.id, courseId), eq(educatorsTable.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function getContentAccess(userId: string, courseId: string): Promise<'owner' | 'enrolled' | null> {
  if (!isUuid(userId) || !isUuid(courseId)) return null;
  if (await isCourseOwner(userId, courseId)) return 'owner';
  const rows = await db.select({ id: transactionsTable.id }).from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.courseId, courseId), eq(transactionsTable.status, 'completed'))).limit(1);
  return rows.length ? 'enrolled' : null;
}

export async function getCourseForContent(contentId: string): Promise<string | null> {
  if (!isUuid(contentId)) return null;
  const rows = await db.select({ courseId: modulesTable.courseId }).from(contentTable)
    .innerJoin(modulesTable, eq(contentTable.moduleId, modulesTable.id))
    .where(eq(contentTable.id, contentId)).limit(1);
  return rows[0]?.courseId || null;
}

export async function getCourseForModule(moduleId: string): Promise<string | null> {
  if (!isUuid(moduleId)) return null;
  const rows = await db.select({ courseId: modulesTable.courseId }).from(modulesTable).where(eq(modulesTable.id, moduleId)).limit(1);
  return rows[0]?.courseId || null;
}

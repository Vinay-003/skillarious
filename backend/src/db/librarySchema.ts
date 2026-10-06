import { pgTable, uuid, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coursesTable, educatorsTable, usersTable } from './schema.ts';

export const courseHistoryTable = pgTable('course_history', {
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.userId, t.courseId] }), recent: index('course_history_recent_idx').on(t.userId, t.viewedAt) }));

export const courseLikesTable = pgTable('course_likes', {
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.userId, t.courseId] }) }));

export const playlistsTable = pgTable('playlists', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const playlistCoursesTable = pgTable('playlist_courses', {
  playlistId: uuid('playlist_id').notNull().references(() => playlistsTable.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.playlistId, t.courseId] }) }));

export const educatorSubscriptionsTable = pgTable('educator_subscriptions', {
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  educatorId: uuid('educator_id').notNull().references(() => educatorsTable.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.userId, t.educatorId] }) }));

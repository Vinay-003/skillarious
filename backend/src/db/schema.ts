import { pgTable, uuid, bigint, text, timestamp, unique, boolean, foreignKey, numeric, real, integer, decimal, json, primaryKey, PgTable, index, check } from "drizzle-orm/pg-core"
import { sql } from 'drizzle-orm';

// USERS TABLE
export const usersTable= pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  pfp: text('pfp'),
  phone: text('phone'),
  gender: text('gender'),
  age: bigint('age', { mode: 'number' }),
  isEducator: boolean('is_educator').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  refreshToken: text("refresh_token"),
  isAdmin: boolean('is_admin').default(false).notNull(),
  role: text('role').default('user').notNull(), // 'user', 'educator', 'admin'
  isBanned: boolean('is_banned').default(false).notNull(),
  banReason: text('ban_reason'),
  bannedAt: timestamp('banned_at'),
  // bannedBy: uuid('banned_by').references(() => usersTable.id),
  lastLogin: timestamp('last_login'),
});

// OTPS TABLE
export const otpsTable = pgTable('otps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  value: bigint('value', { mode: 'bigint' }).notNull(),
  email: text('email').notNull(),
  expiry: timestamp('expiry').notNull(),
  lastSent: timestamp('last_sent').notNull(),
});

// EDUCATORS TABLE
export const educatorsTable = pgTable('educators', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  bio: text('bio'),
  about: text('about'),
  doubtOpen: boolean('doubt_open').notNull().default(false),
});

// COURSES TABLE
export const coursesTable = pgTable('courses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  about: text('about'),
  comments: text('comments'),
  start: timestamp('start').notNull(),
  end: timestamp('end').notNull(),
  educatorId: uuid('educator_id').notNull().references(() => educatorsTable.id),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  thumbnail: text('thumbnail').notNull(),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  dismissReason: text('dismiss_reason'),
  dismissedAt: timestamp('dismissed_at'),
  completionRate: real('completion_rate'),
  viewCount: integer('view_count').default(0),
});

// CATEGORY TABLE
export const categoryTable = pgTable('category', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description').default('No description provided'),  // Added default value
});

// // Create a function to handle null/empty descriptions
// export const handleEmptyDescription = sql`
// CREATE OR REPLACE FUNCTION handle_empty_description()
// RETURNS TRIGGER AS $$
// BEGIN
//   IF NEW.description IS NULL OR NEW.description = '' THEN
//     NEW.description := 'No description provided';
//   END IF;
//   RETURN NEW;
// END;
// $$ LANGUAGE plpgsql;

// -- Create the trigger
// CREATE OR REPLACE TRIGGER category_description_trigger
//   BEFORE INSERT OR UPDATE ON category
//   FOR EACH ROW
//   EXECUTE FUNCTION handle_empty_description();
// `;

// CATEGORY_COURSES TABLE
export const categoryCoursesTable = pgTable(
  'category_courses',
  {
    categoryId: uuid('category_id').notNull().references(() => categoryTable.id),
    courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  },
  (table) => ({
    cpk: primaryKey({ name: 'composite_key', columns: [table.categoryId, table.courseId] }),
  }),
);

// MODULES TABLE
export const modulesTable = pgTable('modules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  name: text('name').notNull(),
  duration: real('duration'), // Using real() for float
  videoCount: bigint('video_count', { mode: 'number' }),
  materialCount: bigint('material_count', { mode: 'number' }),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  dismissReason: text('dismiss_reason'),
  dismissedAt: timestamp('dismissed_at'),
});

// // CLASSES TABLE
// export const classesTable = pgTable('classes', {
//   id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
//   moduleId: uuid('module_id').notNull().references(() => modulesTable.id),
//   views: bigint('views', { mode: 'number' }).default(0), // Changed to mode: 'number'
//   duration: timestamp('duration'),
//   fileId: text('file_id'),
// });

// REVIEWS TABLE
export const reviewsTable = pgTable('reviews', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  educatorId: uuid('educator_id').references(() => educatorsTable.id),
  courseId: uuid('course_id').references(() => coursesTable.id),
  message: text('message'),
  rating: real('rating').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// TRANSACTIONS TABLE
export const transactionsTable = pgTable('transactions', {  // Ensure it's 'transactions' (plural)
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  status: text('status').notNull().default('completed'),
  paymentId: text('payment_id').notNull(),
  refundReason: text('refund_reason'),
  refundDate: timestamp('refund_date')
});

// FILES TABLE
export const filesTable = pgTable('files', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  owner: uuid('owner').notNull().references(() => usersTable.id),
  name: text('name'),
  uploaded: timestamp('uploaded').notNull(),
  link: text('link').notNull(),
  type: text('type').notNull(),
});

// DOUBTS TABLE
export const doubtsTable = pgTable('doubts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  fileId: uuid('file_id').references(() => filesTable.id),
  message: text('message').notNull(),
  classId: uuid('class_id').references(() => contentTable.id),
  date: timestamp('date').notNull(),
  educatorAssigned: uuid('educator_assigned').references(() => educatorsTable.id),
  resolved: boolean('resolved').notNull().default(false),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  contentId: uuid('content_id').notNull().references(() => contentTable.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('open'),
}, t => ({
  contentIdx: index('doubts_content_id_idx').on(t.contentId),
  userIdx: index('doubts_user_id_idx').on(t.userId),
  classMatchesContent: check('doubts_class_matches_content', sql`${t.classId} IS NULL OR ${t.classId} = ${t.contentId}`),
  statusValid: check('doubts_status_valid', sql`${t.status} IN ('open', 'answered', 'resolved')`),
  resolvedMatchesStatus: check('doubts_resolved_matches_status', sql`${t.resolved} = (${t.status} = 'resolved')`),
  messageLength: check('doubts_message_length', sql`length(btrim(${t.message})) BETWEEN 1 AND 10000`),
  titleLength: check('doubts_title_length', sql`length(btrim(${t.title})) BETWEEN 1 AND 200 AND length(${t.title}) <= 200`),
  descriptionLength: check('doubts_description_length', sql`length(btrim(${t.description})) BETWEEN 1 AND 10000 AND length(${t.description}) <= 10000`),
}));

// MESSAGES TABLE
export const messagesTable = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  doubtId: uuid('doubt_id').notNull().references(() => doubtsTable.id),
  text: text('text').notNull(),
  isResponse: boolean('is_response').notNull().default(false),
}, t => ({ doubtIdx: index('messages_doubt_id_idx').on(t.doubtId) }));

// CONTENT TABLE - Single table for all module content
export const contentTable = pgTable('content', {
  id: uuid('id').defaultRandom().primaryKey(),
  moduleId: uuid('module_id').notNull().references(() => modulesTable.id),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  fileUrl: text('file_url').notNull(),
  isDismissed: boolean('is_dismissed').default(false).notNull(),
  dismissReason: text('dismiss_reason'),
  dismissedAt: timestamp('dismissed_at'),
  duration: numeric('duration'),
  views: integer('views').default(0),
  order: integer('order').default(0),
  isPreview: boolean('is_preview').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
// Type definitions
export type Content = typeof contentTable.$inferSelect;
export type InsertContent = typeof contentTable.$inferInsert;

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertEducator = typeof educatorsTable.$inferInsert;
export type SelectEducator = typeof educatorsTable.$inferSelect;

export type InsertCourse = typeof coursesTable.$inferInsert;
export type SelectCourse = typeof coursesTable.$inferSelect;

export type InsertCategory = typeof categoryTable.$inferInsert;
export type SelectCategory = typeof categoryTable.$inferSelect;

export type InsertModule = typeof modulesTable.$inferInsert;
export type SelectModule = typeof modulesTable.$inferSelect;


export type InsertClass = typeof contentTable.$inferInsert;
export type SelectClass = typeof contentTable.$inferSelect;

export type InsertReview = typeof reviewsTable.$inferInsert;
export type SelectReview = typeof reviewsTable.$inferSelect;

export type InsertTransaction = typeof transactionsTable.$inferInsert;
export type SelectTransaction = typeof transactionsTable.$inferSelect;

export type InsertFile = typeof filesTable.$inferInsert;
export type SelectFile = typeof filesTable.$inferSelect;

export type InsertDoubt = typeof doubtsTable.$inferInsert;
export type SelectDoubt = typeof doubtsTable.$inferSelect;

export type InsertMessage = typeof messagesTable.$inferInsert;
export type SelectMessage = typeof messagesTable.$inferSelect;

export type InsertOtp = typeof otpsTable.$inferInsert;
export type SelectOtp = typeof otpsTable.$inferSelect;
// Admin log table
export const adminLogsTable = pgTable('admin_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  adminId: uuid('admin_id').notNull().references(() => usersTable.id),
  action: text('action').notNull(),
  targetId: uuid('target_id').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export type InsertAdminLog = typeof adminLogsTable.$inferInsert;
export type SelectAdminLog = typeof adminLogsTable.$inferSelect;

// Persistent, private learning assistant conversations.
export const aiConversationsTable = pgTable('ai_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  contextType: text('context_type').notNull(),
  contextId: uuid('context_id').notNull(),
  title: text('title').notNull(),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => ({ ownerIdx: index('ai_conversations_user_id_idx').on(t.userId), contextIdx: index('ai_conversations_context_idx').on(t.contextType, t.contextId), contextTypeValid: check('ai_conversations_context_type_valid', sql`${t.contextType} IN ('catalog', 'course', 'content', 'doubt')`), titleLength: check('ai_conversations_title_length', sql`length(btrim(${t.title})) BETWEEN 1 AND 200`) }));

export const aiMessagesTable = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversationsTable.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  model: text('model'),
  sources: json('sources'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({ conversationIdx: index('ai_messages_conversation_id_idx').on(t.conversationId, t.createdAt), roleValid: check('ai_messages_role_valid', sql`${t.role} IN ('user', 'assistant')`) }));

export const adminInvitesTable = pgTable('admin_invites', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  inviteToken: text('invite_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  createdBy: uuid('created_by').references(() => usersTable.id),
  createdAt: timestamp('created_at').defaultNow(),
});

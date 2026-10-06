import { pgTable, uuid, text, decimal, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { coursesTable, usersTable, transactionsTable } from './schema.ts';

export const paypalOrdersTable = pgTable('paypal_orders', {
  id: uuid('id').primaryKey(),
  orderId: text('order_id').unique(),
  userId: uuid('user_id').notNull().references(() => usersTable.id),
  courseId: uuid('course_id').notNull().references(() => coursesTable.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  merchantId: text('merchant_id').notNull(),
  status: text('status').notNull().default('creating'),
  captureId: text('capture_id').unique(),
  transactionId: uuid('transaction_id').references(() => transactionsTable.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

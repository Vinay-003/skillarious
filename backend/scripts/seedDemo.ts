import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { inArray, or, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { usersTable, educatorsTable, categoryTable, categoryCoursesTable, coursesTable, modulesTable, contentTable, transactionsTable, reviewsTable, doubtsTable, messagesTable } from '../src/db/schema.ts';
import { demoAssets, buildDemoData } from './demoData.ts';
import { assertSeedPermission, assertFixtureRows, mediaReference, isExistingObject, safeSeedError } from './seedDemoCore.ts';

config({ path: '.env.local' });

async function main() {
  assertSeedPermission(process.env);
  const check = process.argv.includes('--check');
  const password = process.env.DEMO_SEED_PASSWORD || randomBytes(32).toString('base64url');
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const storage = createClient(process.env.SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const publicBucket = process.env.SUPABASE_PUBLIC_BUCKET || 'public-assets';
  const privateBucket = process.env.SUPABASE_PRIVATE_BUCKET || 'course-content';
  const references: Record<string, string> = {};
  for (const asset of demoAssets) {
    const bucket = asset.public ? publicBucket : privateBucket;
    const key = asset.key;
    const store = storage.from(bucket);
    const url = asset.public ? store.getPublicUrl(key).data.publicUrl : '';
    references[asset.key] = mediaReference(bucket, key, asset.public, url);
  }
  const data = buildDemoData(await bcrypt.hash(password, 12), references);
  const tables = [
    ['users', usersTable, data.users, ['id', 'email', 'name', 'role']],
    ['educators', educatorsTable, data.educators, ['id', 'userId']],
    ['category', categoryTable, data.categories, ['id', 'name']],
    ['courses', coursesTable, data.courses, ['id', 'name', 'educatorId']],
    ['modules', modulesTable, data.modules, ['id', 'name', 'courseId']],
    ['content', contentTable, data.content, ['id', 'title', 'moduleId', 'type']],
    ['transactions', transactionsTable, data.transactions, ['id', 'userId', 'courseId', 'paymentId']],
    ['reviews', reviewsTable, data.reviews, ['id', 'userId', 'courseId']],
    ['doubts', doubtsTable, data.doubts, ['id', 'userId', 'contentId']],
    ['messages', messagesTable, data.messages, ['id', 'doubtId', 'text']],
  ] as const;
  let newUsers = false;
  await db.transaction(async tx => {
    // Transaction-level serialization prevents simultaneous seed runners from racing the identity checks.
    await tx.execute('SELECT pg_advisory_xact_lock(772611260)' as any);
    for (const [name, table, rows, identity] of tables) {
      if (!rows.length) continue;
      const ids = (rows as any[]).map((row: any) => row.id);
      const existing = await tx.select().from(table as any).where(inArray((table as any).id, ids));
      const occupied = name === 'users' ? await tx.select().from(usersTable).where(inArray(usersTable.email, (data.users as any[]).map((user: any) => user.email))) : [];
      assertFixtureRows(name, rows as any, [...existing, ...occupied] as any, identity as any);
      if (name === 'users') newUsers = existing.length < rows.length;
    }
    if (check) return;
    for (const asset of demoAssets) {
      const bucket = asset.public ? publicBucket : privateBucket;
      const result = await storage.from(bucket).upload(asset.key, await readFile(asset.path), { contentType: asset.contentType, upsert: false });
      if (result.error && !isExistingObject(result.error)) throw new Error('Demo asset upload failed');
    }
    await tx.insert(usersTable).values(data.users).onConflictDoNothing();
    await tx.insert(educatorsTable).values(data.educators).onConflictDoNothing();
    await tx.insert(categoryTable).values(data.categories).onConflictDoNothing();
    const categories = await tx.select({ id: categoryTable.id, name: categoryTable.name }).from(categoryTable).where(inArray(categoryTable.name, data.categories.map(category => category.name)));
    const byName = new Map((categories as any[]).map((category: any) => [category.name, category.id]));
    const nameById = new Map((data.categories as any[]).map((category: any) => [category.id, category.name]));
    await tx.insert(coursesTable).values(data.courses).onConflictDoNothing();
    await tx.insert(categoryCoursesTable).values((data.categoryCourses as any[]).map((item: any) => ({ ...item, categoryId: byName.get(nameById.get(item.categoryId)!)! }))).onConflictDoNothing();
    await tx.insert(modulesTable).values(data.modules).onConflictDoNothing();
    await tx.insert(contentTable).values(data.content).onConflictDoNothing();
    await tx.insert(transactionsTable).values(data.transactions).onConflictDoNothing();
    await tx.insert(reviewsTable).values(data.reviews).onConflictDoNothing();
    await tx.insert(doubtsTable).values(data.doubts).onConflictDoNothing();
    await tx.insert(messagesTable).values(data.messages).onConflictDoNothing();
  });
  if (!check && newUsers && !process.env.DEMO_SEED_PASSWORD) {
    const file = path.resolve('reports/private/demo-access.txt');
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, `Demo account password: ${password}\n`, { flag: 'wx', mode: 0o600 });
  }
  console.log(check ? 'Demo fixture identities validated (read-only)' : 'Demo seed completed');
}

main().catch(_error => { console.error(safeSeedError(_error)); process.exitCode = 1; }).finally(async () => { await db.$client.end(); });

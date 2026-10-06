import { defineConfig } from 'drizzle-kit';
// Offline generation only. Never use drizzle-kit push/migrate against a live target.
export default defineConfig({ schema: ['./src/db/schema.ts', './src/db/paymentSchema.ts', './src/db/adminReportsSchema.ts', './src/db/librarySchema.ts'], out: './supabase/bootstrap', dialect: 'postgresql' });

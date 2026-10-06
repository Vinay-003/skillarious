import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseTLS } from '../utils/databaseTLS.ts';

config({ path: '.env.local' });
// postgres-js connects lazily; health checks can run before external services are provisioned.
const client = postgres(process.env.DATABASE_URL || 'postgres://localhost/skillarious', { max: 10, prepare: false, connect_timeout: 10, idle_timeout: 20, ssl: databaseTLS(process.env) });
export const db = drizzle({ client });

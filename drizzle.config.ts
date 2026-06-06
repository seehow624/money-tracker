import 'dotenv/config';
import type { Config } from 'drizzle-kit';
import path from 'node:path';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url:
      process.env.MONEY_TRACKER_DB_PATH ??
      path.join(process.cwd(), 'data', 'money.db'),
  },
} satisfies Config;

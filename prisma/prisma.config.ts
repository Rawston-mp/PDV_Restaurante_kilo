import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

dotenv.config({ path: `${process.cwd()}/.env` });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

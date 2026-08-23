import { defineConfig, env } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    datasource: {
        url: env('DATABASE_URL'),
    },
  // AQUÍ es donde Prisma 7 busca la orden de sembrado
    migrations: {
        seed: 'ts-node prisma/seed.ts',
    },
});
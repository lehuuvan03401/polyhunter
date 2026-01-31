import 'dotenv/config';
import { defineConfig } from '@prisma/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in prisma.config.ts');
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: databaseUrl
    },
    migrations: {
        path: 'prisma/migrations'
    }
});

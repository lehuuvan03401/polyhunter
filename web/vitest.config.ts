import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.ts'],
        testTimeout: 30000,
    },
});

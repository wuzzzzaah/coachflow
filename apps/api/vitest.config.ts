import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/whatsapp/parser.ts',
        'src/engine/outputParser.ts',
        'src/engine/contextBuilder.ts',
        'src/engine/sessionManager.ts',
        'src/db/journeyLoader.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@coachflow/shared/src/contracts': resolve(
        __dirname,
        '../../packages/shared/src/contracts/index.ts',
      ),
      '@coachflow/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});

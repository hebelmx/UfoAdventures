import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.[jt]s'],
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['tests/unit/setup-tests.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

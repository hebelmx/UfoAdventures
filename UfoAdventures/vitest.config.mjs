import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.[jt]s'],
    environment: 'node',
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

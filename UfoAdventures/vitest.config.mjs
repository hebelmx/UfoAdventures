import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.[jt]s'],
    environment: 'jsdom',
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

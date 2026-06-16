import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.js', '**/*.test.mjs'],
    exclude: ['e2e.spec.js', 'node_modules'],
  },
});

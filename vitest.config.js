import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/test/'],
      thresholds: {
        // Progressive coverage gates — updated baseline 2026-03-30
        // Actual (2026-03-30): branches 44.4%, functions 56.3%, lines 60.4%, statements 57.9%
        // Phase 1 (now):    gates pinned just below measured values
        // Phase 2 (2026-06): +8pts each
        // Phase 3 (2026-09): target 70% lines/functions/statements, 60% branches
        branches: 42,    // measured: 44.4% — real gain from new tests (+4.8pp)
        functions: 54,   // measured: 56.3%
        lines: 58,       // measured: 60.4%
        statements: 56,  // measured: 57.9%
      },
    },
  },
});

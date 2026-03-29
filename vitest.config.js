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
        // Progressive coverage gates — aligned with measured baseline (2026-03-29)
        // Phase 1 (now):    lines 59%, functions 54%, statements 56%, branches 40%
        // Phase 2 (2026-06): +5pts each
        // Phase 3 (2026-09): target 70% lines/functions/statements, 55% branches
        branches: 38,    // current: 39.6% — gate just below, direction: up
        functions: 52,   // current: 53.9%
        lines: 57,       // current: 59.0%
        statements: 55,  // current: 56.5%
      },
    },
  },
});

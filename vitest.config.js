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
        // Coverage gates — updated 2026-04-03
        // Actual: branches 51.2%, functions 63.1%, lines 69.4%, statements 66.5%
        branches: 49,
        functions: 61,
        lines: 67,
        statements: 64,
      },
    },
  },
});

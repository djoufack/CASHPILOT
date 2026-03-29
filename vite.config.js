import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  esbuild: {
    pure:
      mode === 'production' ? ['console.log', 'console.warn', 'console.debug', 'console.info', 'console.error'] : [],
  },
  server: {
    port: 3000,
  },
  resolve: {
    extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Acknowledged large chunks (all lazy-loaded on demand):
    //   exceljs (~936kB) — dynamic import, only on export actions
    //   three  (~492kB)  — LandingPage 3D animation only
    //   gsap   (~varies) — LandingPage animations only
    //   i18n   (~628kB)  — translations, loaded once at startup
    //   jspdf  (~385kB)  — PDF export, dynamic import
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite virtual helpers → keep in entry chunk (no circular deps)
          if (!id.includes('node_modules/') && !id.includes('/src/i18n/')) return undefined;
          // Move i18n config + locale JSON into the i18n chunk to avoid inlining translations in entry
          if (id.includes('/src/i18n/') || id.includes('/src/i18n/locales/')) return 'i18n';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          )
            return 'vendor';
          if (id.includes('node_modules/@radix-ui/')) return 'ui';
          if (id.includes('node_modules/lucide-react/')) return 'icons';
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/gsap/')) return 'gsap';
          if (
            id.includes('node_modules/recharts/') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor/')
          )
            return 'charts';
          if (id.includes('node_modules/framer-motion/')) return 'animations';
          if (id.includes('node_modules/jspdf/') || id.includes('node_modules/jspdf-autotable/')) return 'jspdf';
          if (id.includes('node_modules/pdfjs-dist/')) return 'pdfViewer';
          if (id.includes('node_modules/html2canvas/')) return 'html2canvas';
          if (id.includes('node_modules/xlsx/')) return 'xlsx';
          if (id.includes('node_modules/@supabase/') || id.includes('node_modules/websocket/')) return 'supabase';
          if (id.includes('node_modules/leaflet/') || id.includes('node_modules/react-leaflet/')) return 'maps';
          if (
            id.includes('node_modules/i18next/') ||
            id.includes('node_modules/react-i18next/') ||
            id.includes('node_modules/i18next-browser-languagedetector/')
          )
            return 'i18n';
          if (id.includes('node_modules/date-fns/')) return 'dateUtils';
          if (id.includes('node_modules/@dnd-kit/')) return 'dnd';
          if (
            id.includes('node_modules/react-hook-form/') ||
            id.includes('node_modules/@hookform/') ||
            id.includes('node_modules/zod/')
          )
            return 'forms';
          if (id.includes('node_modules/@sentry/')) return 'sentry';
          if (id.includes('node_modules/@tanstack/')) return 'query';
          if (id.includes('node_modules/react-big-calendar/')) return 'calendar';
          if (id.includes('node_modules/frappe-gantt/')) return 'gantt';
          if (id.includes('node_modules/pdf-lib/')) return 'pdf-lib';
          if (id.includes('node_modules/html5-qrcode/') || id.includes('node_modules/jsbarcode/')) return 'barcode';
          if (
            id.includes('node_modules/clsx/') ||
            id.includes('node_modules/tailwind-merge/') ||
            id.includes('node_modules/class-variance-authority/') ||
            id.includes('node_modules/uuid/') ||
            id.includes('node_modules/dompurify/')
          )
            return 'utils';
        },
      },
    },
  },
}));

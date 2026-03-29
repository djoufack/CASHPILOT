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
    // Large chunks that are genuinely lazy-loaded (only on user action):
    //   exceljs (~936kB) — dynamic import() inside export handlers only
    //   xlsx    (~487kB) — dynamic import() for spreadsheet parsing only
    //   three   (~480kB) — LandingPage 3D animation, code-split route
    //   pdf-lib (~424kB) — PDF export, dynamic import
    //   pdfViewer (~398kB) — PDF viewer, code-split route
    //   jspdf   (~376kB) — PDF export, dynamic import
    // i18n locales (~235KB each) are now properly lazy-split chunks (fixed)
    chunkSizeWarningLimit: 960, // only suppress the exceljs chunk; all others are below 500KB
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite virtual helpers → keep in entry chunk (no circular deps)
          if (!id.includes('node_modules/') && !id.includes('/src/i18n/')) return undefined;
          // Move i18n config into the i18n chunk — locale JSON files must stay as separate chunks
          // so their dynamic import() calls actually produce lazy-loaded bundles
          if (id.includes('/src/i18n/locales/')) return undefined; // en/fr/nl → own lazy chunks
          if (id.includes('/src/i18n/')) return 'i18n';
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

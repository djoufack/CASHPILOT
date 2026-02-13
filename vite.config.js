import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
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
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['react', 'react-dom', 'react-router-dom'],
					ui: [
						'@radix-ui/react-dialog',
						'@radix-ui/react-dropdown-menu',
						'@radix-ui/react-select',
						'@radix-ui/react-tabs',
						'@radix-ui/react-toast',
						'@radix-ui/react-tooltip',
						'@radix-ui/react-popover',
						'@radix-ui/react-accordion',
						'@radix-ui/react-checkbox',
						'@radix-ui/react-label',
						'@radix-ui/react-switch',
						'@radix-ui/react-scroll-area',
						'@radix-ui/react-progress',
						'@radix-ui/react-avatar',
						'@radix-ui/react-slot',
					],
					charts: ['recharts'],
					pdf: ['jspdf', 'html2pdf.js', 'pdfjs-dist'],
					xlsx: ['xlsx'],
					supabase: ['@supabase/supabase-js'],
					landing: ['gsap', 'three'],
					animations: ['framer-motion'],
					maps: ['leaflet', 'react-leaflet'],
					i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
					dateUtils: ['date-fns'],
					dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
					forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
				},
			},
		},
	},
});

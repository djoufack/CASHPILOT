
import * as pdfjsLib from 'pdfjs-dist';

// Configure the web worker for pdfjs-dist (required for Vite)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export { pdfjsLib };

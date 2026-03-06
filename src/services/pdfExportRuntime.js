const DEFAULT_OPTIONS = {
  filename: 'document.pdf',
  margin: 10,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: null,
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
};

const mergeOptions = (options = {}) => ({
  ...DEFAULT_OPTIONS,
  ...options,
  image: {
    ...DEFAULT_OPTIONS.image,
    ...(options.image || {}),
  },
  html2canvas: {
    ...DEFAULT_OPTIONS.html2canvas,
    ...(options.html2canvas || {}),
  },
  jsPDF: {
    ...DEFAULT_OPTIONS.jsPDF,
    ...(options.jsPDF || {}),
  },
});

const resolveElement = (elementOrId) => {
  if (!elementOrId) return null;
  if (typeof elementOrId === 'string') {
    return document.getElementById(elementOrId);
  }
  return elementOrId;
};

const loadPdfDeps = async () => {
  const [{ default: html2canvas }, jsPdfModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const jsPDF = jsPdfModule.jsPDF || jsPdfModule.default?.jsPDF || jsPdfModule.default;
  return { html2canvas, jsPDF };
};

export const captureElementAsImage = async (elementOrId, html2canvasOptions = {}) => {
  const element = resolveElement(elementOrId);
  if (!element) return null;

  try {
    const { html2canvas } = await loadPdfDeps();
    const canvas = await html2canvas(element, {
      ...DEFAULT_OPTIONS.html2canvas,
      ...html2canvasOptions,
    });

    const imageType = html2canvasOptions.imageType === 'png' ? 'image/png' : 'image/jpeg';
    const quality = html2canvasOptions.imageQuality ?? DEFAULT_OPTIONS.image.quality;
    return canvas.toDataURL(imageType, quality);
  } catch (error) {
    console.error('Failed to capture element:', error);
    return null;
  }
};

export const saveElementAsPdf = async (elementOrId, options = {}) => {
  const element = resolveElement(elementOrId);
  if (!element) {
    throw new Error('PDF source element not found');
  }

  const merged = mergeOptions(options);
  const { html2canvas, jsPDF } = await loadPdfDeps();
  const canvas = await html2canvas(element, merged.html2canvas);
  const pdf = new jsPDF(merged.jsPDF);

  const margin = Number(merged.margin) || 0;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = Math.max(pageWidth - margin * 2, 1);
  const printableHeight = Math.max(pageHeight - margin * 2, 1);
  const scale = printableWidth / canvas.width;
  const sliceHeight = Math.max(Math.floor(printableHeight / scale), 1);
  const mimeType = merged.image.type === 'png' ? 'PNG' : 'JPEG';

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = currentSliceHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare PDF canvas context');
    }

    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight
    );

    const pageImage = pageCanvas.toDataURL(
      merged.image.type === 'png' ? 'image/png' : 'image/jpeg',
      merged.image.quality
    );
    const renderedHeight = currentSliceHeight * scale;

    if (pageIndex > 0) {
      pdf.addPage(merged.jsPDF.format, merged.jsPDF.orientation);
    }

    pdf.addImage(pageImage, mimeType, margin, margin, printableWidth, renderedHeight);

    sourceY += currentSliceHeight;
    pageIndex += 1;
  }

  pdf.save(merged.filename);
};

/**
 * Render an HTML element to raw PDF bytes (ArrayBuffer) without auto-downloading.
 * Used by Factur-X to post-process the PDF with pdf-lib before download.
 */
export const saveElementAsPdfBytes = async (elementOrId, options = {}) => {
  const element = resolveElement(elementOrId);
  if (!element) {
    throw new Error('PDF source element not found');
  }

  const merged = mergeOptions(options);
  const { html2canvas, jsPDF } = await loadPdfDeps();
  const canvas = await html2canvas(element, merged.html2canvas);
  const pdf = new jsPDF(merged.jsPDF);

  const margin = Number(merged.margin) || 0;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = Math.max(pageWidth - margin * 2, 1);
  const printableHeight = Math.max(pageHeight - margin * 2, 1);
  const scale = printableWidth / canvas.width;
  const sliceHeight = Math.max(Math.floor(printableHeight / scale), 1);
  const mimeType = merged.image.type === 'png' ? 'PNG' : 'JPEG';

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = currentSliceHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare PDF canvas context');
    }

    context.drawImage(
      canvas, 0, sourceY, canvas.width, currentSliceHeight,
      0, 0, canvas.width, currentSliceHeight
    );

    const pageImage = pageCanvas.toDataURL(
      merged.image.type === 'png' ? 'image/png' : 'image/jpeg',
      merged.image.quality
    );
    const renderedHeight = currentSliceHeight * scale;

    if (pageIndex > 0) {
      pdf.addPage(merged.jsPDF.format, merged.jsPDF.orientation);
    }

    pdf.addImage(pageImage, mimeType, margin, margin, printableWidth, renderedHeight);

    sourceY += currentSliceHeight;
    pageIndex += 1;
  }

  return pdf.output('arraybuffer');
};

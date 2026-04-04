import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html2canvasMock = vi.fn();
const jsPDFConstructor = vi.fn();

vi.mock('html2canvas', () => ({
  default: html2canvasMock,
}));

vi.mock('jspdf', () => ({
  jsPDF: jsPDFConstructor,
}));

import { captureElementAsImage, saveElementAsPdf, saveElementAsPdfBytes } from '@/services/pdfExportRuntime';

const createPdfMock = () => ({
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  },
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
  output: vi.fn(() => new ArrayBuffer(16)),
});

describe('pdfExportRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="target"><span>CashPilot</span></div>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when capture target is missing', async () => {
    const result = await captureElementAsImage('unknown-id');
    expect(result).toBeNull();
  });

  it('captures an element as png image', async () => {
    const sourceCanvas = {
      width: 800,
      height: 600,
      toDataURL: vi.fn(() => 'data:image/png;base64,stub'),
    };
    html2canvasMock.mockResolvedValue(sourceCanvas);

    const result = await captureElementAsImage('target', {
      imageType: 'png',
      imageQuality: 0.9,
    });

    expect(result).toBe('data:image/png;base64,stub');
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(sourceCanvas.toDataURL).toHaveBeenCalledWith('image/png', 0.9);
  });

  it('returns null when capture fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    html2canvasMock.mockRejectedValue(new Error('boom'));

    const result = await captureElementAsImage('target');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('throws when source element is missing for PDF save', async () => {
    await expect(saveElementAsPdf('unknown')).rejects.toThrow('PDF source element not found');
    await expect(saveElementAsPdfBytes('unknown')).rejects.toThrow('PDF source element not found');
  });

  it('renders multi-page PDF and saves with expected filename', async () => {
    const sourceCanvas = {
      width: 1000,
      height: 4000,
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,source'),
    };
    const pdfMock = createPdfMock();
    html2canvasMock.mockResolvedValue(sourceCanvas);
    jsPDFConstructor.mockImplementation(function MockJsPdf() {
      return pdfMock;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,page');

    await saveElementAsPdf('target', {
      filename: 'cashpilot-report.pdf',
      margin: 12,
      image: { type: 'jpeg', quality: 0.85 },
    });

    expect(pdfMock.addImage).toHaveBeenCalled();
    expect(pdfMock.addPage).toHaveBeenCalled();
    expect(pdfMock.save).toHaveBeenCalledWith('cashpilot-report.pdf');
  });

  it('throws when page canvas context cannot be created', async () => {
    const sourceCanvas = {
      width: 600,
      height: 1200,
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,source'),
    };
    html2canvasMock.mockResolvedValue(sourceCanvas);
    jsPDFConstructor.mockImplementation(function MockJsPdf() {
      return createPdfMock();
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(saveElementAsPdf('target')).rejects.toThrow('Could not prepare PDF canvas context');
  });

  it('returns raw pdf bytes for downstream post-processing', async () => {
    const sourceCanvas = {
      width: 1000,
      height: 1500,
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,source'),
    };
    const pdfMock = createPdfMock();
    html2canvasMock.mockResolvedValue(sourceCanvas);
    jsPDFConstructor.mockImplementation(function MockJsPdf() {
      return pdfMock;
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,page');

    const output = await saveElementAsPdfBytes(document.getElementById('target'), {
      image: { type: 'png', quality: 1 },
    });

    expect(output).toBeInstanceOf(ArrayBuffer);
    expect(pdfMock.output).toHaveBeenCalledWith('arraybuffer');
    expect(pdfMock.addImage).toHaveBeenCalled();
  });
});

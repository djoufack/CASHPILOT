import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({ eq: mockEq }),
    })),
  },
}));

import { uploadDocument } from '@/services/documentStorage';

describe('documentStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed-url.example.com/doc.pdf' },
    });
    mockEq.mockResolvedValue({ error: null });
  });

  it('should upload document and return URL', async () => {
    const result = await uploadDocument({
      bucket: 'invoices',
      userId: 'user1',
      fileName: 'INV-001.pdf',
      fileData: new Blob(['pdf content']),
      contentType: 'application/pdf',
    });

    expect(result).toHaveProperty('url', 'https://signed-url.example.com/doc.pdf');
    expect(result).toHaveProperty('path', 'user1/INV-001.pdf');
    expect(mockUpload).toHaveBeenCalled();
  });

  it('should throw when required params are missing', async () => {
    await expect(uploadDocument({ bucket: 'invoices' })).rejects.toThrow('requires userId');
    await expect(uploadDocument({ bucket: 'invoices', userId: 'u1' })).rejects.toThrow('requires userId');
    await expect(uploadDocument({ bucket: 'invoices', userId: 'u1', fileName: 'f.pdf' })).rejects.toThrow(
      'requires userId'
    );
  });

  it('should throw on upload error', async () => {
    mockUpload.mockResolvedValue({ error: new Error('Upload failed') });

    await expect(
      uploadDocument({
        bucket: 'invoices',
        userId: 'user1',
        fileName: 'INV-001.pdf',
        fileData: new Blob(['data']),
        contentType: 'application/pdf',
      })
    ).rejects.toThrow('Upload failed');
  });

  it('should update DB record when table and recordId are provided', async () => {
    await uploadDocument({
      bucket: 'invoices',
      userId: 'user1',
      fileName: 'INV-001.pdf',
      fileData: new Blob(['data']),
      contentType: 'application/pdf',
      table: 'invoices',
      recordId: 'inv-123',
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'inv-123');
  });

  it('should not update DB when table/recordId not provided', async () => {
    await uploadDocument({
      bucket: 'invoices',
      userId: 'user1',
      fileName: 'INV-001.pdf',
      fileData: new Blob(['data']),
      contentType: 'application/pdf',
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should use filePath as URL when signedUrl not available', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null });

    const result = await uploadDocument({
      bucket: 'invoices',
      userId: 'user1',
      fileName: 'INV-001.pdf',
      fileData: new Blob(['data']),
      contentType: 'application/pdf',
    });

    expect(result.url).toBe('user1/INV-001.pdf');
  });
});

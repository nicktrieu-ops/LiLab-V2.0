// Server-only helpers for curriculum materials and media kept in Cloud Storage.
import { adminBucket } from '../lib/firebase-admin.ts';

export interface StoredMaterial {
  noteId: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  rawText: string;
}

const MATERIAL_PREFIX = 'protected_materials/';
const MEDIA_PREFIX = 'media/';

export async function saveProtectedMaterial(input: {
  noteId: string;
  fileName: string;
  mimeType: string;
  contentBase64?: string;
  rawText?: string;
  uploadedByUid?: string;
}): Promise<void> {
  const bucket = adminBucket();
  const metadata = {
    fileName: input.fileName,
    sourceMimeType: input.mimeType,
    uploadedByUid: input.uploadedByUid || '',
  };
  if (input.contentBase64) {
    await bucket.file(`${MATERIAL_PREFIX}${input.noteId}/content`).save(Buffer.from(input.contentBase64, 'base64'), {
      contentType: input.mimeType,
      resumable: false,
      metadata: { cacheControl: 'private, no-store', metadata },
    });
  }
  if (input.rawText) {
    await bucket.file(`${MATERIAL_PREFIX}${input.noteId}/text.txt`).save(input.rawText, {
      contentType: 'text/plain; charset=utf-8',
      resumable: false,
      metadata: { cacheControl: 'private, no-store', metadata },
    });
  }
}

async function readIfExists(path: string): Promise<{ buffer: Buffer; contentType: string; meta: Record<string, string> } | null> {
  const file = adminBucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return {
    buffer,
    contentType: String(metadata.contentType || 'application/octet-stream'),
    meta: (metadata.metadata || {}) as Record<string, string>,
  };
}

export async function loadProtectedMaterial(noteId: string): Promise<StoredMaterial | null> {
  const [content, text] = await Promise.all([
    readIfExists(`${MATERIAL_PREFIX}${noteId}/content`),
    readIfExists(`${MATERIAL_PREFIX}${noteId}/text.txt`),
  ]);
  if (!content && !text) return null;
  const meta = content?.meta || text?.meta || {};
  return {
    noteId,
    fileName: meta.fileName || 'Curriculum material',
    mimeType: content?.contentType || 'text/plain',
    dataBase64: content ? content.buffer.toString('base64') : '',
    rawText: text ? text.buffer.toString('utf-8') : '',
  };
}

export async function loadMediaAsset(key: string): Promise<{ buffer: Buffer; mimeType: string; etag: string } | null> {
  const file = adminBucket().file(`${MEDIA_PREFIX}${key}`);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return {
    buffer,
    mimeType: String(metadata.contentType || 'application/octet-stream'),
    etag: `"${metadata.md5Hash || `${key}-${buffer.length}`}"`,
  };
}

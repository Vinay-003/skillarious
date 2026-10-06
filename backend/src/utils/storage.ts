import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { UploadedFile } from 'express-fileupload';

const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || 'public-assets';
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || 'course-content';
const allowed = new Map([
  ['application/pdf', ['.pdf']], ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']], ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']], ['image/webp', ['.webp']],
  ['text/plain', ['.txt']],
]);

export function validateUpload(file: Pick<UploadedFile, 'name' | 'mimetype' | 'size'>) {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (!extension || !allowed.get(file.mimetype)?.includes(extension) || file.size <= 0 || file.size > 50 * 1024 * 1024) {
    throw new Error('Unsupported file type or size');
  }
  return extension;
}

export function parseStorageReference(reference: string): { bucket: string; key: string } | null {
  const match = /^storage:\/\/([a-z0-9-]+)\/([a-zA-Z0-9/_-]+\.[a-z0-9]+)$/.exec(reference);
  if (!match || ![PUBLIC_BUCKET, PRIVATE_BUCKET].includes(match[1]) || match[2].includes('..')) return null;
  return { bucket: match[1], key: match[2] };
}

export function storageCredentials(env: NodeJS.ProcessEnv): { url: string; key: string } {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Supabase Storage is not configured');
  return { url, key };
}

function client() {
  const { url, key } = storageCredentials(process.env);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function uploadMedia(file: UploadedFile, options: { public?: boolean } = {}) {
  const extension = validateUpload(file);
  const bucket = options.public ? PUBLIC_BUCKET : PRIVATE_BUCKET;
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${extension}`;
  const bytes = file.tempFilePath ? await readFile(file.tempFilePath) : file.data;
  const { error } = await client().storage.from(bucket).upload(key, bytes, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return { url: `storage://${bucket}/${key}`, public_id: key, fileName: file.name, mimeType: file.mimetype, size: file.size };
}

export async function deleteMedia(reference: string) {
  const parsed = parseStorageReference(reference);
  if (!parsed) throw new Error('Legacy or invalid storage reference; migrate before deletion');
  const { error } = await client().storage.from(parsed.bucket).remove([parsed.key]);
  if (error) throw error;
  return true;
}

export async function getSignedMediaUrl(reference: string, expiresIn = 300) {
  const parsed = parseStorageReference(reference);
  if (!parsed) throw new Error('Legacy or invalid storage reference');
  const { data, error } = await client().storage.from(parsed.bucket).createSignedUrl(parsed.key, expiresIn);
  if (error || !data?.signedUrl) throw error || new Error('Could not sign URL');
  return data.signedUrl;
}

export async function downloadMedia(reference: string, maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const parsed = parseStorageReference(reference);
  if (!parsed) throw new Error('Legacy or invalid storage reference');
  const { data, error } = await client().storage.from(parsed.bucket).download(parsed.key);
  if (error || !data) throw error || new Error('Could not download file');
  if (data.size > maxBytes) throw new Error('File is too large to parse');
  return Buffer.from(await data.arrayBuffer());
}

export function getPublicIdFromUrl(reference: string) {
  return parseStorageReference(reference)?.key || '';
}

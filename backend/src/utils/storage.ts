import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { UploadedFile } from 'express-fileupload';
import { promises as fs } from 'fs';
import path from 'path';

dotenv.config();

// Create Supabase client with realtime enabled
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Initialize realtime channels
const doubtChannel = supabase.channel('doubt-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'doubts'
    },
    (payload) => {
      console.log('Doubt change:', payload);
    }
  )
  .subscribe();

const messageChannel = supabase.channel('message-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'messages'
    },
    (payload) => {
      console.log('Message change:', payload);
    }
  )
  .subscribe();

export { doubtChannel, messageChannel };

const uploadsRoot = path.join(process.cwd(), 'uploads');

const getPublicBackendUrl = () => {
  if (process.env.BACKEND_PUBLIC_URL) {
    return process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '');
  }

  const port = process.env.PORT || '4001';
  return `http://localhost:${port}`;
};

export const uploadMedia = async (file: UploadedFile) => {
  try {
    if (!file) {
      throw new Error('Invalid file object');
    }

    const cleanFileName = path
      .basename(file.name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_');
    
    const uniqueFileName = `${Date.now()}-${cleanFileName}`;
    const yearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const destinationDir = path.join(uploadsRoot, yearMonth);
    await fs.mkdir(destinationDir, { recursive: true });

    const destinationPath = path.join(destinationDir, uniqueFileName);
    const tempFilePath = file.tempFilePath;

    if (tempFilePath) {
      await fs.copyFile(tempFilePath, destinationPath);
      await fs.unlink(tempFilePath).catch(() => undefined);
    } else {
      await fs.writeFile(destinationPath, file.data);
    }

    const relativePath = `/uploads/${yearMonth}/${uniqueFileName}`;
    const url = `${getPublicBackendUrl()}${relativePath}`;

    return {
      url,
      public_id: `${yearMonth}/${uniqueFileName}`,
      fileName: file.name,
      mimeType: file.mimetype,
      size: file.size
    };
  } catch (error) {
    console.error('Error uploading media locally:', error);
    throw new Error('Failed to upload file to storage');
  }
};

export const deleteMedia = async (fileUrl: string) => {
  try {
    const relativePath = getPublicIdFromUrl(fileUrl);
    if (!relativePath) {
      throw new Error('Invalid file URL');
    }

    const absolutePath = path.join(uploadsRoot, relativePath.replace(/^\/+/, ''));
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    console.error('Error deleting local media:', error);
    throw new Error('Failed to delete file from storage');
  }
};

export const getPublicIdFromUrl = (url: string): string => {
  if (!url) return '';

  if (url.startsWith('/uploads/')) {
    return url.replace(/^\/uploads\//, '');
  }

  const uploadsIndex = url.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    return url.slice(uploadsIndex + '/uploads/'.length);
  }

  return '';
};







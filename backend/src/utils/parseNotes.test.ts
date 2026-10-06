import { expect, it } from 'vitest';
import { parsePdfNotes } from './parseNotes.ts';
it('rejects non-PDF input before parsing', async () => {
  await expect(parsePdfNotes(Buffer.from('not a PDF'))).rejects.toThrow('valid text PDF');
});
it('rejects oversized PDFs before spawning a parser', async () => {
  const bytes = Buffer.alloc(10 * 1024 * 1024 + 1); bytes.write('%PDF-');
  await expect(parsePdfNotes(bytes)).rejects.toThrow('under 10 MB');
});

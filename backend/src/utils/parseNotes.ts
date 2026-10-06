import { Worker } from 'node:worker_threads';
import { LearningError } from './learningAI.ts';
export async function parsePdfNotes(bytes: Buffer): Promise<string> {
  if (bytes.length > 10 * 1024 * 1024 || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new LearningError('Provide a valid text PDF under 10 MB.', 422);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-worker.cjs', import.meta.url), { workerData: bytes, resourceLimits: { maxOldGenerationSizeMb: 96 } });
    let settled = false;
    const finish = (text?: string) => {
      if (settled) return; settled = true; clearTimeout(timer); void worker.terminate();
      if (text?.trim()) resolve(text); else reject(new LearningError('This PDF could not be read. Scanned notes need OCR; try a smaller text PDF.', 422));
    };
    const timer = setTimeout(() => finish(), 8000);
    worker.once('message', data => finish(data.text)); worker.once('error', () => finish()); worker.once('exit', () => finish());
  });
}

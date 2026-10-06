import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { projectRef, files, run, safeFailure, BootstrapRefusal } from './migrateEmpty.ts';

describe('empty Supabase bootstrap', () => {
  it('accepts only Supabase direct or pooler project references', () => {
    expect(projectRef('postgres://postgres:secret@db.ykllmcwljsfeluhpvzbv.supabase.co/postgres')).toBe('ykllmcwljsfeluhpvzbv');
    expect(projectRef('postgres://postgres.ykllmcwljsfeluhpvzbv:secret@aws-0-us-east-1.pooler.supabase.com/postgres')).toBe('ykllmcwljsfeluhpvzbv');
    expect(projectRef('postgres://postgres:secret@localhost/postgres')).toBeNull();
  });
  it('rejects invalid mode or absent confirmation before connecting', async () => {
    await expect(run(['apply'])).rejects.toThrow('Usage:');
    await expect(run(['reset', '--project-ref=ykllmcwljsfeluhpvzbv'])).rejects.toThrow('Usage:');
  });
  it('keeps generated core and security companion in fixed order', () => {
    expect(files).toEqual(['0000_empty_schema.sql', '0001_empty_security_storage.sql']);
    const core = readFileSync(new URL('../sql/0000_empty_schema.sql', import.meta.url), 'utf8');
    const generated = readFileSync(new URL('../supabase/bootstrap/0000_cultured_hydra.sql', import.meta.url), 'utf8');
    expect(core).toBe(generated);
    const security = readFileSync(new URL('../sql/0001_empty_security_storage.sql', import.meta.url), 'utf8');
    expect(core).toContain('"content_id" uuid NOT NULL');
    expect(core).toContain('"doubts_content_id_content_id_fk"');
    expect(core).toContain('"doubts_class_id_content_id_fk"');
    expect(core).toContain('"message" text NOT NULL');
    expect(core).toContain('"status" text DEFAULT \'open\' NOT NULL');
    for (const constraint of ['doubts_class_matches_content', 'doubts_status_valid', 'doubts_resolved_matches_status', 'doubts_message_length', 'doubts_title_length', 'doubts_description_length', 'doubts_content_id_idx', 'doubts_user_id_idx', 'messages_doubt_id_idx']) expect(core).toContain(constraint);
    expect(security).toContain('ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY');
    expect(security).toContain("'course-content', 'course-content', false, 52428800, ARRAY['application/pdf','text/plain'");
    expect(security).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role');
  });
  it('only exposes fixed safe errors, not credentials or database diagnostics', () => {
    expect(safeFailure(new BootstrapRefusal('Target is not empty'))).toBe('Target is not empty');
    expect(safeFailure({ code: '28P01', message: 'password secret' })).not.toContain('secret');
    expect(safeFailure(new Error('postgres://user:secret@host'))).not.toContain('secret');
  });
});

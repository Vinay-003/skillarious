import { describe, expect, it } from 'vitest';
import { buildSQL, loadMigrations, parseArgs, TARGET_REF } from './migrateViaCLI.ts';

describe('pinned empty-project CLI bootstrap', () => {
  it('rejects wrong targets, missing confirmation and extra arguments without accessing credentials', () => {
    const confirmed = { CONFIRMED_EMPTY_PROJECT_REF: TARGET_REF };
    expect(parseArgs(['check', `--project-ref=${TARGET_REF}`], confirmed)).toBe('check');
    expect(parseArgs(['apply', `--project-ref=${TARGET_REF}`], confirmed)).toBe('apply');
    expect(() => parseArgs(['apply', `--project-ref=${TARGET_REF}`], {})).toThrow();
    expect(() => parseArgs(['apply', '--project-ref=other'], confirmed)).toThrow();
    expect(() => parseArgs(['apply', `--project-ref=${TARGET_REF}`, '--extra'], confirmed)).toThrow();
  });

  it('generates one transaction with locked preflight, matching journal and verification for replay', async () => {
    const migrations = await loadMigrations();
    const apply = buildSQL('apply', migrations);
    const check = buildSQL('check', migrations);
    expect(apply).toMatch(/^BEGIN;/);
    expect(apply).toMatch(/COMMIT;\s*SELECT 'empty-bootstrap-apply-ok' AS result;$/);
    expect(apply).toContain('pg_advisory_xact_lock(182734, 1)');
    expect(apply.indexOf('pg_advisory_xact_lock')).toBeLessThan(apply.indexOf('to_regclass'));
    expect(apply).toContain('IF matched <> 2');
    expect(apply).toContain('IF occupied <> 0 OR bucket_count <> 0');
    expect(apply).toContain('IF occupied <> 23 OR bucket_count <> 2');
    expect(apply).toContain('GRANT SELECT, INSERT ON public.empty_bootstrap_journal TO service_role');
    expect(apply).toContain('doubts_content_id_content_id_fk');
    expect(apply).toContain('cardinality(allowed_mime_types)=7');
    expect(check).toContain('IF journal_count = 2 THEN');
    expect(check).not.toContain('CREATE TABLE public.empty_bootstrap_journal');
    for (const migration of migrations) {
      expect(migration.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(apply).toContain(migration.checksum);
      expect(apply).toContain(migration.name);
    }
  });
});

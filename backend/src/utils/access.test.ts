import { describe, expect, it } from 'vitest';
import { getContentAccess, getCourseForContent, isUuid } from './access.ts';

describe('access input boundaries', () => {
  it('rejects malformed identifiers before querying storage', async () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(await getContentAccess('invalid', 'also-invalid')).toBeNull();
    expect(await getCourseForContent('invalid')).toBeNull();
  });
});

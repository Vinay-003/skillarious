import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ owners: [] as unknown[], enrollments: [] as unknown[] }));
import { coursesTable } from '../db/schema.ts';
vi.mock('../db/index.ts', () => ({
  db: {
    select: () => ({
      from(table: unknown) {
        const rows = table === coursesTable ? state.owners : state.enrollments;
        const builder = { innerJoin: () => builder, where: () => builder, limit: async () => rows };
        return builder;
      },
    }),
  },
}));

import { getContentAccess } from './access.ts';
const student = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const course = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('course access policy', () => {
  beforeEach(() => { state.owners = []; state.enrollments = []; });
  it('denies users without matching owner or completed enrollment', async () => {
    expect(await getContentAccess(student, course)).toBeNull();
  });
  it('allows owner access', async () => {
    state.owners = [{ id: course }];
    expect(await getContentAccess(student, course)).toBe('owner');
  });
  it('allows completed enrollment', async () => {
    state.enrollments = [{ id: 'transaction' }];
    expect(await getContentAccess(student, course)).toBe('enrolled');
  });
});

import { beforeEach, expect, it, vi } from 'vitest';
import { nativeFeedSnapshot } from '@/lib/server/native-feed';

const fixture = vi.hoisted(() => ({
  calls: [] as [string, string, ...unknown[]][],
  rows: {} as Record<string, unknown[]>,
  failure: null as string | null,
}));
const from = vi.fn((table: string) => {
  const query = {
    select: (columns: string) => {
      fixture.calls.push([table, 'select', columns]);
      return query;
    },
    order: (column: string, options?: unknown) => {
      fixture.calls.push([table, 'order', column, options]);
      return query;
    },
    limit: (count: number) => {
      fixture.calls.push([table, 'limit', count]);
      return query;
    },
    or: (filter: string) => {
      fixture.calls.push([table, 'or', filter]);
      return query;
    },
    eq: (column: string, value: string) => {
      fixture.calls.push([table, 'eq', column, value]);
      return query;
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: fixture.rows[table] ?? [],
        error: fixture.failure === table ? { message: 'Fixture database error' } : null,
      }).then(resolve),
  };
  return query;
});
const subject = {
  db: { from },
  user: { id: 'fixture-user' },
  profile: { id: 'fixture-user', username: 'fixture', display_name: 'Fixture', disabled: false },
} as unknown as Parameters<typeof nativeFeedSnapshot>[0];

beforeEach(() => {
  fixture.calls = [];
  fixture.failure = null;
  fixture.rows = {
    profiles: [{ id: 'fixture-user', username: 'fixture', display_name: 'Fixture', bio: '' }],
    follows: [{ follower_id: 'fixture-user', following_id: 'other', accepted: true }],
    posts: [{ id: 'post-1', created_at: '2026-10-27T10:00:00Z', circle_links: [] }],
  };
  from.mockClear();
});

it('reads exactly the three M1 areas with the verified user client and minimal columns', async () => {
  const result = await nativeFeedSnapshot(subject);
  expect(from.mock.calls.map(([table]) => table)).toEqual(['profiles', 'posts', 'follows']);
  expect(Object.keys(result).sort()).toEqual([
    'follows',
    'me',
    'nextCursor',
    'nextPostId',
    'posts',
    'profiles',
    'user_id',
  ]);
  expect(result.me).toEqual({ id: 'fixture-user', username: 'fixture', display_name: 'Fixture' });
  expect(result.posts).toEqual(fixture.rows.posts);
  expect(result.follows).toEqual(fixture.rows.follows);
  expect(fixture.calls).toContainEqual(['follows', 'eq', 'follower_id', 'fixture-user']);
  for (const [, operation, columns] of fixture.calls) {
    if (operation === 'select') expect(columns).not.toContain('*');
  }
  expect(fixture.calls).toContainEqual(['posts', 'order', 'created_at', { ascending: false }]);
  expect(fixture.calls).toContainEqual(['posts', 'order', 'id', { ascending: false }]);
  expect(fixture.calls).toContainEqual(['posts', 'limit', 40]);
  expect(
    fixture.calls.find(([table, operation]) => table === 'posts' && operation === 'select')?.[2],
  ).toContain('circle_links:circle_posts(post_id)');
  expect(
    fixture.calls.find(([table, operation]) => table === 'posts' && operation === 'or')?.[2],
  ).toMatch(/^expires_at.is.null,expires_at.gt./);
});

it('keeps the composite timestamp/id cursor including ties, and ends short/empty pages', async () => {
  fixture.rows.posts = Array.from({ length: 40 }, (_, index) => ({
    id: 'post-' + index,
    created_at: '2026-10-27T10:00:00Z',
  }));
  expect(await nativeFeedSnapshot(subject)).toMatchObject({
    nextCursor: '2026-10-27T10:00:00Z',
    nextPostId: 'post-39',
  });
  fixture.rows.posts = [];
  expect(await nativeFeedSnapshot(subject)).toMatchObject({ nextCursor: null, nextPostId: null });
});

it.each(['profiles', 'posts', 'follows'])(
  'propagates %s failures instead of returning an incomplete success',
  async (table) => {
    fixture.failure = table;
    await expect(nativeFeedSnapshot(subject)).rejects.toMatchObject({ status: 400 });
  },
);

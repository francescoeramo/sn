import { beforeEach, expect, it, vi } from 'vitest';
import { nativeStoriesPage } from '@/lib/server/native-stories';

const fixture = vi.hoisted(() => ({
  calls: [] as [string, string, ...unknown[]][],
  rows: {} as Record<string, Record<string, unknown>[]>,
  failure: null as string | null,
}));
const from = vi.fn((table: string) => {
  const query = {
    select: (columns: string) => {
      fixture.calls.push([table, 'select', columns]);
      return query;
    },
    eq: (column: string, value: unknown) => {
      fixture.calls.push([table, 'eq', column, value]);
      return query;
    },
    in: (column: string, value: unknown[]) => {
      fixture.calls.push([table, 'in', column, value]);
      return query;
    },
    gt: (column: string, value: string) => {
      fixture.calls.push([table, 'gt', column, value]);
      return query;
    },
    order: (column: string, options: object) => {
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
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: fixture.rows[table] ?? [],
        error: fixture.failure === table ? { message: 'Fixture database error' } : null,
      }).then(resolve),
  };
  return query;
});
const subject = { db: { from }, user: { id: 'me' } } as unknown as Parameters<
  typeof nativeStoriesPage
>[0];
const timestamp = '2026-10-27T12:00:00Z';
const story = (index: number) => ({
  id: 'story-' + index,
  author_id: 'friend',
  kind: 'story',
  body: '',
  media_path: 'friend/photo.jpg',
  media_type: 'image/jpeg',
  alt: 'Descrizione',
  content_warning: null,
  created_at: timestamp,
  expires_at: '2026-10-28T12:00:00Z',
  author: { id: 'friend', username: 'friend', display_name: 'Friend' },
  media: [],
});
beforeEach(() => {
  fixture.calls = [];
  fixture.failure = null;
  fixture.rows = {
    follows: [{ following_id: 'friend' }],
    posts: [story(1)],
    story_views: [{ story_id: 'story-1' }],
  };
  from.mockClear();
});
it('limits the read to own/followed active stories and exposes only the caller viewed bit', async () => {
  const result = await nativeStoriesPage(subject);
  expect(result).toEqual({ stories: [{ ...story(1), viewed: true }], nextCursor: null });
  expect(from.mock.calls.map(([table]) => table)).toEqual(['follows', 'posts', 'story_views']);
  expect(fixture.calls).toContainEqual(['follows', 'eq', 'follower_id', 'me']);
  expect(fixture.calls).toContainEqual(['follows', 'eq', 'accepted', true]);
  expect(fixture.calls).toContainEqual(['posts', 'eq', 'kind', 'story']);
  expect(fixture.calls).toContainEqual(['posts', 'in', 'author_id', ['me', 'friend']]);
  expect(fixture.calls).toContainEqual([
    'posts',
    'gt',
    'expires_at',
    expect.stringMatching(/^\d{4}-/),
  ]);
  expect(fixture.calls).toContainEqual(['story_views', 'eq', 'viewer_id', 'me']);
  expect(fixture.calls).toContainEqual(['story_views', 'in', 'story_id', ['story-1']]);
  expect(fixture.calls).toContainEqual(['story_views', 'select', 'story_id']);
  for (const [, method, columns] of fixture.calls)
    if (method === 'select') expect(columns).not.toContain('*');
});
it('uses 41-row lookahead and a deterministic timestamp/id boundary, excluding the lookahead from viewed reads', async () => {
  fixture.rows.posts = Array.from({ length: 41 }, (_, i) => story(i));
  const cursor = { created_at: timestamp, post_id: '00000000-0000-4000-8000-000000000100' };
  const result = await nativeStoriesPage(subject, cursor);
  expect(result.stories).toHaveLength(40);
  expect(result.nextCursor).toEqual({ created_at: timestamp, post_id: 'story-39' });
  expect(fixture.calls).toContainEqual(['posts', 'limit', 41]);
  expect(fixture.calls).toContainEqual(['posts', 'order', 'created_at', { ascending: false }]);
  expect(fixture.calls).toContainEqual(['posts', 'order', 'id', { ascending: false }]);
  expect(fixture.calls).toContainEqual([
    'posts',
    'or',
    `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${cursor.post_id})`,
  ]);
  const ids = fixture.calls.find(
    ([table, method]) => table === 'story_views' && method === 'in',
  )?.[3] as string[];
  expect(ids).toHaveLength(40);
  expect(ids).not.toContain('story-40');
});
it('ends at exactly 40 rows, returns unseen for missing receipts, and does not query views on an empty page', async () => {
  fixture.rows.posts = Array.from({ length: 40 }, (_, i) => story(i));
  fixture.rows.story_views = [];
  const page = await nativeStoriesPage(subject);
  expect(page.nextCursor).toBeNull();
  expect(page.stories.every((item) => item.viewed === false)).toBe(true);
  fixture.rows.posts = [];
  from.mockClear();
  expect(await nativeStoriesPage(subject)).toEqual({ stories: [], nextCursor: null });
  expect(from.mock.calls.map(([table]) => table)).toEqual(['follows', 'posts']);
});
it.each(['follows', 'posts', 'story_views'])(
  'propagates %s errors rather than emitting a partial success',
  async (table) => {
    fixture.failure = table;
    await expect(nativeStoriesPage(subject)).rejects.toMatchObject({ status: 400 });
  },
);

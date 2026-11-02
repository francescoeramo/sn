import { expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/server/supabase', () => {
  const query = (name: string) => {
    const builder = {
      select: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: () => builder,
      is: () => builder,
      range: () => builder,
      then: (resolve: (value: unknown) => unknown) => {
        calls.push(name);
        const data =
          name === 'my_usage'
            ? { isAdmin: false, bytes: 0, total_bytes: 0, members: 1, uploads_enabled: true }
            : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return builder;
  };
  const db = { from: query, rpc: query };
  return {
    identity: async () => ({ db, user: { id: 'u' }, profile: { id: 'u' } }),
    adminDatabase: () => db,
    checked: (r: { data: unknown; error: unknown }) => {
      if (r.error) throw r.error;
      return r.data;
    },
    ApiError: class extends Error {},
  };
});
import { snapshot } from '@/lib/server/social';

it('defers sections on the home bootstrap and preserves the complete legacy bootstrap', async () => {
  calls.length = 0;
  const home = await snapshot(undefined, true);
  expect(home.messages).toEqual([]);
  expect(home.events).toEqual([]);
  expect(calls).toContain('posts');
  expect(calls).toContain('circle_posts');
  expect(calls).not.toContain('messages');
  expect(calls).not.toContain('events');
  expect(calls).not.toContain('event_responses');
  const homeQueries = calls.length;
  calls.length = 0;
  await snapshot();
  expect(calls).toContain('messages');
  expect(calls).toContain('events');
  expect(calls).toContain('event_responses');
  expect(calls.length - homeQueries).toBeGreaterThanOrEqual(14);
});

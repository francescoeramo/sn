import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = vi.hoisted(() => ({ tables: [] as string[], denied: false }));
vi.mock('@/lib/server/supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/supabase')>();
  const query = {
    select: () => query,
    or: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    ...original,
    identity: async () => {
      if (fixture.denied) throw new original.ApiError('Accedi', 401);
      return {
        db: {
          from: (table: string) => {
            fixture.tables.push(table);
            return query;
          },
        },
        user: { id: 'user' },
      };
    },
  };
});
vi.mock('@/lib/server/social', () => ({
  mutate: vi.fn(async () => ({ ok: true })),
  snapshot: vi.fn(),
  exportData: vi.fn(),
  deleteAccount: vi.fn(),
  savedPage: vi.fn(),
}));
import { GET, POST } from '@/app/api/[...path]/route';
import { mutate } from '@/lib/server/social';
afterEach(() => {
  vi.unstubAllEnvs();
  fixture.denied = false;
  fixture.tables.length = 0;
  vi.mocked(mutate).mockClear();
});

it('reads only the message overview with authenticated private responses', async () => {
  const request = new NextRequest('https://sn.test/api/messages/overview');
  const context = { params: Promise.resolve({ path: ['messages', 'overview'] }) };
  const response = await GET(request, context);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toEqual({ messages: [], shares: [] });
  expect(fixture.tables).toEqual(['messages', 'shares']);
  fixture.denied = true;
  expect((await GET(request, context)).status).toBe(401);
});

it('preserves the old bookmark response unless the client opts into the compact contract', async () => {
  vi.stubEnv('APP_ORIGIN', 'https://sn.test');
  const send = (query: string) =>
    POST(
      new NextRequest(`https://sn.test/api/action${query}`, {
        method: 'POST',
        headers: { origin: 'https://sn.test', 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'bookmark', post_id: 'id', saved: true }),
      }),
      { params: Promise.resolve({ path: ['action'] }) },
    );
  expect((await send('')).status).toBe(200);
  expect(mutate).toHaveBeenLastCalledWith(expect.anything(), true);
  expect((await send('?compact=1')).status).toBe(200);
  expect(mutate).toHaveBeenLastCalledWith(expect.anything(), false);
  expect((await send('?home=1')).status).toBe(200);
  expect(mutate).toHaveBeenLastCalledWith(expect.anything(), true, undefined, true);
});

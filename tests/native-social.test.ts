import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = vi.hoisted(() => ({
  mfa: false,
  calls: [] as string[],
  rows: [] as { id: string; created_at: string }[],
  queryCalls: [] as [string, ...unknown[]][],
  identity: { db: {}, user: { id: 'native-user' }, profile: { id: 'native-user' } },
}));
vi.mock('@/lib/server/supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/supabase')>();
  const query = {
    select: () => query,
    lt: (key: string, value: string) => {
      fixture.queryCalls.push(['lt', key, value]);
      return query;
    },
    eq: (key: string, value: string) => {
      fixture.queryCalls.push(['eq', key, value]);
      return query;
    },
    is: (key: string, value: null) => {
      fixture.queryCalls.push(['is', key, value]);
      return query;
    },
    or: (filter: string) => {
      fixture.queryCalls.push(['or', filter]);
      return query;
    },
    order: (key: string, options: object) => {
      fixture.queryCalls.push(['order', key, options]);
      return query;
    },
    limit: (count: number) => {
      fixture.queryCalls.push(['limit', count]);
      return query;
    },
    then: (resolve: (value: { data: typeof fixture.rows; error: null }) => unknown) =>
      Promise.resolve({ data: fixture.rows, error: null }).then(resolve),
  };
  fixture.identity.db = {
    from: () => query,
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob(['photo'], { type: 'image/jpeg' }), error: null }),
      }),
    },
  };
  return {
    ...original,
    identity: async () => {
      throw new Error('Cookie fallback forbidden');
    },
    identityFrom: async (request: NextRequest) => {
      fixture.calls.push('identityFrom');
      if (original.requireBearer(request) !== 'valid') throw new original.ApiError('Invalid', 401);
      if (fixture.mfa) throw new original.ApiError('MFA', 403, 'mfa_required');
      return fixture.identity;
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

function post(
  route: string,
  token?: string,
  data: object = { body: 'Ciao', kind: 'post', media_path: null, alt: '' },
) {
  return POST(
    new NextRequest(`https://sn.test/api/${route}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'valid-web-session',
        ...(token ? { authorization: token } : {}),
      },
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ path: route.split('/') }) },
  );
}
function get(route: string, token: string) {
  return GET(
    new NextRequest(`https://sn.test/api/${route}`, {
      headers: { authorization: token, cookie: 'valid-web-session' },
    }),
    { params: Promise.resolve({ path: route.split('?')[0].split('/') }) },
  );
}
beforeEach(() => {
  fixture.mfa = false;
  fixture.calls.length = 0;
  fixture.queryCalls.length = 0;
  fixture.rows = [];
  vi.mocked(mutate).mockClear();
});
it('native bootstrap requires bearer without cookie fallback and keeps private response headers', async () => {
  const missing = await GET(
    new NextRequest('https://sn.test/api/native/bootstrap', {
      headers: { cookie: 'valid-web-session' },
    }),
    { params: Promise.resolve({ path: ['native', 'bootstrap'] }) },
  );
  expect(missing.status).toBe(401);
  expect(fixture.calls).toEqual([]);
  const response = await get('native/bootstrap', 'Bearer valid');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
  expect((await get('native/bootstrap', 'Bearer bad')).status).toBe(401);
  fixture.mfa = true;
  expect((await get('native/bootstrap', 'Bearer valid')).status).toBe(403);
});

it.each(['native/post', 'native/upload'])(
  '%s requires bearer even with a cookie',
  async (route) => {
    expect((await post(route)).status).toBe(401);
    expect(fixture.calls).toEqual([]);
    expect(mutate).not.toHaveBeenCalled();
  },
);
it.each(['native/post', 'native/upload'])(
  '%s rejects invalid bearer and missing MFA',
  async (route) => {
    expect((await post(route, 'Bearer bad')).status).toBe(401);
    fixture.mfa = true;
    expect((await post(route, 'Bearer valid')).status).toBe(403);
    expect(mutate).not.toHaveBeenCalled();
  },
);
it('native post uses the verified identity and shared mutation without Origin', async () => {
  const response = await post('native/post', 'Bearer valid');
  expect(response.status).toBe(200);
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'post', body: 'Ciao' }),
    false,
    fixture.identity,
  );
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('native post rejects stories and malformed input', async () => {
  expect(
    (
      await post('native/post', 'Bearer valid', {
        body: '',
        kind: 'story',
        media_path: 'path',
        alt: '',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post('native/post', 'Bearer valid', {
        body: 'x'.repeat(2201),
        kind: 'post',
        media_path: null,
        alt: '',
      })
    ).status,
  ).toBe(400);
  expect(mutate).not.toHaveBeenCalled();
});
it.each(['action', 'upload', 'native/anything'])('%s retains Origin protection', async (route) => {
  expect((await post(route, 'Bearer valid')).status).toBe(403);
  expect(mutate).not.toHaveBeenCalled();
});
it('native upload retains multipart validation', async () => {
  expect((await post('native/upload', 'Bearer valid')).status).toBe(415);
});
it.each([
  'profile/posts',
  'posts?before=2026-10-23T12%3A00%3A00Z',
  'media?path=00000000-0000-4000-8000-000000000001%2F00000000-0000-4000-8000-000000000002',
])('%s supports bearer reads and rejects invalid credentials', async (route) => {
  expect((await get(route, 'Bearer valid')).status).toBe(200);
  expect((await get(route, 'Bearer bad')).status).toBe(401);
  fixture.mfa = true;
  expect((await get(route, 'Bearer valid')).status).toBe(403);
});

it('native post preserves and validates the shared content warning contract', async () => {
  const data = {
    body: 'Contenuto',
    kind: 'post',
    media_path: null,
    alt: '',
    content_warning: '  Tema sensibile  ',
  };
  expect((await post('native/post', 'Bearer valid', data)).status).toBe(200);
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'post', content_warning: 'Tema sensibile' }),
    false,
    fixture.identity,
  );
  vi.mocked(mutate).mockClear();
  expect(
    (await post('native/post', 'Bearer valid', { ...data, content_warning: 'x'.repeat(161) }))
      .status,
  ).toBe(400);
  expect(mutate).not.toHaveBeenCalled();
});

it('own profile archive binds the author to the verified user and excludes circle posts', async () => {
  const response = await get('profile/posts?id=someone-else', 'Bearer valid');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ posts: [], nextCursor: null });
  expect(fixture.queryCalls).toEqual(
    expect.arrayContaining([
      ['eq', 'author_id', 'native-user'],
      ['eq', 'kind', 'post'],
      ['is', 'circle_links', null],
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 41],
    ]),
  );
  expect(
    fixture.queryCalls.some(
      ([op, value]) => op === 'or' && String(value).startsWith('expires_at.is.null,expires_at.gt.'),
    ),
  ).toBe(true);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('set-cookie')).toBeNull();
});

it('own profile cursor breaks timestamp ties and uses a lookahead row', async () => {
  const created_at = '2026-10-24T09:00:00.123456+00:00';
  fixture.rows = Array.from({ length: 41 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(100 - i).padStart(12, '0')}`,
    created_at,
  }));
  const first = await (await get('profile/posts', 'Bearer valid')).json();
  expect(first.posts).toHaveLength(40);
  expect(first.nextCursor).toEqual({ created_at, post_id: fixture.rows[39].id });
  expect(first.posts.at(-1).id).not.toBe(fixture.rows[40].id);
  const query = new URLSearchParams({ before: created_at, post_id: first.nextCursor.post_id });
  fixture.rows = [fixture.rows[40]];
  const second = await (await get(`profile/posts?${query}`, 'Bearer valid')).json();
  expect(second.posts).toHaveLength(1);
  expect(second.nextCursor).toBeNull();
  expect(fixture.queryCalls).toContainEqual([
    'or',
    `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${first.nextCursor.post_id})`,
  ]);
});

it.each([
  'before=2026-10-24T09%3A00%3A00Z',
  'post_id=00000000-0000-4000-8000-000000000001',
  'before=invalid&post_id=00000000-0000-4000-8000-000000000001',
  'before=2026-10-24T09%3A00%3A00Z&post_id=invalid',
])('own profile rejects malformed or incomplete cursor: %s', async (query) => {
  expect((await get(`profile/posts?${query}`, 'Bearer valid')).status).toBe(400);
  expect(fixture.queryCalls).toHaveLength(0);
});

it('exactly 40 profile posts have no next page without a lookahead row', async () => {
  fixture.rows = Array.from({ length: 40 }, (_, i) => ({
    id: String(i),
    created_at: '2026-10-24T09:00:00Z',
  }));
  const page = await (await get('profile/posts', 'Bearer valid')).json();
  expect(page.posts).toHaveLength(40);
  expect(page.nextCursor).toBeNull();
});

it('feed accepts a validated timestamp/id cursor without dropping timestamp ties', async () => {
  const before = '2026-10-24T09:00:00.123456+00:00';
  const post_id = '00000000-0000-4000-8000-000000000046';
  fixture.rows = Array.from({ length: 40 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(45 - i).padStart(12, '0')}`,
    created_at: before,
  }));
  const query = new URLSearchParams({ before, post_id });
  const response = await get(`posts?${query}`, 'Bearer valid');
  expect(response.status).toBe(200);
  expect(fixture.queryCalls).toContainEqual([
    'or',
    `created_at.lt.${before},and(created_at.eq.${before},id.lt.${post_id})`,
  ]);
  expect(fixture.queryCalls).not.toContainEqual(['lt', 'created_at', before]);
  expect(fixture.queryCalls).toContainEqual(['order', 'id', { ascending: false }]);
  const page = await response.json();
  expect(page.nextCursor).toBe(before);
  expect(page.nextPostId).toBe(fixture.rows[39].id);
});

it('feed retains the timestamp-only web contract and rejects invalid tie-breakers', async () => {
  const before = '2026-10-24T09:00:00Z';
  expect((await get(`posts?before=${before}`, 'Bearer valid')).status).toBe(200);
  expect(fixture.queryCalls).toContainEqual(['lt', 'created_at', before]);
  fixture.queryCalls.length = 0;
  expect((await get(`posts?before=${before}&post_id=invalid`, 'Bearer valid')).status).toBe(400);
  expect(fixture.queryCalls).toHaveLength(0);
});

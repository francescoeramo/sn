import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = vi.hoisted(() => ({
  mfa: false,
  calls: [] as string[],
  identity: { db: {}, user: { id: 'native-user' }, profile: { id: 'native-user' } },
}));
vi.mock('@/lib/server/supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/supabase')>();
  const query = {
    select: () => query,
    lt: () => query,
    or: () => query,
    order: () => query,
    limit: async () => ({ data: [], error: null }),
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
    { params: Promise.resolve({ path: [route.split('?')[0]] }) },
  );
}
beforeEach(() => {
  fixture.mfa = false;
  fixture.calls.length = 0;
  vi.mocked(mutate).mockClear();
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

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-000000000001',
  pending: [] as { id: string }[],
  rejectReservation: false,
  calls: [] as string[],
  reservations: [] as { path: string; owner_id: string; bytes: number; mime: string }[],
  uploaded: [] as { path: string; bytes: number; mime: string; upsert: boolean }[],
  removed: [] as string[],
  deleted: [] as string[],
}));

vi.mock('@/lib/server/supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/supabase')>();
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      delete: () => query,
      lt: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      insert: async (value: (typeof fixture.reservations)[number]) => {
        fixture.reservations.push(value);
        fixture.calls.push('reserve');
        return { data: null, error: fixture.rejectReservation ? { message: 'Spazio esaurito' } : null };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === 'media_assets' ? [{ path: `${String(filters.owner_id)}/dummy.jpg` }] : [],
        error: null,
      }).then(resolve),
    };
    return query;
  };
  const admin = {
    from,
    rpc: async (name: string) => {
      fixture.calls.push(name);
      return { data: name === 'pending_account_deletions' ? fixture.pending : [], error: null };
    },
    storage: { from: () => ({
      upload: async (path: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean }) => {
        fixture.calls.push('upload');
        fixture.uploaded.push({ path, bytes: bytes.byteLength, mime: options.contentType, upsert: options.upsert });
        return { data: {}, error: null };
      },
      remove: async (paths: string[]) => {
        fixture.calls.push('remove'); fixture.removed.push(...paths);
        return { data: [], error: null };
      },
    }) },
    auth: { admin: {
      deleteUser: async (id: string) => {
        fixture.calls.push('deleteUser'); fixture.deleted.push(id);
        return { data: {}, error: null };
      },
      signOut: async () => { fixture.calls.push('revoke'); return { data: {}, error: null }; },
    } },
  };
  const userDb = {
    from,
    auth: {
      signInWithPassword: async () => ({ data: { session: { access_token: 'dummy' } }, error: null }),
      signOut: async () => { fixture.calls.push('localSignOut'); return { error: null }; },
    },
  };
  return {
    ...original,
    identity: async () => ({ db: userDb, user: { id: fixture.userId, email: 'dummy@example.test' } }),
    adminDatabase: () => admin,
  };
});
vi.mock('@/lib/server/federation-delivery', () => ({
  processFederationQueue: async () => ({ processed: 0 }),
}));

import { POST } from '@/app/api/[...path]/route';
import { deleteAccount } from '@/lib/server/social';

beforeEach(() => {
  fixture.pending = [];
  fixture.rejectReservation = false;
  for (const list of [fixture.calls, fixture.reservations, fixture.uploaded, fixture.removed, fixture.deleted]) list.length = 0;
  vi.stubEnv('APP_ORIGIN', 'https://dummy.invalid');
  vi.stubEnv('CRON_SECRET', 'd'.repeat(40));
});
afterEach(() => { vi.unstubAllEnvs(); });

it('maintenance only deletes explicitly queued owner requests, preserving a permanent ban', async () => {
  fixture.pending = [{ id: 'owner-request' }];
  // There is deliberately no profiles/disabled selector: only the RPC may supply deletions.
  const response = await POST(new NextRequest('https://dummy.invalid/api/maintenance', {
    method: 'POST', headers: { origin: 'https://dummy.invalid', authorization: `Bearer ${'d'.repeat(40)}` },
  }), { params: Promise.resolve({ path: ['maintenance'] }) });
  expect(response.status).toBe(200);
  expect(fixture.deleted).toEqual(['owner-request']);
  expect(fixture.removed).toEqual(['owner-request/dummy.jpg']);
});

it('records deletion intent before any destructive cleanup after password confirmation', async () => {
  await deleteAccount('DummyPassword123');
  expect(fixture.calls).toEqual(['revoke', 'begin_account_deletion', 'remove', 'deleteUser', 'localSignOut']);
  expect(fixture.deleted).toEqual([fixture.userId]);
});

async function upload() {
  const form = new FormData();
  form.set('scope', 'encrypted-chat');
  form.set('file', new File([new Uint8Array([1, 2])], 'dummy.bin', { type: 'application/octet-stream' }));
  return POST(new NextRequest('https://dummy.invalid/api/upload', {
    method: 'POST', headers: { origin: 'https://dummy.invalid' }, body: form,
  }), { params: Promise.resolve({ path: ['upload'] }) });
}

it('persists only the measured immutable body after its user-scoped reservation succeeds', async () => {
  const response = await upload();
  expect(response.status).toBe(200);
  expect(fixture.calls).toEqual(['reserve', 'upload']);
  expect(fixture.reservations).toHaveLength(1);
  expect(fixture.reservations[0]).toMatchObject({ owner_id: fixture.userId, bytes: 2, mime: 'application/octet-stream' });
  expect(fixture.uploaded).toEqual([{
    path: fixture.reservations[0].path, bytes: 2, mime: 'application/octet-stream', upsert: false,
  }]);
  expect(fixture.reservations[0].path.startsWith(fixture.userId + '/')).toBe(true);
});

it('never invokes privileged Storage when the quota reservation fails', async () => {
  fixture.rejectReservation = true;
  const response = await upload();
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(fixture.calls).toEqual(['reserve']);
  expect(fixture.uploaded).toEqual([]);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNativeAuthRoute,
  refreshNativeSession,
  revokeNativeSession,
  signInWithPassword,
  verifyNativeMfa,
} from '../lib/server/auth';
import { ApiError, bearerToken, requireBearer } from '../lib/server/supabase';

// Matrice M0 (§4.11) lato server: 6-8 bootstrap/bearer, 10 refresh, 13 rate limit, 14 allowlist.
// I casi 9, 11, 12 (single-flight, logout durante refresh, offline) sono lato app iOS.

const AAL1 = 'header.aal1-payload.signature';
const AAL2 = 'header.aal2-payload.signature';
const FACTOR = '00000000-0000-4000-8000-0000000000aa';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function sessionBody(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 300,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Allowlist endpoint nativi (matrice 14)', () => {
  it('ammette solo i quattro endpoint nativi', () => {
    for (const route of [
      'native/auth/login',
      'native/auth/refresh',
      'native/auth/logout',
      'native/auth/mfa',
    ])
      expect(isNativeAuthRoute(route)).toBe(true);
    expect(isNativeAuthRoute('native/auth/signup')).toBe(false);
    expect(isNativeAuthRoute('bootstrap')).toBe(false);
    expect(isNativeAuthRoute('action')).toBe(false);
  });
});

describe('Bearer (matrice 6-8)', () => {
  it('riconosce un bearer ben formato', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
  });
  it('rifiuta header assente o malformato', () => {
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    const request = { headers: { get: () => null } };
    expect(() => requireBearer(request)).toThrow(ApiError);
    try {
      requireBearer({ headers: { get: () => 'Basic abc' } });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).code).toBe('session_invalid');
    }
  });
});

describe('Login condiviso (matrice 1-2, web invariato)', () => {
  function clientFor(session: unknown, level: { currentLevel: string; nextLevel: string }) {
    return {
      auth: {
        signInWithPassword: vi.fn(async () => ({ data: { session }, error: null })),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: level, error: null })),
        },
        getUser: vi.fn(async () => ({
          data: { user: { factors: [{ id: FACTOR, factor_type: 'totp', status: 'verified' }] } },
          error: null,
        })),
      },
    } as unknown as Parameters<typeof signInWithPassword>[0];
  }
  it('restituisce i token senza MFA', async () => {
    const session = sessionBody();
    const result = await signInWithPassword(
      clientFor(session, { currentLevel: 'aal1', nextLevel: 'aal1' }),
      'user@example.com',
      'password',
    );
    expect(result.mfaRequired).toBe(false);
    expect(result.session.access_token).toBe('access');
    expect(result.session.expires_at).toBeGreaterThan(0);
  });
  it('segnala il fattore quando serve aal2', async () => {
    const result = await signInWithPassword(
      clientFor(sessionBody(), { currentLevel: 'aal1', nextLevel: 'aal2' }),
      'user@example.com',
      'password',
    );
    expect(result.mfaRequired).toBe(true);
    if (result.mfaRequired) expect(result.factorId).toBe(FACTOR);
  });
});

describe('Refresh (matrice 3, 10)', () => {
  it('normalizza expires_at dalla risposta GoTrue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(sessionBody({ expires_in: 120 }))),
    );
    const before = Math.round(Date.now() / 1000);
    const session = await refreshNativeSession('old-refresh');
    expect(session.access_token).toBe('access');
    expect(session.refresh_token).toBe('refresh');
    expect(session.expires_at).toBeGreaterThanOrEqual(before + 120);
  });
  it('rifiuto definitivo → 401 refresh_invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ error: 'invalid_grant' }, 400)),
    );
    await expect(refreshNativeSession('dead')).rejects.toMatchObject({
      status: 401,
      code: 'refresh_invalid',
    });
  });
  it('errore di rete → 503 auth_unavailable, nessun logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(refreshNativeSession('keep')).rejects.toMatchObject({
      status: 503,
      code: 'auth_unavailable',
    });
  });
});

describe('MFA verify (matrice 4)', () => {
  it('challenge + verify restituiscono la sessione aal2', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ id: 'challenge-id' }))
      .mockResolvedValueOnce(response(sessionBody({ access_token: 'aal2' })));
    vi.stubGlobal('fetch', fetchMock);
    const session = await verifyNativeMfa(AAL1, FACTOR, '123456');
    expect(session.access_token).toBe('aal2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(first).toEqual({ factorId: FACTOR });
    const second = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(second).toEqual({ challenge_id: 'challenge-id', code: '123456' });
  });
  it('codice errato → 401 mfa_invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ id: 'challenge-id' }))
        .mockResolvedValueOnce(response({ error: 'invalid_code' }, 403)),
    );
    await expect(verifyNativeMfa(AAL1, FACTOR, '000000')).rejects.toMatchObject({
      status: 401,
      code: 'mfa_invalid',
    });
  });
  it('bearer scaduto sul challenge → 401 session_invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 401)));
    await expect(verifyNativeMfa(AAL1, FACTOR, '123456')).rejects.toMatchObject({
      status: 401,
      code: 'session_invalid',
    });
  });
});

describe('Logout (matrice 5, 11)', () => {
  it('revoca la sessione e resta idempotente su token già invalido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(revokeNativeSession(AAL2)).resolves.toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 401)));
    await expect(revokeNativeSession(AAL1)).resolves.toBeUndefined();
  });
  it('errore server → 503 logout_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 500)));
    await expect(revokeNativeSession(AAL2)).rejects.toMatchObject({
      status: 503,
      code: 'logout_failed',
    });
  });
});

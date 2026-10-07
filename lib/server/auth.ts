import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, checked } from './supabase';

// Native authentication is server-mediated (Opzione B) and stateless: the server talks
// to GoTrue with the bearer, and the app stores the tokens. No cookie is read or written.
export const nativeAuthRoutes = [
  'native/auth/login',
  'native/auth/refresh',
  'native/auth/logout',
  'native/auth/mfa',
] as const;
export function isNativeAuthRoute(route: string) {
  return (nativeAuthRoutes as readonly string[]).includes(route);
}

export type NativeSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
};
export type PasswordSignInResult =
  | { mfaRequired: true; factorId: string; session: NativeSession }
  | { mfaRequired: false; session: NativeSession };

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError('SN non è ancora collegato al database. Puoi provare la demo.', 503);
  return { url, key };
}
// Stateless client used only for password sign-in: tokens are returned to the caller.
export function nativeAuthClient() {
  const { url, key } = authConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
function toNativeSession(data: Record<string, unknown>): NativeSession | null {
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') return null;
  const expiresAt =
    typeof data.expires_at === 'number'
      ? data.expires_at
      : typeof data.expires_in === 'number'
        ? Math.round(Date.now() / 1000) + data.expires_in
        : 0;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: typeof data.token_type === 'string' ? data.token_type : 'bearer',
  };
}
async function gotrue(
  path: string,
  options: { token?: string; body: unknown },
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const { url, key } = authConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1${path}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    // Network failure is ambiguous: callers must keep their tokens, never sign out.
    throw new ApiError('Il servizio non risponde. Riprova tra poco.', 503, 'auth_unavailable');
  }
  const parsed: unknown = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data: record(parsed) };
}
// Shared with the web login route: the caller chooses the client (cookie or stateless).
export async function signInWithPassword(
  db: SupabaseClient,
  email: string,
  password: string,
): Promise<PasswordSignInResult> {
  const started = Date.now();
  const result = await db.auth.signInWithPassword({ email, password });
  // Same message and minimum response duration as the web route, to avoid user enumeration.
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 650 - (Date.now() - started))));
  const raw = result.data.session;
  if (result.error || !raw)
    throw new ApiError('Accesso non riuscito. Controlla email e password.', 401, 'login_invalid');
  const session: NativeSession = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: raw.expires_at ?? Math.round(Date.now() / 1000) + raw.expires_in,
    token_type: raw.token_type,
  };
  const assurance = checked(await db.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token));
  if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
    const { data } = await db.auth.getUser(session.access_token);
    const factor = (data.user?.factors ?? []).find(
      (item) => item.factor_type === 'totp' && item.status === 'verified',
    );
    if (!factor) throw new ApiError('Secondo fattore non disponibile.', 503, 'mfa_unavailable');
    return { mfaRequired: true, factorId: factor.id, session };
  }
  return { mfaRequired: false, session };
}
export async function refreshNativeSession(refreshToken: string): Promise<NativeSession> {
  const result = await gotrue('/token?grant_type=refresh_token', {
    body: { refresh_token: refreshToken },
  });
  const session = toNativeSession(result.data);
  if (!result.ok || !session) {
    if (result.status >= 500)
      throw new ApiError('Il servizio non risponde. Riprova tra poco.', 503, 'auth_unavailable');
    throw new ApiError('La sessione è scaduta. Accedi di nuovo.', 401, 'refresh_invalid');
  }
  return session;
}
export async function verifyNativeMfa(
  accessToken: string,
  factorId: string,
  code: string,
): Promise<NativeSession> {
  const challenge = await gotrue(`/factors/${factorId}/challenge`, {
    token: accessToken,
    body: { factorId },
  });
  const challengeId = typeof challenge.data.id === 'string' ? challenge.data.id : null;
  if (challenge.status === 401) throw new ApiError('Sessione non valida.', 401, 'session_invalid');
  if (!challenge.ok || !challengeId)
    throw new ApiError('Verifica non disponibile. Riprova.', 503, 'mfa_unavailable');
  const verified = await gotrue(`/factors/${factorId}/verify`, {
    token: accessToken,
    body: { challenge_id: challengeId, code },
  });
  const session = toNativeSession(verified.data);
  if (!verified.ok || !session) {
    if (verified.status >= 500)
      throw new ApiError('Verifica non disponibile. Riprova.', 503, 'mfa_unavailable');
    throw new ApiError('Codice non valido. Riprova.', 401, 'mfa_invalid');
  }
  return session;
}
export async function revokeNativeSession(accessToken: string) {
  // Scope "local" revokes the current session; M0 keeps the standard logout.
  const result = await gotrue('/logout?scope=local', { token: accessToken, body: {} });
  // Already invalid or expired sessions count as revoked, so logout stays idempotent.
  if (result.ok || result.status === 401 || result.status === 403 || result.status === 404) return;
  throw new ApiError('Non è stato possibile chiudere la sessione. Riprova.', 503, 'logout_failed');
}

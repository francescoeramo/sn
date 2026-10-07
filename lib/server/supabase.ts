import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}
export async function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError('SN non è ancora collegato al database. Puoi provare la demo.', 503);
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) jar.set(name, value, options);
      },
    },
  });
}
export async function authenticated() {
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError('Accedi per continuare.', 401);
  return { db, user: data.user };
}
// Authenticated account that is not disabled, without requiring AAL2.
// Used by the MFA routes, where a level-1 session must still be able to verify or manage factors.
export async function activeAccount() {
  const { db, user } = await authenticated();
  const profile = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile.error || !profile.data || profile.data.disabled)
    throw new ApiError('Account non disponibile.', 403);
  return { db, user, profile: profile.data };
}
export async function identity() {
  const { db, user } = await authenticated();
  const assurance = checked(await db.auth.mfa.getAuthenticatorAssuranceLevel());
  if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')
    throw new ApiError('Inserisci il codice dell’app authenticator.', 403);
  const profile = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile.error || !profile.data || profile.data.disabled)
    throw new ApiError('Account non disponibile.', 403);
  return { db, user, profile: profile.data };
}
// Native client: RLS queries run as the bearer user, without touching cookies.
// The token is verified explicitly with auth.getUser(token).
export function tokenDatabase(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new ApiError('SN non è ancora collegato al database. Puoi provare la demo.', 503);
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
type RequestLike = { headers: { get(name: string): string | null } };
// Only an explicit, well-formed Bearer header selects the native path.
// A present but malformed header is never silently downgraded to cookies.
export function bearerToken(header: string): string | null {
  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
export function requireBearer(request: RequestLike): string {
  const header = request.headers.get('authorization');
  const token = header === null ? null : bearerToken(header);
  if (!token) throw new ApiError('Sessione non valida.', 401, 'session_invalid');
  return token;
}
async function accountForToken(token: string) {
  const db = tokenDatabase(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError('Accedi per continuare.', 401, 'session_invalid');
  return { db, user: data.user, token };
}
export async function activeAccountForToken(token: string) {
  const { db, user, token: verified } = await accountForToken(token);
  const profile = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile.error || !profile.data || profile.data.disabled)
    throw new ApiError('Account non disponibile.', 403, 'account_unavailable');
  return { db, user, profile: profile.data, token: verified };
}
// Bearer wins when the Authorization header is present; otherwise the web cookie path is unchanged.
export async function authenticatedFrom(request: RequestLike) {
  if (request.headers.get('authorization') === null)
    return { ...(await authenticated()), token: undefined };
  const token = requireBearer(request);
  const { db, user } = await accountForToken(token);
  return { db, user, token };
}
export async function activeAccountFrom(request: RequestLike) {
  if (request.headers.get('authorization') === null) return activeAccount();
  return activeAccountForToken(requireBearer(request));
}
export async function identityFrom(request: RequestLike) {
  if (request.headers.get('authorization') === null) return identity();
  const { db, user, profile, token } = await activeAccountForToken(requireBearer(request));
  const assurance = checked(await db.auth.mfa.getAuthenticatorAssuranceLevel(token));
  if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')
    throw new ApiError('Inserisci il codice dell’app authenticator.', 403, 'mfa_required');
  return { db, user, profile, token };
}
// Privileged client is isolated: only lifecycle operations with separately verified authorization.
export function adminDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new ApiError('Operazione non configurata sul server.', 503);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
export function checked<
  R extends { data?: unknown; error: { message: string; code?: string } | null },
>(result: R): NonNullable<R['data']> {
  if (result.error) {
    const message = result.error.message;
    if (
      /già letto|30 minuti|Revisione cambiata|Impostazioni chat cambiate|Messaggio scaduto|Sondaggio chiuso|già votato/.test(
        message,
      )
    )
      throw new ApiError(message, 409);
    if (/Limite orario|Spazio esaurito|Upload sospesi/.test(message))
      throw new ApiError(message, 429);
    throw new ApiError('Operazione non riuscita. Verifica i dati e i permessi.', 400);
  }
  return result.data as NonNullable<R['data']>;
}

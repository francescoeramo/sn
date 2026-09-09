import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
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
export async function identity() {
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError('Accedi per continuare.', 401);
  const profile = await db.from('profiles').select('*').eq('id', data.user.id).single();
  if (profile.error || !profile.data || profile.data.disabled)
    throw new ApiError('Account non disponibile.', 403);
  return { db, user: data.user, profile: profile.data };
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
    if (/Limite orario|Spazio esaurito|Upload sospesi/.test(message))
      throw new ApiError(message, 429);
    throw new ApiError('Operazione non riuscita. Verifica i dati e i permessi.', 400);
  }
  return result.data as NonNullable<R['data']>;
}

import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/supabase';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  if (!code || code.length > 2000)
    return NextResponse.json({ error: 'Link non valido.' }, { status: 400 });
  try {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error && next === '/account/password')
      return NextResponse.redirect(new URL('/account/password', process.env.APP_ORIGIN!));
    if (error)
      return NextResponse.json(
        {
          error:
            'Link scaduto o aperto in un browser diverso. Richiedi assistenza al gestore della beta.',
        },
        { status: 400 },
      );
    const destination = next === '/account/password' ? next : '/';
    return NextResponse.redirect(new URL(destination, process.env.APP_ORIGIN!));
  } catch {
    return NextResponse.json({ error: 'Conferma non disponibile.' }, { status: 503 });
  }
}

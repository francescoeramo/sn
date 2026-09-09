import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/supabase';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code || code.length > 2000)
    return NextResponse.json({ error: 'Link non valido.' }, { status: 400 });
  try {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error)
      return NextResponse.json(
        {
          error:
            'Link scaduto o aperto in un browser diverso. Richiedi assistenza al gestore della beta.',
        },
        { status: 400 },
      );
    return NextResponse.redirect(new URL('/', process.env.APP_ORIGIN!));
  } catch {
    return NextResponse.json({ error: 'Conferma non disponibile.' }, { status: 503 });
  }
}

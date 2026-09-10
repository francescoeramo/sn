import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { BodyTooLarge, readLimited } from '@/lib/core/http';
import {
  credentials,
  LIMITS,
  fileKind,
  chatFileKind,
  userId,
  publicDeviceInput,
} from '@/lib/core/rules';
import { database, identity, checked, adminDatabase, ApiError } from '@/lib/server/supabase';
import { snapshot, mutate, exportData, deleteAccount } from '@/lib/server/social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' },
  });
function errorResponse(error: unknown) {
  if (error instanceof BodyTooLarge) return json({ error: 'Richiesta troppo grande.' }, 413);
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json({ error: 'Controlla i campi: un valore non è valido.' }, 400);
  return json({ error: 'Il servizio non risponde. Riprova tra poco.' }, 500);
}
async function body(request: NextRequest) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError('Formato non valido.', 415);
  const text = new TextDecoder().decode(await readLimited(request, 24000));
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('Richiesta non valida.');
  }
}
function sameOrigin(request: NextRequest) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || request.headers.get('origin') !== new URL(expected).origin)
    throw new ApiError('Origine non autorizzata.', 403);
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const route = (await params).path.join('/');
    if (route === 'bootstrap') return json(await snapshot());
    if (route === 'posts') {
      const { db } = await identity();
      const before = z.iso
        .datetime({ offset: true })
        .parse(request.nextUrl.searchParams.get('before'));
      const posts = checked(
        await db
          .from('posts')
          .select('*, notes:community_notes(*)')
          .lt('created_at', before)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('created_at', { ascending: false })
          .limit(40),
      );
      return json({ posts, nextCursor: posts.length === 40 ? posts.at(-1).created_at : null });
    }
    if (route === 'search') {
      const { db } = await identity();
      const term = z
        .string()
        .trim()
        .max(100)
        .parse(request.nextUrl.searchParams.get('q') ?? '');
      const escaped = term.replace(/[\\%_]/g, (c) => '\\' + c);
      return json(
        checked(
          await db
            .from('posts')
            .select('*, notes:community_notes(*)')
            .ilike('body', `%${escaped}%`)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order('created_at', { ascending: false })
            .limit(40),
        ),
      );
    }
    if (route === 'export')
      return new NextResponse(JSON.stringify(await exportData(), null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="sn-dati.json"',
          'Cache-Control': 'private, no-store',
        },
      });
    if (route === 'media') {
      const path = z
        .string()
        .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/)
        .parse(request.nextUrl.searchParams.get('path'));
      const { db } = await identity();
      const blob = checked(await db.storage.from('media').download(path));
      return new NextResponse(blob, {
        headers: {
          'Content-Type': blob.type,
          'Content-Length': String(blob.size),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (route === 'chat/devices') {
      const { db, user } = await identity();
      const other = userId.parse(request.nextUrl.searchParams.get('user'));
      return json(
        checked(
          await db
            .from('chat_devices')
            .select('id,user_id,public_key,label')
            .in('user_id', [user.id, other]),
        ),
      );
    }
    if (route === 'messages') {
      const { db, user } = await identity();
      const other = userId.parse(request.nextUrl.searchParams.get('user'));
      let q = db
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${user.id})`,
        )
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(50);
      const before = request.nextUrl.searchParams.get('before');
      if (before) q = q.lt('created_at', z.iso.datetime({ offset: true }).parse(before));
      return json(checked(await q));
    }
    return json({ error: 'Endpoint non trovato.' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    sameOrigin(request);
    const route = (await params).path.join('/');
    if (route === 'auth/login' || route === 'auth/signup') {
      const data = credentials.parse(await body(request));
      const db = await database();
      if (route === 'auth/signup') {
        if (!data.invite || !data.username)
          throw new ApiError('Inserisci nome utente e codice invito.');
        if (!process.env.PRIVACY_CONTACT_EMAIL)
          throw new ApiError('Le registrazioni della beta non sono ancora aperte.', 503);
        const result = await db.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: new URL('/auth/callback', process.env.APP_ORIGIN!).href,
            data: { username: data.username, invite_code: data.invite },
          },
        });
        if (result.error)
          throw new ApiError('Registrazione non riuscita. Verifica l’invito e i dati.', 400);
        return json({ confirmationRequired: !result.data.session });
      }
      const started = Date.now();
      const result = await db.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      // Same message and a minimum response duration; Supabase also performs its own password verification and rate limiting.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 650 - (Date.now() - started))),
      );
      if (result.error)
        throw new ApiError('Accesso non riuscito. Controlla email e password.', 401);
      return json({ ok: true });
    }
    if (route === 'auth/logout') {
      const db = await database();
      checked(await db.auth.signOut());
      return json({ ok: true });
    }
    if (route === 'chat/device') {
      const { db, user } = await identity();
      const value = publicDeviceInput.parse(await body(request));
      if (value.user_id !== user.id) throw new ApiError('Accesso negato.', 403);
      const existing = checked(await db.from('chat_devices').select('*').eq('id', value.id));
      if (existing.length) {
        if (
          JSON.stringify(existing[0].public_key) !== JSON.stringify(value.public_key) &&
          (existing[0].public_key.x !== value.public_key.x ||
            existing[0].public_key.y !== value.public_key.y)
        )
          throw new ApiError('La chiave del browser è cambiata.', 409);
      } else
        checked(
          await db.from('chat_devices').upsert(value, { onConflict: 'id', ignoreDuplicates: true }),
        );
      return json({ ok: true });
    }
    if (route === 'chat/delivered') {
      const { db } = await identity();
      const value = z.object({ ids: z.array(userId).max(100) }).parse(await body(request));
      const paths = checked(
        await db.rpc('acknowledge_messages', { message_ids: value.ids }),
      ) as string[];
      if (paths.length) {
        const admin = adminDatabase();
        checked(await admin.storage.from('media').remove(paths));
        checked(await admin.from('media_assets').delete().in('path', paths));
      }
      return json({ ok: true });
    }
    if (route === 'action') return json(await mutate(await body(request)));
    if (route === 'account/delete') {
      const data = z
        .object({ password: z.string().min(1).max(128), confirmation: z.literal('ELIMINA') })
        .parse(await body(request));
      return json(await deleteAccount(data.password));
    }
    if (route === 'upload') {
      if (Number(request.headers.get('content-length')) > LIMITS.file + 20000)
        throw new ApiError('Il file supera 3 MB.', 413);
      const { db, user } = await identity();
      const contentType = request.headers.get('content-type');
      if (!contentType?.startsWith('multipart/form-data;'))
        throw new ApiError('Formato non valido.', 415);
      const payload = await readLimited(request, LIMITS.file + 20000);
      const form = await new Response(payload as BodyInit, {
        headers: { 'Content-Type': contentType },
      }).formData();
      const file = form.get('file');
      if (
        !(file instanceof File) ||
        !(form.get('scope') === 'encrypted-chat'
          ? file.type === 'application/octet-stream'
          : form.get('scope') === 'chat'
            ? chatFileKind(file.type)
            : fileKind(file.type)) ||
        file.size > LIMITS.file ||
        !file.size
      )
        throw new ApiError('Carica un’immagine o un video entro 3 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const match =
        (form.get('scope') === 'encrypted-chat' && file.type === 'application/octet-stream') ||
        (file.type === 'image/jpeg'
          ? bytes[0] === 255 && bytes[1] === 216
          : file.type === 'image/png'
            ? bytes[0] === 137 && bytes[1] === 80
            : file.type === 'image/webp'
              ? new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
              : ['video/mp4', 'audio/mp4'].includes(file.type)
                ? new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp'
                : file.type === 'audio/ogg'
                  ? new TextDecoder().decode(bytes.slice(0, 4)) === 'OggS'
                  : bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163);
      if (!match) throw new ApiError('Il contenuto del file non corrisponde al formato.');
      const path = `${user.id}/${crypto.randomUUID()}`;
      checked(
        await db
          .from('media_assets')
          .insert({ path, owner_id: user.id, bytes: file.size, mime: file.type }),
      );
      checked(
        await db.storage
          .from('media')
          .upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '0' }),
      );
      return json({ path, mime: file.type });
    }
    if (route === 'maintenance') {
      // Operational job is authenticated separately, with same-origin check plus a secret.
      const secret = process.env.CRON_SECRET;
      const supplied = Buffer.from(request.headers.get('authorization') ?? '');
      const expected = Buffer.from(`Bearer ${secret}`);
      if (
        !secret ||
        secret.length < 32 ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new ApiError('Accesso negato.', 403);
      const admin = adminDatabase();
      checked(await admin.from('posts').delete().lt('expires_at', new Date().toISOString()));
      checked(await admin.from('messages').delete().lt('expires_at', new Date().toISOString()));
      const assets = checked(await admin.rpc('claim_media_cleanup')) as string[];
      let removed = 0;
      for (const path of assets) {
        checked(await admin.storage.from('media').remove([path]));
        checked(await admin.from('media_assets').delete().eq('path', path));
        removed++;
      }
      const disabled = checked(
        await admin.from('profiles').select('id').eq('disabled', true).limit(20),
      );
      for (const profile of disabled) {
        const owned = checked(
          await admin.from('media_assets').select('path').eq('owner_id', profile.id),
        );
        for (let i = 0; i < owned.length; i += 100)
          checked(
            await admin.storage.from('media').remove(owned.slice(i, i + 100).map((a) => a.path)),
          );
        checked(await admin.auth.admin.deleteUser(profile.id));
      }
      return json({ removed });
    }
    return json({ error: 'Endpoint non trovato.' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

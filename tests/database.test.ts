import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { newDevice, seal, type LocalDevice } from '../lib/crypto/chat';
import { readFileSync, readdirSync } from 'node:fs';

let db: PGlite;
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const eve = '00000000-0000-4000-8000-000000000003';
const devices: Record<string, LocalDevice> = {};
async function send(
  from: string,
  to: string,
  ttl = 86400,
  path: string | null = null,
  retention: 'synced' | 'device' = 'synced',
) {
  if ([0, 3600, 10800, 86400, 172800, 604800, 2592000].includes(ttl))
    await asUser(from, 'select public.set_chat_settings($1,$2,$3)', [to, ttl !== 0, ttl || 86400]);
  const context = {
    id: crypto.randomUUID(),
    sender_id: from,
    recipient_id: to,
    expires_at: ttl ? new Date(Date.now() + Math.max(ttl, 3600) * 1000).toISOString() : null,
    retention,
  };
  const { sealed } = await seal(devices[from], [devices[from], devices[to]], context, 'Messaggio');
  await asUser(
    from,
    "insert into public.messages(id,sender_id,recipient_id,body,ttl_seconds,media_path,encrypted) values($1,$2,$3,'',$4,$5,$6)",
    [context.id, from, to, ttl, path, sealed],
  );
  return context.id;
}
async function asUser<T>(id: string, query: string, params: unknown[] = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return (await db.query<T>(query, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}
async function invite(email: string, token: string) {
  await db.query(
    "insert into private.invites(token_hash,email) values(encode(sha256(convert_to($1,'UTF8')),'hex'),$2)",
    [token, email],
  );
}
async function signup(id: string, email: string, username: string, token: string) {
  return db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    id,
    email,
    { username, invite_code: token },
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now(),updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;grant execute on function auth.jwt() to authenticated,anon,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique,metadata jsonb,owner_id text);
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete,update on storage.objects to authenticated;`);
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
  for (const [id, email, name] of [
    [alice, 'a@example.test', 'alice'],
    [bob, 'b@example.test', 'bob'],
    [eve, 'e@example.test', 'eve'],
  ]) {
    await invite(email, name.repeat(12));
    await signup(id, email, name, name.repeat(12));
    const device = await newDevice(id);
    devices[id] = device;
    await asUser(
      id,
      'insert into public.chat_devices(id,user_id,public_key,label) values($1,$2,$3,$4)',
      [device.id, id, device.public_key, device.label],
    );
  }
  // Author-bound insert, then retrieve its generated ID via SQL owner for the tests.
  await asUser(alice, "insert into public.posts(author_id,body) values($1,'Solo follower')", [
    alice,
  ]);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe('Autorizzazioni Postgres reali (PGlite)', () => {
  it('mostra solo le proprie sessioni e protegge quella corrente', async () => {
    const current = '10000000-0000-4000-8000-000000000001';
    const other = '10000000-0000-4000-8000-000000000002';
    const foreign = '10000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$2),($4,$5)', [
      current,
      alice,
      other,
      foreign,
      bob,
    ]);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);select set_config('request.jwt.claims','{"session_id":"${current}"}',false);`,
    );
    try {
      const listed = await db.query<{ id: string; is_current: boolean }>(
        'select id,is_current from public.my_sessions()',
      );
      expect(listed.rows).toEqual([
        { id: current, is_current: true },
        { id: other, is_current: false },
      ]);
      await expect(db.query('select public.revoke_my_session($1)', [current])).rejects.toThrow(
        'sessione corrente',
      );
      await db.query('select public.revoke_my_session($1)', [other]);
    } finally {
      await db.exec('reset role;');
    }
    const remaining = await db.query<{ id: string }>('select id from auth.sessions order by id');
    expect(remaining.rows.map((row) => row.id)).toEqual([current, foreign]);
  });
  it('crea sondaggi atomici, accetta un solo voto e non espone chi ha votato', async () => {
    const created = await asUser<{ create_poll: string }>(
      alice,
      "select public.create_poll('Dove andiamo?','',array['Mare','Montagna'],86400)",
    );
    const pollId = created[0].create_poll;
    const options = await asUser<{ id: string; body: string }>(
      alice,
      'select id,body from public.poll_options where poll_id=$1 order by position',
      [pollId],
    );
    expect(options.map((option) => option.body)).toEqual(['Mare', 'Montagna']);
    await asUser(alice, 'select public.vote_poll($1,$2)', [pollId, options[0].id]);
    await expect(
      asUser(alice, 'select public.vote_poll($1,$2)', [pollId, options[1].id]),
    ).rejects.toThrow('già votato');
    const results = await asUser<{ votes: bigint; selected: boolean }>(
      alice,
      'select votes,selected from public.poll_results(array[$1]::uuid[]) where option_id=$2',
      [pollId, options[0].id],
    );
    expect(Number(results[0].votes)).toBe(1);
    expect(results[0].selected).toBe(true);
    await expect(asUser(alice, 'select * from public.poll_votes')).rejects.toThrow(
      /permission denied/,
    );
    await db.query('delete from public.posts where id=$1', [pollId]);
  });
  it('attiva RLS su ogni tabella applicativa e privata', async () => {
    const r = await db.query<{ relname: string }>(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity",
    );
    expect(r.rows).toEqual([]);
  });
  it('nega registrazioni senza invito', async () => {
    await expect(
      signup('00000000-0000-4000-8000-000000000009', 'no@example.test', 'outsider', 'bad'),
    ).rejects.toThrow('Invito non valido');
  });
  it('un invito è legato all’email e si usa una sola volta', async () => {
    await expect(
      signup(
        '00000000-0000-4000-8000-000000000009',
        'a@example.test',
        'outsider',
        'alice'.repeat(12),
      ),
    ).rejects.toThrow('Invito non valido');
  });
  it('rimuove il token invito dai metadati utente', async () => {
    const r = await db.query<{ raw_user_meta_data: Record<string, string> }>(
      'select raw_user_meta_data from auth.users where id=$1',
      [alice],
    );
    expect(r.rows[0].raw_user_meta_data.invite_code).toBeUndefined();
  });
  it('nega lettura anonima e di profili inesistenti', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from public.posts')).rejects.toThrow('permission denied');
    } finally {
      await db.exec('reset role');
    }
    expect(
      await asUser('00000000-0000-4000-8000-000000000099', 'select * from public.posts'),
    ).toHaveLength(0);
  });
  it('non mostra post privati a estranei', async () =>
    expect(await asUser(bob, 'select * from public.posts')).toHaveLength(0));
  it('una richiesta di follow resta in attesa', async () => {
    await asUser(bob, 'insert into public.follows(follower_id,following_id) values($1,$2)', [
      bob,
      alice,
    ]);
    expect(
      (await asUser<{ accepted: boolean }>(bob, 'select accepted from public.follows'))[0].accepted,
    ).toBe(false);
    expect(await asUser(bob, 'select * from public.posts')).toHaveLength(0);
  });
  it('non permette di approvare da soli la propria richiesta', async () => {
    await asUser(bob, 'update public.follows set accepted=true where follower_id=$1', [bob]);
    expect(
      (await asUser<{ accepted: boolean }>(bob, 'select accepted from public.follows'))[0].accepted,
    ).toBe(false);
  });
  it('solo il destinatario può approvare e rendere visibili i post', async () => {
    await asUser(alice, 'update public.follows set accepted=true where follower_id=$1', [bob]);
    expect(await asUser(bob, 'select * from public.posts')).toHaveLength(1);
  });
  it('non consente pubblicazione a nome di un altro utente', async () => {
    await expect(
      asUser(bob, "insert into public.posts(author_id,body) values($1,'Impersonazione')", [alice]),
    ).rejects.toThrow('Accesso negato');
  });
  it('non consente modifiche ai privilegi del profilo', async () => {
    await expect(
      asUser(bob, 'update public.profiles set disabled=false where id=$1', [bob]),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(bob, 'insert into private.admins(user_id) values($1)', [bob]),
    ).rejects.toThrow('permission denied');
  });
  it('nega messaggi senza follow reciproco', async () => {
    await expect(
      asUser(bob, "insert into public.messages(sender_id,recipient_id,body) values($1,$2,'Ciao')", [
        bob,
        alice,
      ]),
    ).rejects.toThrow('Accesso negato');
  });
  it('consente DM reciproci, invisibili a terzi', async () => {
    await asUser(alice, 'insert into public.follows(follower_id,following_id) values($1,$2)', [
      alice,
      bob,
    ]);
    await asUser(bob, 'update public.follows set accepted=true where follower_id=$1', [alice]);
    await send(bob, alice);
    expect(await asUser(eve, 'select * from public.messages')).toHaveLength(0);
    expect(await asUser(alice, 'select * from public.messages')).toHaveLength(1);
  });
  it('impone scadenze consentite nel database e nasconde messaggi e media scaduti', async () => {
    await expect(send(bob, alice, 42)).rejects.toThrow();
    const path = bob + '/00000000-0000-4000-8000-000000000557';
    await asUser(
      bob,
      "insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,100,'application/octet-stream')",
      [path, bob],
    );
    await asUser(
      bob,
      `insert into storage.objects(bucket_id,name,metadata) values('media',$1,'{"size":100,"mimetype":"application/octet-stream"}')`,
      [path],
    );
    await send(bob, alice, 3600, path);
    const rows = await asUser<{ expires_at: string; created_at: string; media_type: string }>(
      alice,
      'select * from public.messages where media_path=$1',
      [path],
    );
    expect(rows[0].media_type).toBe('application/octet-stream');
    expect(
      Math.abs(Date.parse(rows[0].expires_at) - Date.parse(rows[0].created_at) - 3600000),
    ).toBeLessThan(1000);
    expect(await asUser(alice, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      1,
    );
    expect(await asUser(eve, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      0,
    );
    await expect(
      asUser(
        bob,
        "insert into public.posts(author_id,body,media_path) values($1,'Riutilizzo',$2)",
        [bob, path],
      ),
    ).rejects.toThrow('File già usato in chat');
    await db.query(
      "update public.messages set expires_at=now()-interval '1 second' where media_path=$1",
      [path],
    );
    expect(
      await asUser(alice, 'select * from public.messages where media_path=$1', [path]),
    ).toHaveLength(0);
    expect(await asUser(bob, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      0,
    );
    expect(await asUser(alice, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      0,
    );
  });
  it('rifiuta nuovi messaggi in chiaro e consegne simulate da estranei', async () => {
    await expect(
      asUser(
        bob,
        "insert into public.messages(sender_id,recipient_id,body) values($1,$2,'In chiaro')",
        [bob, alice],
      ),
    ).rejects.toThrow('cifratura end-to-end');
    const id = await send(bob, alice, 3600, null, 'device');
    await expect(asUser(eve, 'delete from public.messages where id=$1', [id])).rejects.toThrow(
      'permission denied',
    );
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(1);
    await expect(asUser(bob, 'delete from public.messages where id=$1', [id])).rejects.toThrow(
      'permission denied',
    );
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(1);
    await asUser(alice, 'select public.acknowledge_chat_revision($1,0)', [id]);
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(0);
  });
  it('la conferma di consegna revoca subito il blob solo del destinatario', async () => {
    const path = bob + '/' + crypto.randomUUID();
    await asUser(
      bob,
      "insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,100,'application/octet-stream')",
      [path, bob],
    );
    await asUser(
      bob,
      `insert into storage.objects(bucket_id,name,metadata) values('media',$1,'{"size":100,"mimetype":"application/octet-stream"}')`,
      [path],
    );
    const id = await send(bob, alice, 3600, path, 'device');
    await expect(
      asUser(eve, 'select public.acknowledge_chat_revision($1,0)', [id]),
    ).rejects.toThrow('Accesso negato');
    expect(await asUser(bob, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      1,
    );
    await asUser(alice, 'select public.acknowledge_chat_revision($1,0)', [id]);
    expect(await asUser(bob, 'select * from storage.objects where name=$1', [path])).toHaveLength(
      0,
    );
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(0);
  });
  it('nega sostituzione delle chiavi e registrazione a nome altrui', async () => {
    await expect(
      asUser(bob, "update public.chat_devices set label='Falso' where user_id=$1", [alice]),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(
        bob,
        'insert into public.chat_devices(id,user_id,public_key,label) values($1,$2,$3,$4)',
        [crypto.randomUUID(), alice, devices[alice].public_key, 'Falso'],
      ),
    ).rejects.toThrow('Accesso negato');
    expect(
      await asUser(eve, 'select * from public.chat_devices where user_id=$1', [alice]),
    ).toHaveLength(0);
  });
  it('lega like e commenti alla visibilità del post', async () => {
    const posts = await asUser<{ id: string }>(alice, 'select id from public.posts');
    await expect(
      asUser(eve, 'insert into public.likes(user_id,post_id) values($1,$2)', [eve, posts[0].id]),
    ).rejects.toThrow('row-level security');
    await asUser(bob, 'insert into public.likes(user_id,post_id) values($1,$2)', [
      bob,
      posts[0].id,
    ]);
    expect(
      await asUser(alice, "select * from public.notifications where kind='likes'"),
    ).toHaveLength(1);
  });
  it('un membro non può fabbricare notifiche o leggere inviti', async () => {
    await expect(
      asUser(
        bob,
        "insert into public.notifications(user_id,actor_id,kind) values($1,$2,'follow')",
        [alice, eve],
      ),
    ).rejects.toThrow('permission denied');
    await expect(asUser(bob, 'select * from private.invites')).rejects.toThrow('permission denied');
  });
  it('rifiuta allegati di altri autori o non caricati', async () => {
    await expect(
      asUser(bob, "insert into public.posts(author_id,body,media_path) values($1,'file',$2)", [
        bob,
        alice + '/00000000-0000-4000-8000-000000000888',
      ]),
    ).rejects.toThrow('File non disponibile');
  });
  it('impone quote e riserva spazio prima di accettare un oggetto', async () => {
    await expect(
      asUser(
        bob,
        "insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,3145729,'image/webp')",
        [bob + '/00000000-0000-4000-8000-000000000444', bob],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        bob,
        'insert into storage.objects(bucket_id,name,metadata) values(\'media\',$1,\'{"size":100,"mimetype":"image/webp"}\')',
        [bob + '/00000000-0000-4000-8000-000000000555'],
      ),
    ).rejects.toThrow('row-level security');
  });
  it('accetta un file riservato, nega dimensioni superiori e sovrascritture', async () => {
    const path = bob + '/00000000-0000-4000-8000-000000000556';
    await asUser(
      bob,
      "insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,100,'image/webp')",
      [path, bob],
    );
    await expect(
      asUser(
        bob,
        'insert into storage.objects(bucket_id,name,metadata) values(\'media\',$1,\'{"size":101,"mimetype":"image/webp"}\')',
        [path],
      ),
    ).rejects.toThrow('row-level security');
    await asUser(
      bob,
      'insert into storage.objects(bucket_id,name,metadata) values(\'media\',$1,\'{"size":100,"mimetype":"image/webp"}\')',
      [path],
    );
    await asUser(bob, 'update storage.objects set metadata=\'{"size":200}\' where name=$1', [path]);
    const r = await db.query<{ metadata: { size: number } }>(
      'select metadata from storage.objects where name=$1',
      [path],
    );
    expect(r.rows[0].metadata.size).toBe(100);
    await expect(
      asUser(bob, 'delete from public.media_assets where path=$1', [path]),
    ).rejects.toThrow('permission denied');
  });
  it('nasconde le storie scadute anche al proprietario', async () => {
    const path = bob + '/00000000-0000-4000-8000-000000000556';
    await asUser(
      bob,
      "insert into public.posts(author_id,body,kind,media_path) values($1,'Una storia','story',$2)",
      [bob, path],
    );
    await db.query(
      "update public.posts set expires_at=now()-interval '1 second' where kind='story'",
    );
    expect(await asUser(bob, "select * from public.posts where kind='story'")).toHaveLength(0);
  });
  it('indicizza la ricerca italiana senza superare la visibilità dei post', async () => {
    const indexes = await db.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname='public' and tablename='posts' and indexname='posts_body_full_text'",
    );
    expect(indexes.rows).toHaveLength(1);
    const query =
      "select id from public.posts where to_tsvector('italian',body) @@ websearch_to_tsquery('italian',$1)";
    expect(await asUser(bob, query, ['follower'])).toHaveLength(1);
    expect(await asUser(eve, query, ['follower'])).toHaveLength(0);
  });
  it('le note rispettano la privacy del post e solo un moderatore può pubblicarle', async () => {
    const [{ id: post }] = await asUser<{ id: string }>(
      alice,
      'select id from public.posts where author_id=$1',
      [alice],
    );
    await expect(
      asUser(
        eve,
        'insert into public.community_notes(post_id,author_id,body,sources) values($1,$2,$3,$4)',
        [post, eve, 'Nota su un post privato non accessibile.', ['https://example.org/fonte']],
      ),
    ).rejects.toThrow('Accesso negato');
    await expect(
      asUser(
        bob,
        'insert into public.community_notes(post_id,author_id,body,sources) values($1,$2,$3,$4)',
        [post, bob, 'Una fonte non sicura non va accettata.', ['javascript:alert(1)']],
      ),
    ).rejects.toThrow('HTTPS');
    await asUser(
      bob,
      'insert into public.community_notes(post_id,author_id,body,sources) values($1,$2,$3,$4)',
      [
        post,
        bob,
        'La fonte aggiunge contesto a questa affermazione.',
        ['https://example.org/fonte'],
      ],
    );
    const [{ id }] = await asUser<{ id: string }>(
      bob,
      'select id from public.community_notes where post_id=$1',
      [post],
    );
    expect(await asUser(alice, 'select * from public.community_notes')).toHaveLength(0);
    await expect(
      asUser(bob, 'select public.review_community_note($1,true,$2)', [
        id,
        'Fonte controllata e coerente.',
      ]),
    ).rejects.toThrow('Accesso negato');
    await expect(
      asUser(bob, "update public.community_notes set status='approved' where id=$1", [id]),
    ).rejects.toThrow('permission denied');
    await db.query('insert into private.admins(user_id) values($1)', [eve]);
    expect(
      await asUser(eve, 'select * from public.community_notes where id=$1', [id]),
    ).toHaveLength(1);
    await expect(
      asUser(eve, 'select public.review_community_note($1,true,$2)', [id, 'ok']),
    ).rejects.toThrow('Motiva');
    await asUser(eve, 'select public.review_community_note($1,true,$2)', [
      id,
      'Fonte verificata, aggiunge contesto.',
    ]);
    expect(
      await asUser(alice, "select * from public.community_notes where status='approved'"),
    ).toHaveLength(1);
    expect(await asUser(alice, 'select * from public.posts where id=$1', [post])).toHaveLength(1);
    await db.query('delete from private.admins where user_id=$1', [eve]);
    expect(await asUser(eve, 'select * from public.community_notes')).toHaveLength(0);
    expect(
      await asUser(bob, "select * from public.notifications where kind='note_approved'"),
    ).toHaveLength(1);
  });
  it('registra decisioni di moderazione e impedisce aggiornamenti fuori dalla RPC', async () => {
    await asUser(alice, "insert into public.posts(author_id,body) values($1,'Post per audit')", [
      alice,
    ]);
    const [{ id: post }] = await asUser<{ id: string }>(
      alice,
      "select id from public.posts where author_id=$1 and body='Post per audit'",
      [alice],
    );
    await asUser(bob, 'insert into public.reports(reporter_id,post_id,reason) values($1,$2,$3)', [
      bob,
      post,
      'Contenuto da controllare.',
    ]);
    const [{ id: report }] = await asUser<{ id: string }>(
      bob,
      "select id from public.reports where status='open' order by created_at desc limit 1",
    );
    await expect(
      asUser(bob, "update public.reports set status='dismissed' where id=$1", [report]),
    ).rejects.toThrow('permission denied');
    await expect(asUser(bob, 'select public.moderate_report($1,true)', [report])).rejects.toThrow(
      'Accesso negato',
    );
    await db.query('insert into private.admins(user_id) values($1)', [eve]);
    await asUser(eve, 'select public.moderate_report($1,true)', [report]);
    const audit = await asUser<{ action: string; target_id: string }>(
      eve,
      'select action,target_id from public.moderation_audit order by created_at',
    );
    expect(audit.map((row) => row.action)).toEqual(['note_approved', 'post_removed']);
    expect(audit.at(-1)?.target_id).toBe(post);
    expect(await asUser(bob, 'select * from public.moderation_audit')).toHaveLength(0);
    await db.query('delete from private.admins where user_id=$1', [eve]);
  });
  it('i salvati sono privati anche per moderatori e non autorizzano post privati', async () => {
    const [{ id }] = await asUser<{ id: string }>(
      alice,
      'select id from public.posts where author_id=$1 limit 1',
      [alice],
    );
    const before = await asUser(alice, 'select * from public.notifications');
    await asUser(
      bob,
      'insert into public.bookmarks(user_id,post_id) values($1,$2) on conflict do nothing',
      [bob, id],
    );
    await asUser(
      bob,
      'insert into public.bookmarks(user_id,post_id) values($1,$2) on conflict do nothing',
      [bob, id],
    );
    expect(await asUser(bob, 'select * from public.bookmarks')).toHaveLength(1);
    expect(await asUser(alice, 'select * from public.bookmarks')).toHaveLength(0);
    expect(await asUser(alice, 'select * from public.notifications')).toEqual(before);
    await db.query('insert into private.admins(user_id) values($1)', [eve]);
    try {
      expect(await asUser(eve, 'select * from public.bookmarks')).toHaveLength(0);
      await expect(
        asUser(eve, 'insert into public.bookmarks(user_id,post_id) values($1,$2)', [eve, id]),
      ).rejects.toThrow('row-level security');
      await expect(
        asUser(alice, 'insert into public.bookmarks(user_id,post_id) values($1,$2)', [bob, id]),
      ).rejects.toThrow('row-level security');
      expect(await asUser(eve, 'delete from public.bookmarks returning post_id')).toHaveLength(0);
      await expect(asUser(bob, 'update public.bookmarks set user_id=$1', [eve])).rejects.toThrow(
        'permission denied',
      );
      await db.exec('set role anon');
      try {
        await expect(db.query('select * from public.bookmarks')).rejects.toThrow(
          'permission denied',
        );
      } finally {
        await db.exec('reset role');
      }
    } finally {
      await db.query('delete from private.admins where user_id=$1', [eve]);
    }
  });
  it('gli avvisi sono persistenti, limitati e non cambiano la privacy', async () => {
    await asUser(
      alice,
      "insert into public.posts(author_id,body,content_warning) values($1,'Finale del film','Spoiler')",
      [alice],
    );
    const rows = await asUser<{ id: string; content_warning: string }>(
      alice,
      "select id,content_warning from public.posts where body='Finale del film'",
    );
    expect(rows[0].content_warning).toBe('Spoiler');
    expect(await asUser(eve, 'select * from public.posts where id=$1', [rows[0].id])).toHaveLength(
      0,
    );
    await expect(
      asUser(alice, 'insert into public.posts(author_id,body,content_warning) values($1,$2,$3)', [
        alice,
        'Test',
        'x'.repeat(161),
      ]),
    ).rejects.toThrow('check constraint');
    await asUser(alice, 'insert into public.bookmarks(user_id,post_id) values($1,$2)', [
      alice,
      rows[0].id,
    ]);
    await asUser(alice, 'delete from public.posts where id=$1', [rows[0].id]);
    expect(
      (await db.query('select * from public.bookmarks where post_id=$1', [rows[0].id])).rows,
    ).toHaveLength(0);
  });
  it('non salva storie e contenuti scaduti e conserva un ordine stabile a parità di data', async () => {
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()].sort().reverse();
    // Fixtures created by SQL owner; insert guards require authenticated author identity.
    await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false)`);
    for (const id of ids) {
      await db.query("insert into public.posts(id,author_id,body) values($1,$2,'Archivio')", [
        id,
        alice,
      ]);
      await asUser(alice, 'insert into public.bookmarks(user_id,post_id) values($1,$2)', [
        alice,
        id,
      ]);
    }
    await db.query(
      "update public.bookmarks set created_at='2026-01-01' where post_id=any($1::uuid[])",
      [ids],
    );
    const first = await asUser<{ post_id: string }>(
      alice,
      'select post_id from public.bookmarks where post_id=any($1::uuid[]) order by created_at desc,post_id desc limit 2',
      [ids],
    );
    const next = await asUser<{ post_id: string }>(
      alice,
      "select post_id from public.bookmarks where post_id=any($1::uuid[]) and (created_at,post_id)<('2026-01-01'::timestamptz,$2::uuid) order by created_at desc,post_id desc",
      [ids, first[1].post_id],
    );
    expect([...first, ...next].map((row) => row.post_id)).toEqual(ids);
    await db.query("update public.posts set expires_at=now()-interval '1 second' where id=$1", [
      ids[0],
    ]);
    expect(
      await asUser(alice, 'select * from public.bookmarks where post_id=$1', [ids[0]]),
    ).toHaveLength(0);
    await expect(
      asUser(
        alice,
        'insert into public.bookmarks(user_id,post_id) values($1,$2) on conflict do nothing',
        [alice, ids[0]],
      ),
    ).rejects.toThrow('row-level security');
    await asUser(alice, 'delete from public.bookmarks where post_id=$1', [ids[1]]);
    const path = `${alice}/${crypto.randomUUID()}`;
    await asUser(
      alice,
      'insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,10,$3)',
      [path, alice, 'image/png'],
    );
    await db.query("update public.posts set kind='story',media_path=$2 where id=$1", [
      ids[1],
      path,
    ]);
    await expect(
      asUser(alice, 'insert into public.bookmarks(user_id,post_id) values($1,$2)', [alice, ids[1]]),
    ).rejects.toThrow('row-level security');
    await db.query('delete from public.posts where id=any($1::uuid[])', [ids]);
  });

  it('mantiene i messaggi ordinari e applica la modalità solo ai nuovi invii', async () => {
    const id = await send(bob, alice, 0);
    await asUser(alice, 'select public.set_chat_settings($1,true,3600)', [bob]);
    const rows = await asUser<{ expires_at: string | null }>(
      alice,
      'select expires_at from public.messages where id=$1',
      [id],
    );
    expect(rows[0].expires_at).toBeNull();
    expect(await asUser(eve, 'select * from public.chat_settings')).toHaveLength(0);
    await expect(
      asUser(eve, 'select public.set_chat_settings($1,true,3600)', [bob]),
    ).rejects.toThrow('Accesso negato');
  });
  it('modifica atomica: revisione, ricevute obsolete, lettura e limite di 30 minuti', async () => {
    const id = await send(bob, alice, 0);
    const context = {
      id,
      sender_id: bob,
      recipient_id: alice,
      expires_at: null,
      retention: 'synced' as const,
      revision: 1,
    };
    const packet = await seal(devices[bob], [devices[bob], devices[alice]], context, 'Corretto');
    await asUser(bob, 'select public.edit_chat_message($1,$2,null)', [id, packet.sealed]);
    await asUser(alice, 'select public.chat_receipt($1,0,true)', [id]);
    const state = async () =>
      (
        await asUser<{ revision: number; read_at: string | null }>(
          bob,
          'select revision,read_at from public.message_states where id=$1',
          [id],
        )
      )[0];
    expect(await state()).toMatchObject({ revision: 1, read_at: null });
    await expect(asUser(bob, 'select public.chat_receipt($1,1,true)', [id])).rejects.toThrow(
      'Accesso negato',
    );
    await asUser(alice, 'select public.chat_receipt($1,1,true)', [id]);
    expect((await state()).read_at).not.toBeNull();
    const next = await seal(
      devices[bob],
      [devices[bob], devices[alice]],
      { ...context, revision: 2 },
      'Troppo tardi',
    );
    await expect(
      asUser(bob, 'select public.edit_chat_message($1,$2,null)', [id, next.sealed]),
    ).rejects.toThrow();
    const old = await send(bob, alice, 0);
    await db.query(
      "update public.message_states set created_at=now()-interval '31 minutes' where id=$1",
      [old],
    );
    const expired = await seal(
      devices[bob],
      [devices[bob], devices[alice]],
      { ...context, id: old },
      'Tardi',
    );
    await expect(
      asUser(bob, 'select public.edit_chat_message($1,$2,null)', [old, expired.sealed]),
    ).rejects.toThrow();
  });
  it('separa eliminazione personale e globale, senza permettere a terzi di agire', async () => {
    const id = await send(bob, alice, 0);
    await asUser(alice, 'select public.delete_chat_message($1,false)', [id]);
    expect(
      await asUser(alice, 'select * from public.hidden_messages where message_id=$1', [id]),
    ).toHaveLength(1);
    expect(
      await asUser(bob, 'select * from public.hidden_messages where message_id=$1', [id]),
    ).toHaveLength(0);
    expect(await asUser(bob, 'select * from public.messages where id=$1', [id])).toHaveLength(1);
    await expect(asUser(alice, 'select public.delete_chat_message($1,true)', [id])).rejects.toThrow(
      'Accesso negato',
    );
    await expect(asUser(eve, 'select public.delete_chat_message($1,false)', [id])).rejects.toThrow(
      'Accesso negato',
    );
    await asUser(bob, 'select public.delete_chat_message($1,true)', [id]);
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(0);
    const rows = await asUser<{ deleted_at: string | null }>(
      alice,
      'select deleted_at from public.message_states where id=$1',
      [id],
    );
    expect(rows[0].deleted_at).not.toBeNull();
  });
  it('conserva la revisione dopo consegna solo dispositivo e impedisce la resurrezione con retry', async () => {
    const id = await send(bob, alice, 0, null, 'device');
    const [{ encrypted }] = await asUser<{ encrypted: Record<string, unknown> }>(
      bob,
      'select encrypted from public.messages where id=$1',
      [id],
    );
    await asUser(alice, 'select public.acknowledge_chat_revision($1,0)', [id]);
    await asUser(
      bob,
      "insert into public.messages(id,sender_id,recipient_id,body,ttl_seconds,encrypted) values($1,$2,$3,'',0,$4) on conflict do nothing",
      [id, bob, alice, encrypted],
    );
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(0);
    const packet = await seal(
      devices[bob],
      [devices[bob], devices[alice]],
      {
        id,
        sender_id: bob,
        recipient_id: alice,
        expires_at: null,
        retention: 'device',
        revision: 1,
      },
      'Nuova revisione',
    );
    await asUser(bob, 'select public.edit_chat_message($1,$2,null)', [id, packet.sealed]);
    await asUser(alice, 'select public.acknowledge_chat_revision($1,0)', [id]);
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(1);
    await asUser(alice, 'select public.acknowledge_chat_revision($1,1)', [id]);
    expect(await asUser(alice, 'select * from public.messages where id=$1', [id])).toHaveLength(0);
  });
  it('un blocco revoca visibilità e follow in entrambe le direzioni', async () => {
    await asUser(alice, 'insert into public.blocks(blocker_id,blocked_id) values($1,$2)', [
      alice,
      bob,
    ]);
    expect(
      await asUser(bob, 'select * from public.posts where author_id=$1', [alice]),
    ).toHaveLength(0);
    expect(await asUser(bob, 'select * from public.follows')).toHaveLength(0);
    expect(await asUser(bob, 'select * from public.bookmarks')).toHaveLength(0);
    await expect(
      asUser(
        bob,
        "insert into public.messages(sender_id,recipient_id,body) values($1,$2,'Ancora qui')",
        [bob, alice],
      ),
    ).rejects.toThrow('Accesso negato');
  });
  it('disabilitando un account nega accesso anche a un token già emesso', async () => {
    await db.query('update public.profiles set disabled=true where id=$1', [bob]);
    expect(await asUser(bob, 'select * from public.messages')).toHaveLength(0);
    expect(await asUser(bob, 'select * from public.profiles')).toHaveLength(0);
  });
  it('la soglia account vale anche per chiamate dirette ad Auth', async () => {
    await db.exec('update private.settings set max_members=3');
    await invite('last@example.test', 'valid-token-long');
    await expect(
      signup(
        '00000000-0000-4000-8000-000000000010',
        'last@example.test',
        'last',
        'valid-token-long',
      ),
    ).rejects.toThrow('Registrazioni chiuse');
  });
});

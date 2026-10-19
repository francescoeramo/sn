import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';

// Exercise both the current local schema and the released schema without the
// owner's pending October 15 migrations. Security commits must work on either.
describe.each(['current', 'released'])('security boundaries (%s schema)', (schema) => {
  let db: PGlite;
  const alice = '00000000-0000-4000-8000-000000000001';
  const bob = '00000000-0000-4000-8000-000000000002';
  const carol = '00000000-0000-4000-8000-000000000003';
  async function asUser<T = Record<string, unknown>>(id: string, sql: string, params: unknown[] = [], aal = 'aal1') {
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id, JSON.stringify({ sub: id, aal })]);
    await db.exec('savepoint user_action');
    try { return (await db.query<T>(sql, params)).rows; }
    catch (error) { await db.exec('rollback to savepoint user_action'); throw error; }
    finally { await db.exec('release savepoint user_action; reset role'); }
  }
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,status text);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz default now(),updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;grant execute on function auth.jwt() to authenticated,anon,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique,metadata jsonb,owner_id text);
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete,update on storage.objects to authenticated;`);
    for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
      if (schema === 'released' && file.startsWith('20261015')) continue;
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'));
    }
    for (const [id, name] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']]) {
      const email = name + '@example.test', token = name.repeat(12);
      await db.query("insert into private.invites(token_hash,email) values(encode(sha256(convert_to($1,'UTF8')),'hex'),$2)", [token, email]);
      await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id,email,{username:name,invite_code:token}]);
    }
  }, 30000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await db.exec('begin'); });
  afterEach(async () => { await db.exec('reset role; rollback'); });

  it('gates invitations on active membership and enrolled MFA while preserving the challenge profile', async () => {
    const circle = '10000000-0000-4000-8000-000000000001';
    const post = '20000000-0000-4000-8000-000000000001';
    await db.query("insert into public.circles(id,name,description,created_by) values($1,'Private circle','Private details',$2)", [circle,alice]);
    await db.query("insert into public.circle_members(circle_id,user_id,invited_by,status) values($1,$2,$3,'invited')", [circle,bob,alice]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    await db.query("insert into public.posts(id,author_id,body) values($1,$2,'Private post')",[post,alice]);
    await db.query('insert into public.collaborators(post_id,user_id,invited_by) values($1,$2,$3)',[post,bob,alice]);
    const invitationCounts = async (id: string, aal = 'aal1') => asUser(id, `select
      (select count(*)::int from public.circles) circles,
      (select count(*)::int from public.circle_members) members,
      (select count(*)::int from public.collaborators) collaborators`, [], aal);
    expect(await invitationCounts(bob)).toEqual([{circles:1,members:1,collaborators:1}]);
    expect(await invitationCounts(carol)).toEqual([{circles:0,members:0,collaborators:0}]);
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[bob]);
    expect(await invitationCounts(bob)).toEqual([{circles:0,members:0,collaborators:0}]);
    expect(await asUser(bob,'select id from public.profiles where id=$1',[bob])).toHaveLength(1);
    expect(await invitationCounts(bob,'aal2')).toEqual([{circles:1,members:1,collaborators:1}]);
    await db.query('delete from auth.mfa_factors where user_id=$1',[bob]);
    await db.query('update public.profiles set disabled=true where id=$1',[bob]);
    expect(await invitationCounts(bob)).toEqual([{circles:0,members:0,collaborators:0}]);
  });

  it('filters both connection lists for either block direction and preserves unblocked results', async () => {
    await db.query("update public.profiles set connections_visibility='everyone',is_private=false");
    await asUser(bob,'insert into public.follows(follower_id,following_id) values($1,$2)',[bob,carol]);
    await asUser(carol,'insert into public.follows(follower_id,following_id) values($1,$2)',[carol,bob]);
    type Lists = {result:{followers:{id:string}[];following:{id:string}[]}};
    const lists = async () => (await asUser<Lists>(alice,'select public.profile_connections($1) result',[carol]))[0].result;
    expect((await lists()).followers.map((p)=>p.id)).toContain(bob);
    expect((await lists()).following.map((p)=>p.id)).toContain(bob);
    for (const [blocker,blocked] of [[bob,alice],[alice,bob]]) {
      await db.query('insert into public.blocks(blocker_id,blocked_id) values($1,$2)',[blocker,blocked]);
      expect(await asUser(alice,'select id from public.profiles where id=$1',[bob])).toEqual([]);
      expect((await lists()).followers).toEqual([]);
      expect((await lists()).following).toEqual([]);
      await db.query('delete from public.blocks');
    }
    expect((await lists()).followers.map((p)=>p.id)).toContain(bob);
  });

  it('queues only explicit server-authorized deletion and preserves suspended accounts', async () => {
    await db.query('update public.profiles set disabled=true where id=$1',[bob]);
    expect((await db.query('select * from public.pending_account_deletions()')).rows).toEqual([]);
    for (const sql of ['select public.begin_account_deletion($1)', 'select * from public.pending_account_deletions()']) {
      await db.exec('savepoint denied');
      await expect(asUser(carol,sql,sql.includes('($1)')?[alice]:[])).rejects.toThrow('permission denied');
      await db.exec('rollback to savepoint denied');
    }
    await db.query('select public.begin_account_deletion($1)',[alice]);
    await db.query('select public.begin_account_deletion($1)',[alice]);
    expect((await db.query('select * from public.pending_account_deletions()')).rows).toEqual([{id:alice}]);
    expect((await db.query('select disabled from public.profiles where id=$1',[alice])).rows).toEqual([{disabled:true}]);
    expect(await asUser(alice,'select id from public.profiles')).toEqual([]);
    expect((await db.query("select has_function_privilege('service_role','public.begin_account_deletion(uuid)','execute') allowed")).rows).toEqual([{allowed:true}]);
  });

  it('rejects direct Storage writes even with a fresh matching reservation', async () => {
    const path = bob + '/00000000-0000-4000-8000-000000000004';
    await asUser(bob,"insert into public.media_assets(path,owner_id,bytes,mime) values($1,$2,1,'application/octet-stream')",[path,bob]);
    await db.exec('savepoint rejected_upload');
    await expect(asUser(bob,"insert into storage.objects(bucket_id,name,metadata) values('media',$1,$2)",[path,{size:2,mimetype:'image/png'}])).rejects.toThrow('row-level security');
    await db.exec('rollback to savepoint rejected_upload');
    // Model the trusted service's persistence; public read visibility still uses RLS.
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('media',$1,$2)",[path,{size:1,mimetype:'application/octet-stream'}]);
    expect(await asUser(bob,'select name from storage.objects where name=$1',[path])).toEqual([{name:path}]);
    expect(await asUser(carol,'select name from storage.objects where name=$1',[path])).toEqual([]);
  });
});

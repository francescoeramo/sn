alter table public.profiles
  drop constraint if exists profiles_username_check,
  add constraint profiles_username_check check(username ~ '^[a-z0-9_.]{3,24}$');

create or replace function private.before_signup()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare invite_hash text; cfg private.settings;
begin
  select * into cfg from private.settings where id=true for update;
  if not cfg.registrations_enabled or (select count(*) from auth.users)>=cfg.max_members then raise exception 'Registrazioni chiuse'; end if;
  invite_hash := encode(sha256(convert_to(coalesce(new.raw_user_meta_data->>'invite_code',''),'UTF8')),'hex');
  update private.invites set used_at=now() where token_hash=invite_hash and lower(email)=lower(new.email) and used_at is null and expires_at>now();
  if not found then raise exception 'Invito non valido'; end if;
  if coalesce(new.raw_user_meta_data->>'username','') !~ '^[a-z0-9_.]{3,24}$' then raise exception 'Nome utente non valido'; end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_code';
  return new;
end $$;

-- Supabase Auth's invite flow creates the auth.users row first and then
-- writes invited_at in the same transaction (internal/api/invite.go and mail.go).
-- Therefore inspect the final row with a deferred constraint trigger, never
-- reject the initial INSERT merely because NEW.invited_at is still null.
create function private.enforce_invited_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invited_at timestamptz;
begin
  select u.invited_at into v_invited_at from auth.users u where u.id = new.id;
  if found and v_invited_at is null then
    raise exception using errcode = '42501', message = 'INVITATION_REQUIRED';
  end if;
  return null;
end;
$function$;

revoke all on function private.enforce_invited_new_account() from public, anon, authenticated, service_role;

create constraint trigger arbeitszeit_invited_accounts_only
after insert on auth.users
deferrable initially deferred
for each row execute function private.enforce_invited_new_account();

comment on function private.enforce_invited_new_account() is
  'Rejects newly created non-invited accounts at commit; preserves all existing accounts and the Supabase invitation transaction.';

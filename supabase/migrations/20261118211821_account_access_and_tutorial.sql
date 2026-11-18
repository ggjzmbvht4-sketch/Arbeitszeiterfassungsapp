-- Account access and tutorial metadata are intentionally separate from work snapshots.
-- Existing user_snapshots/history/CAS functions and their policies are unchanged.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.account_legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (terms_version = '2026-11-18'),
  privacy_version text not null check (privacy_version = '2026-11-18'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);

alter table public.account_legal_acceptances enable row level security;
revoke all on table public.account_legal_acceptances from public, anon, authenticated;
grant select on table public.account_legal_acceptances to authenticated;
grant all on table public.account_legal_acceptances to service_role;

create policy legal_select_own on public.account_legal_acceptances
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  );

-- The only owner-privileged code is in a non-exposed schema.
-- It accepts no user ID or timestamp from the client and cannot replace a prior receipt.
create function private.record_legal_acceptance(p_terms_version text, p_privacy_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_receipt public.account_legal_acceptances;
begin
  if v_user is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_terms_version is distinct from '2026-11-18'
     or p_privacy_version is distinct from '2026-11-18' then
    raise exception using errcode = '22023', message = 'LEGAL_VERSION_MISMATCH';
  end if;

  insert into public.account_legal_acceptances(user_id, terms_version, privacy_version)
    values (v_user, p_terms_version, p_privacy_version)
    on conflict (user_id, terms_version, privacy_version) do nothing;

  select receipt.* into strict v_receipt
    from public.account_legal_acceptances receipt
    where receipt.user_id = v_user
      and receipt.terms_version = p_terms_version
      and receipt.privacy_version = p_privacy_version;
  return to_jsonb(v_receipt);
end;
$function$;

revoke all on function private.record_legal_acceptance(text, text) from public, anon, authenticated;
grant execute on function private.record_legal_acceptance(text, text) to authenticated, service_role;

create function public.accept_current_legal(p_terms_version text, p_privacy_version text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.record_legal_acceptance(p_terms_version, p_privacy_version);
$function$;

revoke all on function public.accept_current_legal(text, text) from public, anon, authenticated;
grant execute on function public.accept_current_legal(text, text) to authenticated, service_role;

create table public.account_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tutorial_version integer not null default 1 check (tutorial_version = 1),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  finished_at timestamptz,
  constraint onboarding_finished_state check (
    (status = 'pending' and finished_at is null)
    or (status in ('completed', 'skipped') and finished_at is not null)
  )
);

alter table public.account_onboarding enable row level security;
revoke all on table public.account_onboarding from public, anon, authenticated;
grant select, insert, update on table public.account_onboarding to authenticated;
grant all on table public.account_onboarding to service_role;

create policy onboarding_select_own on public.account_onboarding
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  );
create policy onboarding_insert_own on public.account_onboarding
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  );
create policy onboarding_update_own on public.account_onboarding
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  )
  with check (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  );

comment on table public.account_legal_acceptances is
  'Versioned per-account acceptance receipts. Client append only through accept_current_legal; retained across work-data restore/reset.';
comment on table public.account_onboarding is
  'Per-account tutorial outcome; never stores demo work records.';
notify pgrst, 'reload schema';

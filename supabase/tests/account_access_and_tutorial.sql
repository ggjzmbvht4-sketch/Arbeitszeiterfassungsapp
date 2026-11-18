-- No existing account, work record, snapshot or backup is changed.
-- Newly generated synthetic rows live only in a rolled-back subtransaction.
set local statement_timeout = '5s';
do $test$
declare
  a uuid := gen_random_uuid();
  blocked boolean := false;
  receipt jsonb;
begin
  -- Force the deferred check to simulate commit without leaving a new account.
  begin
    insert into auth.users(id,email,aud,role,created_at,updated_at)
      values(a,'access-check-'||a::text||'@example.invalid','authenticated','authenticated',now(),now());
    set constraints auth.arbeitszeit_invited_accounts_only immediate;
  exception when insufficient_privilege then
    if sqlerrm <> 'INVITATION_REQUIRED' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Non-invited signup was allowed'; end if;
  set constraints auth.arbeitszeit_invited_accounts_only deferred;

  -- This matches GoTrue's invite transaction: INSERT, then invited_at UPDATE.
  -- The sentinel rolls the entire successful test block back.
  begin
    a := gen_random_uuid();
    insert into auth.users(id,email,aud,role,created_at,updated_at)
      values(a,'access-check-'||a::text||'@example.invalid','authenticated','authenticated',now(),now());
    update auth.users set invited_at=now() where id=a;
    set constraints auth.arbeitszeit_invited_accounts_only immediate;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
    receipt := public.accept_current_legal('2026-11-18','2026-11-18');
    if receipt->>'user_id' <> a::text or receipt->>'accepted_at' is null
      or receipt <> public.accept_current_legal('2026-11-18','2026-11-18') then
      raise exception 'Legal receipt identity/idempotency failed';
    end if;

    blocked := false;
    begin
      perform public.accept_current_legal('invalid','2026-11-18');
    exception when sqlstate '22023' then blocked := true;
    end;
    if not blocked then raise exception 'Unsupported legal version accepted'; end if;

    insert into public.account_onboarding(user_id) values(a);
    update public.account_onboarding set status='completed',finished_at=now() where user_id=a;
    blocked := false;
    begin
      update public.account_onboarding set status='pending' where user_id=a;
    exception when check_violation then blocked := true;
    end;
    if not blocked then raise exception 'Inconsistent onboarding state accepted'; end if;

    -- Verify deletion behaviour from the catalog, without deleting any row.
    if (select count(*) from pg_constraint
      where contype='f' and confrelid='auth.users'::regclass
        and conrelid in ('public.account_legal_acceptances'::regclass,'public.account_onboarding'::regclass)
        and confdeltype='c') <> 2 then
      raise exception 'Account metadata foreign-key configuration failed';
    end if;
    raise exception using errcode='ZX001',message='ROLLBACK_SYNTHETIC_TEST';
  exception when sqlstate 'ZX001' then null;
  end;

  if has_table_privilege('authenticated','public.account_legal_acceptances','INSERT')
    or has_table_privilege('authenticated','public.account_legal_acceptances','UPDATE')
    or has_table_privilege('authenticated','public.account_legal_acceptances','DELETE')
    or has_function_privilege('anon','public.accept_current_legal(text,text)','EXECUTE') then
    raise exception 'Legal append-only permissions failed';
  end if;
  if not has_table_privilege('authenticated','public.account_onboarding','SELECT,INSERT,UPDATE')
    or has_table_privilege('anon','public.account_onboarding','SELECT')
    or has_table_privilege('authenticated','public.account_onboarding','DELETE') then
    raise exception 'Onboarding grants failed';
  end if;
end;
$test$;
select 'PASS: signup rejected, invite transaction accepted, legal receipt/idempotency/version, onboarding constraints, foreign-key configuration and grants; synthetic rows rolled back' as result;

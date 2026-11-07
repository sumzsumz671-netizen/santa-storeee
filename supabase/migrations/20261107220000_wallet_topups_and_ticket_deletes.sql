create table if not exists public.wallet_topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_number text not null unique default (
    'SUMZ-BAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  amount_cents bigint not null check (amount_cents >= 1000),
  payment_method text not null check (payment_method in ('cash_app', 'paypal', 'crypto')),
  customer_note text check (customer_note is null or length(customer_note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.wallet_topup_requests enable row level security;

revoke all on table public.wallet_topup_requests from public, anon, authenticated;
grant select on table public.wallet_topup_requests to authenticated;
grant insert (user_id, amount_cents, payment_method, customer_note)
  on table public.wallet_topup_requests to authenticated;

drop policy if exists wallet_topups_read_own_or_staff on public.wallet_topup_requests;
create policy wallet_topups_read_own_or_staff
  on public.wallet_topup_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff_or_admin());

drop policy if exists wallet_topups_customer_create_pending on public.wallet_topup_requests;
create policy wallet_topups_customer_create_pending
  on public.wallet_topup_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and amount_cents >= 1000
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );

create or replace function public.review_wallet_topup(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_request public.wallet_topup_requests%rowtype;
  v_balance bigint;
  v_new_balance bigint;
begin
  if v_actor is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;

  if not private.is_staff_or_admin() then
    raise exception 'Only authorized staff can review wallet top-ups.' using errcode = '42501';
  end if;

  if p_approve is null then
    raise exception 'Choose approve or reject.' using errcode = '22023';
  end if;

  select * into v_request
  from public.wallet_topup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Wallet top-up request not found.' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This wallet top-up request has already been reviewed.' using errcode = '23505';
  end if;

  if p_approve then
    if v_request.amount_cents < 1000 then
      raise exception 'Wallet top-ups must be at least $10.00.' using errcode = '22023';
    end if;

    select wallet_balance_cents into v_balance
    from public.profiles
    where id = v_request.user_id
    for update;

    if not found then
      raise exception 'Customer wallet could not be found.' using errcode = 'P0002';
    end if;

    v_new_balance := v_balance + v_request.amount_cents;
    update public.profiles
      set wallet_balance_cents = v_new_balance, updated_at = now()
      where id = v_request.user_id;

    insert into public.wallet_transactions
      (user_id, order_id, transaction_type, amount_cents, balance_after_cents, note, created_by)
    values
      (
        v_request.user_id,
        null,
        'admin_credit',
        v_request.amount_cents,
        v_new_balance,
        coalesce(
          nullif(trim(p_note), ''),
          'Approved wallet top-up ' || v_request.request_number
        ),
        v_actor
      );

    update public.wallet_topup_requests
      set status = 'approved', reviewed_at = now(), reviewed_by = v_actor
      where id = v_request.id;

    return jsonb_build_object(
      'request_id', v_request.id,
      'request_number', v_request.request_number,
      'status', 'approved',
      'credited_cents', v_request.amount_cents,
      'balance_cents', v_new_balance
    );
  else
    update public.wallet_topup_requests
      set status = 'rejected', reviewed_at = now(), reviewed_by = v_actor
      where id = v_request.id;

    return jsonb_build_object(
      'request_id', v_request.id,
      'request_number', v_request.request_number,
      'status', 'rejected',
      'credited_cents', 0
    );
  end if;
end;
$function$;

revoke all on function public.review_wallet_topup(uuid, boolean, text) from public, anon;
grant execute on function public.review_wallet_topup(uuid, boolean, text) to authenticated;

drop policy if exists support_conversations_staff_delete on public.support_conversations;
create policy support_conversations_staff_delete
  on public.support_conversations
  for delete to authenticated
  using (private.is_staff_or_admin());

alter table public.support_conversations replica identity full;

do $publication$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wallet_topup_requests'
  ) then
    alter publication supabase_realtime add table public.wallet_topup_requests;
  end if;
end
$publication$;

alter table public.profiles
  add column if not exists purchase_blocked boolean not null default false,
  add column if not exists purchase_block_reason text,
  add column if not exists purchase_blocked_at timestamptz,
  add column if not exists purchase_blocked_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_purchase_blocked_idx
  on public.profiles (purchase_blocked)
  where purchase_blocked = true;

create or replace function private.is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin')
  );
$function$;

revoke all on function private.is_owner_or_admin() from public, anon, authenticated;

create or replace function public.admin_set_purchase_block(
  p_user_id uuid,
  p_blocked boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
  v_ticket_ids uuid[] := array[]::uuid[];
  v_attachment_paths text[] := array[]::text[];
  v_deleted_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Sign in is required.' using errcode = '28000';
  end if;
  if not private.is_owner_or_admin() then
    raise exception 'Only the owner or an admin can block customer purchases.' using errcode = '42501';
  end if;
  if p_user_id is null or p_blocked is null then
    raise exception 'Choose a customer and a valid block action.' using errcode = '22023';
  end if;
  if p_user_id = v_actor then
    raise exception 'You cannot block your own account.' using errcode = '22023';
  end if;
  if p_reason is not null and length(trim(p_reason)) > 500 then
    raise exception 'The reason must be 500 characters or fewer.' using errcode = '22023';
  end if;

  select p.role
    into v_target_role
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'Customer account not found.' using errcode = 'P0002';
  end if;
  if v_target_role <> 'customer' then
    raise exception 'Only customer accounts can be blocked.' using errcode = '42501';
  end if;

  if p_blocked then
    update public.profiles
      set purchase_blocked = true,
          purchase_block_reason = nullif(trim(p_reason), ''),
          purchase_blocked_at = now(),
          purchase_blocked_by = v_actor,
          updated_at = now()
    where id = p_user_id;

    select coalesce(array_agg(distinct c.id), array[]::uuid[])
      into v_ticket_ids
    from public.support_conversations c
    join public.orders o on o.id = c.order_id and o.user_id = p_user_id
    where c.user_id = p_user_id
      and exists (
        select 1
        from public.order_items oi
        left join public.products pr on pr.id = oi.product_id
        where oi.order_id = o.id
          and (
            lower(coalesce(oi.product_name, '')) like '%account request%'
            or lower(coalesce(oi.product_name, '')) like '%acc request%'
            or lower(coalesce(oi.product_name, '')) like '%custom request%'
            or lower(coalesce(oi.product_name, '')) like '%custom account%'
            or lower(coalesce(pr.name, '')) like '%account request%'
            or lower(coalesce(pr.name, '')) like '%acc request%'
            or lower(coalesce(pr.name, '')) like '%custom request%'
            or lower(coalesce(pr.name, '')) like '%custom account%'
            or lower(coalesce(pr.category, '')) like '%account request%'
            or lower(coalesce(pr.category, '')) like '%acc request%'
            or lower(coalesce(pr.category, '')) like '%custom request%'
            or lower(coalesce(pr.slug, '')) like '%account-request%'
            or lower(coalesce(pr.slug, '')) like '%acc-request%'
            or lower(coalesce(pr.slug, '')) like '%custom-request%'
          )
      );

    if cardinality(v_ticket_ids) > 0 then
      select coalesce(array_agg(distinct cm.attachment_path), array[]::text[])
        into v_attachment_paths
      from public.chat_messages cm
      where cm.conversation_id = any(v_ticket_ids)
        and cm.attachment_path is not null;

      delete from public.support_conversations c
      where c.id = any(v_ticket_ids);
      get diagnostics v_deleted_count = row_count;
    end if;
  else
    update public.profiles
      set purchase_blocked = false,
          purchase_block_reason = null,
          purchase_blocked_at = null,
          purchase_blocked_by = null,
          updated_at = now()
    where id = p_user_id;
  end if;

  return jsonb_build_object(
    'purchase_blocked', p_blocked,
    'deleted_account_request_tickets', v_deleted_count,
    'deleted_conversation_ids', to_jsonb(v_ticket_ids),
    'attachment_paths', to_jsonb(v_attachment_paths)
  );
end;
$function$;

revoke all on function public.admin_set_purchase_block(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_purchase_block(uuid, boolean, text) to authenticated;

do $migration$
declare
  v_def text;
  v_match text := '  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then';
  v_insert text := '  if exists (select 1 from public.profiles p where p.id = v_user_id and p.purchase_blocked) then
    raise exception ''Purchasing is disabled for your account. Contact Sumz Market support.'' using errcode = ''42501'';
  end if;

' || v_match;
begin
  v_def := pg_get_functiondef('public.create_manual_order(uuid,integer,text,boolean)'::regprocedure);
  if position(v_match in v_def) = 0 then
    raise exception 'Could not locate the expected quantity validation in create_manual_order.';
  end if;
  execute replace(v_def, v_match, v_insert);

  v_def := pg_get_functiondef('public.purchase_product_with_balance(uuid,integer,boolean)'::regprocedure);
  if position(v_match in v_def) = 0 then
    raise exception 'Could not locate the expected quantity validation in purchase_product_with_balance.';
  end if;
  execute replace(v_def, v_match, v_insert);
end;
$migration$;

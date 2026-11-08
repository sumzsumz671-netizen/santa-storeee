-- Separate the store owner from staff and protect owner-only delivery messages.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['customer'::text, 'owner'::text, 'admin'::text, 'staff'::text]));

-- The existing admin account becomes the permanent owner account.
update public.profiles
set role = 'owner', updated_at = now()
where role = 'admin';

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
  );
$function$;

create or replace function private.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'staff')
  );
$function$;

revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_staff_or_admin() to authenticated;

-- Owner-only staff management. Staff can only be granted to an existing customer account.
create or replace function public.owner_set_staff(p_email text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_matches integer;
  v_user_id uuid;
  v_current_role text;
  v_next_role text;
begin
  if (select auth.uid()) is null or not private.is_owner() then
    raise exception 'Only the store owner can manage staff accounts.'
      using errcode = '42501';
  end if;

  if v_email = '' or pg_catalog.length(v_email) > 320 then
    raise exception 'Enter a valid account email address.'
      using errcode = '22023';
  end if;

  if p_enabled is null then
    raise exception 'Choose whether to add or remove staff access.'
      using errcode = '22023';
  end if;

  select pg_catalog.count(*)
  into v_matches
  from public.profiles p
  where pg_catalog.lower(coalesce(p.email, '')) = v_email;

  if v_matches = 0 then
    raise exception 'No registered Sumz Market account was found for that email. Ask them to create a customer account first.'
      using errcode = 'P0002';
  end if;

  if v_matches > 1 then
    raise exception 'More than one profile matches that email. Contact support before changing access.'
      using errcode = '21000';
  end if;

  select p.id, p.role
  into v_user_id, v_current_role
  from public.profiles p
  where pg_catalog.lower(coalesce(p.email, '')) = v_email
  for update;

  if v_current_role = 'owner' then
    raise exception 'The store owner account cannot be changed from staff management.'
      using errcode = '42501';
  end if;

  if p_enabled then
    if v_current_role = 'staff' then
      v_next_role := 'staff';
    elsif v_current_role = 'customer' then
      update public.profiles
      set role = 'staff', updated_at = pg_catalog.now()
      where id = v_user_id;
      v_next_role := 'staff';
    else
      raise exception 'This account cannot be changed to staff from its current role.'
        using errcode = '22023';
    end if;
  else
    if v_current_role = 'customer' then
      v_next_role := 'customer';
    elsif v_current_role = 'staff' then
      update public.profiles
      set role = 'customer', updated_at = pg_catalog.now()
      where id = v_user_id;
      v_next_role := 'customer';
    else
      raise exception 'This account is not a staff account.'
        using errcode = '22023';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'email', v_email,
    'role', v_next_role
  );
end;
$function$;

revoke all on function public.owner_set_staff(text, boolean) from public, anon, authenticated;
grant execute on function public.owner_set_staff(text, boolean) to authenticated;

-- Mark existing owner-authored chat content private by default.
alter table public.chat_messages
  add column if not exists owner_only boolean not null default false;

update public.chat_messages m
set owner_only = true
where exists (
  select 1
  from public.profiles p
  where p.id = m.sender_id
    and p.role = 'owner'
);

drop policy if exists chat_messages_read_participant on public.chat_messages;
create policy chat_messages_read_participant
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations c
    where c.id = chat_messages.conversation_id
      and (
        c.user_id = (select auth.uid())
        or private.is_owner()
        or (
          private.is_staff_or_admin()
          and not chat_messages.owner_only
        )
      )
  )
);

drop policy if exists chat_messages_send_as_self on public.chat_messages;
create policy chat_messages_send_as_self
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.support_conversations c
    where c.id = chat_messages.conversation_id
      and c.status = 'open'
      and (
        private.is_owner()
        or (
          not chat_messages.owner_only
          and (
            c.user_id = (select auth.uid())
            or private.is_staff_or_admin()
          )
        )
      )
  )
);

-- Owner and customer can access attachments to all their messages.
-- Staff can only access attachments to non-owner-only messages.
drop policy if exists support_attachments_read_participant on storage.objects;
create policy support_attachments_read_participant
on storage.objects
for select
to authenticated
using (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.support_conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.user_id = (select auth.uid())
        or private.is_owner()
        or (
          private.is_staff_or_admin()
          and exists (
            select 1
            from public.chat_messages m
            where m.conversation_id = c.id
              and m.attachment_path = storage.objects.name
              and not m.owner_only
          )
        )
      )
  )
);

-- Deleting an owner-only attachment is restricted to the owner or the customer who owns the ticket.
drop policy if exists support_attachments_delete_participant on storage.objects;
create policy support_attachments_delete_participant
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.support_conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.user_id = (select auth.uid())
        or private.is_owner()
        or (
          private.is_staff_or_admin()
          and exists (
            select 1
            from public.chat_messages m
            where m.conversation_id = c.id
              and m.attachment_path = storage.objects.name
              and not m.owner_only
          )
        )
      )
  )
);

-- Staff may work support tickets but cannot delete the whole conversation.
drop policy if exists support_conversations_staff_delete on public.support_conversations;
drop policy if exists support_conversations_owner_delete on public.support_conversations;
create policy support_conversations_owner_delete
on public.support_conversations
for delete
to authenticated
using (private.is_owner());


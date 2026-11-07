-- Private customer/staff support attachments: screenshots and short videos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.chat_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_attachment_fields_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_attachment_fields_check
      check (
        (
          attachment_path is null
          and attachment_name is null
          and attachment_mime_type is null
          and attachment_size_bytes is null
        )
        or
        (
          attachment_path is not null
          and attachment_name is not null
          and attachment_mime_type in (
            'image/jpeg','image/png','image/webp','image/gif',
            'video/mp4','video/webm','video/quicktime'
          )
          and attachment_size_bytes between 1 and 26214400
        )
      );
  end if;
end
$constraints$;

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
      and (c.user_id = (select auth.uid()) or private.is_staff_or_admin())
  )
);

drop policy if exists support_attachments_upload_participant on storage.objects;
create policy support_attachments_upload_participant
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.support_conversations c
    where c.id::text = (storage.foldername(name))[1]
      and c.status = 'open'
      and (c.user_id = (select auth.uid()) or private.is_staff_or_admin())
  )
);

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
      and (c.user_id = (select auth.uid()) or private.is_staff_or_admin())
  )
);

alter table public.chat_messages replica identity full;

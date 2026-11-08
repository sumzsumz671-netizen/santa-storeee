alter table public.order_vouches add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouch-photos', 'vouch-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Buyer uploads own vouch photo" on storage.objects;
create policy "Buyer uploads own vouch photo" on storage.objects for insert to authenticated
with check (bucket_id = 'vouch-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[2] and o.user_id = (select auth.uid()) and o.status = 'completed'));

drop policy if exists "Buyer reads own vouch photo and staff can review" on storage.objects;
create policy "Buyer reads own vouch photo and staff can review" on storage.objects for select to authenticated
using (bucket_id = 'vouch-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_staff_or_admin()));

drop policy if exists "Buyer deletes own unpublished vouch photo" on storage.objects;
create policy "Buyer deletes own unpublished vouch photo" on storage.objects for delete to authenticated
using (bucket_id = 'vouch-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
and exists (select 1 from public.order_vouches v where v.photo_path = name and v.user_id = (select auth.uid()) and v.discord_status in ('pending','failed')));

drop policy if exists "Vouch requires a purchase photo" on public.order_vouches;
create policy "Vouch requires a purchase photo" on public.order_vouches for insert to authenticated
with check (user_id = (select auth.uid()) and photo_path is not null
and exists (select 1 from public.orders o where o.id = order_vouches.order_id and o.user_id = (select auth.uid()) and o.status = 'completed'));

drop policy if exists "Vouch photo path cannot be changed" on public.order_vouches;
create policy "Vouch photo path cannot be changed" on public.order_vouches for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and photo_path is not null);
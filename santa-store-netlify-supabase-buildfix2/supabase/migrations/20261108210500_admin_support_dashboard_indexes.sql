create index if not exists support_conversations_updated_at_idx on public.support_conversations (updated_at desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists profiles_customers_created_at_idx on public.profiles (created_at desc) where role = 'customer';
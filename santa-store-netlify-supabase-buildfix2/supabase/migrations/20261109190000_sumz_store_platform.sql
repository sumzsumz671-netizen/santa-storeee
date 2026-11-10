-- Sumz Store platform foundation. Run after the existing storefront migrations.
-- Keeps store/order data separate from the Sumz License Panel database.
create extension if not exists pgcrypto;

alter table public.products
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists tags text[] not null default '{}',
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists requirements text,
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents >= price_cents),
  license_duration_seconds bigint,
  device_limit integer check (device_limit is null or device_limit > 0),
  license_application_id text,
  stock_count integer check (stock_count is null or stock_count >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_variants enable row level security;
drop policy if exists "Public can view active variants" on public.product_variants;
create policy "Public can view active variants" on public.product_variants for select
  using (active and exists (select 1 from public.products p where p.id=product_id and p.active=true));

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value integer not null check (discount_value > 0),
  minimum_order_cents integer not null default 0 check (minimum_order_cents >= 0),
  maximum_uses integer check (maximum_uses is null or maximum_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

create table if not exists public.store_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_open_cart_per_customer on public.store_carts(user_id) where status='open';
alter table public.store_carts enable row level security;
drop policy if exists "Customers manage own carts" on public.store_carts;
create policy "Customers manage own carts" on public.store_carts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.store_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.store_carts(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  quantity integer not null default 1 check (quantity between 1 and 50),
  created_at timestamptz not null default now(),
  unique(cart_id,product_id,variant_id)
);
alter table public.store_cart_items enable row level security;
drop policy if exists "Customers manage own cart items" on public.store_cart_items;
create policy "Customers manage own cart items" on public.store_cart_items for all
  using (exists(select 1 from public.store_carts c where c.id=cart_id and c.user_id=auth.uid()))
  with check (exists(select 1 from public.store_carts c where c.id=cart_id and c.user_id=auth.uid()));

create table if not exists public.store_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  idempotency_key text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'created' check (status in ('created','pending','succeeded','failed','refunded','disputed')),
  verified_at timestamptz,
  provider_event_id text unique,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists store_payments_order_idx on public.store_payments(order_id);
alter table public.store_payments enable row level security;
drop policy if exists "Customers view own payments" on public.store_payments;
create policy "Customers view own payments" on public.store_payments for select
  using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));

create table if not exists public.license_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  customer_id uuid not null references auth.users(id),
  application_id text not null,
  license_duration_seconds bigint not null check (license_duration_seconds > 0),
  device_limit integer not null check (device_limit > 0),
  status text not null default 'queued' check (status in ('queued','processing','fulfilled','retry','failed','revoked')),
  external_license_id text unique,
  encrypted_delivery_payload text,
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.license_fulfillments enable row level security;
drop policy if exists "Customers view own delivered licenses" on public.license_fulfillments;
create policy "Customers view own delivered licenses" on public.license_fulfillments for select using (customer_id=auth.uid());

create table if not exists public.store_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists store_audit_events_created_idx on public.store_audit_events(created_at desc);
alter table public.store_audit_events enable row level security;

-- These new admin-write tables intentionally have no browser write policies.
-- Mutations must run through trusted server code with authorization + audit logging.

-- Run in Supabase SQL Editor. RLS is enabled; catalog is public, order/customer data private.
create table if not exists public.products(
 id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
 description text, category text, badge text, emoji text default '🎁',
 price_cents integer not null check(price_cents>=0), price_max_cents integer check(price_max_cents is null or price_max_cents>=price_cents),
 stock_label text default 'Available', active boolean default false, sort_order integer default 0,
 created_at timestamptz default now()
);
alter table public.products enable row level security;
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select using(active=true);
create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade, email text, role text not null default 'customer' check(role in ('customer','admin','staff')), created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users view own profile" on public.profiles for select using(auth.uid()=id);
create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 order_number text unique not null, status text not null default 'pending_payment',
 payment_method text not null, payment_reference text, proof_url text, total_cents integer not null check(total_cents>=0),
 created_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Customers view own orders" on public.orders for select using(auth.uid()=user_id);
create table if not exists public.order_items(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id), product_name text not null, quantity integer not null default 1 check(quantity>0), unit_price_cents integer not null
);
alter table public.order_items enable row level security;
create policy "Customers view own order items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
-- Admin operations should be implemented with server-side Edge Functions/service-role checks, not anon client writes.
-- Never expose SUPABASE_SERVICE_ROLE_KEY in a NEXT_PUBLIC variable.

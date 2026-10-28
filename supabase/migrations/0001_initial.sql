create extension if not exists pgcrypto;
create type public.product_status as enum ('draft','active','archived');
create type public.order_status as enum ('pending','paid','expired','refunded','cancelled');
create type public.kyc_status as enum ('pending','approved','rejected');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', phone text, date_of_birth date, cpf_encrypted text, kyc_status public.kyc_status not null default 'pending', pix_key_encrypted text, pix_key_type text check (pix_key_type in ('cpf','cnpj','email','phone','random')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.products (id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.profiles(id) on delete restrict, name text not null check (char_length(name) between 2 and 120), description text not null default '', price_cents integer not null check (price_cents >= 100), banner_url text, status public.product_status not null default 'draft', slug text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict, seller_id uuid not null references public.profiles(id) on delete restrict, customer_name text not null, customer_email text not null, customer_document_hash text, amount_cents integer not null check (amount_cents >= 100), platform_fee_cents integer not null default 50 check (platform_fee_cents >= 0), status public.order_status not null default 'pending', gateway_name text not null default 'nomapay', gateway_transaction_id text unique, pix_code text, paid_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now());
create table public.payout_requests (id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.profiles(id) on delete restrict, amount_cents integer not null check (amount_cents >= 100), status text not null default 'pending' check(status in ('pending','approved','rejected','paid')), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now());
create table public.audit_logs (id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, target_type text not null, target_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.payout_requests enable row level security;
alter table public.audit_logs enable row level security;
create policy "profile owner reads own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profile owner updates own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "seller reads own products" on public.products for select to authenticated using (auth.uid() = seller_id);
create policy "seller creates own products" on public.products for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller updates own products" on public.products for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "seller deletes own draft products" on public.products for delete to authenticated using (auth.uid() = seller_id and status = 'draft');
create policy "public can view active products" on public.products for select to anon using (status = 'active');
create policy "seller reads own orders" on public.orders for select to authenticated using (auth.uid() = seller_id);
create policy "seller reads own payout requests" on public.payout_requests for select to authenticated using (auth.uid() = seller_id);
-- Orders, payouts, KYC approval, webhook processing and audit logs must be written only by trusted server-side code.
-- Before production: encrypt CPF and Pix keys with a vetted KMS, add audit-log policies, and restrict sensitive fields with server-side access controls. Never expose service-role keys in the browser.
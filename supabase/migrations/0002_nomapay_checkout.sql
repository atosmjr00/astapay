-- NOMAPAY checkout hardening. Apply after 0001_initial.sql.
alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists pix_qr_code_url text;
create unique index if not exists orders_idempotency_key_unique
  on public.orders (idempotency_key) where idempotency_key is not null;

create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  delivery_id text not null unique,
  event_name text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
alter table public.webhook_events enable row level security;
-- No client-facing policies: only trusted server-side code using service-role access can process events.

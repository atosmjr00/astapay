-- Create a seller profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Idempotency keys must be scoped to an individual seller; the partial unique index
-- from migration 0002 is replaced with a seller-scoped key.
drop index if exists public.orders_idempotency_key_unique;
create unique index if not exists orders_seller_idempotency_unique
  on public.orders (seller_id, idempotency_key)
  where idempotency_key is not null;

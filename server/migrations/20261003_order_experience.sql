-- Run in Supabase SQL Editor BEFORE deploying the new backend and frontend.
begin;
alter table public.orders add column if not exists public_reference text;
alter table public.orders add column if not exists details jsonb not null default '{}'::jsonb;
update public.orders set public_reference = 'PW-' || upper(replace(gen_random_uuid()::text, '-', '')) where public_reference is null;
alter table public.orders alter column public_reference set default ('PW-' || upper(replace(gen_random_uuid()::text, '-', '')));
alter table public.orders alter column public_reference set not null;
create unique index if not exists orders_public_reference_unique on public.orders(public_reference);
create table if not exists public.payment_sessions (
  razorpay_order_id text primary key,
  user_id uuid not null,
  amount bigint not null check (amount > 0),
  details jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.payment_sessions enable row level security;
revoke all on public.payment_sessions from anon, authenticated;
grant all on public.payment_sessions to service_role;
create unique index if not exists orders_payment_unique on public.orders ((details->>'razorpay_order_id')) where details ? 'razorpay_order_id';

-- Atomic, idempotent confirmation: items and order commit together.
create or replace function public.confirm_paid_order(p_user uuid, p_order text, p_payment jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  checkout public.payment_sessions%rowtype;
  placed public.orders%rowtype;
  line jsonb;
begin
  select * into checkout from public.payment_sessions where razorpay_order_id = p_order and user_id = p_user for update;
  if not found then raise exception 'Checkout not found'; end if;
  select * into placed from public.orders where details->>'razorpay_order_id' = p_order and user_id = p_user;
  if found then return jsonb_build_object('success', true, 'reference', placed.public_reference, 'total', placed.total_amount); end if;
  insert into public.orders(user_id, total_amount, status, details)
  values(p_user, checkout.amount::numeric / 100, 'Confirmed',
    checkout.details || jsonb_build_object('razorpay_order_id', p_order, 'payment', p_payment,
      'tracking', jsonb_build_array(jsonb_build_object('status', 'Confirmed', 'at', now(), 'note', 'Payment verified. Your order is with our team.'))))
  returning * into placed;
  for line in select * from jsonb_array_elements(checkout.details->'items') loop
    insert into public.order_items(order_id, product_id, quantity, price)
    values(placed.id, (line->>'id')::bigint, (line->>'qty')::integer, (line->>'price')::numeric);
  end loop;
  return jsonb_build_object('success', true, 'reference', placed.public_reference, 'total', placed.total_amount);
end;
$$;
revoke all on function public.confirm_paid_order(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_paid_order(uuid, text, jsonb) to service_role;

-- Operational updates run by staff in SQL Editor; never exposed to shoppers.
create or replace function public.record_order_shipment(p_reference text, p_status text, p_note text, p_shipment jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare placed public.orders%rowtype;
begin
  if p_status not in ('Confirmed','Packed','Shipped','Out for delivery','Delivered','Cancelled') then raise exception 'Invalid shipment status'; end if;
  select * into placed from public.orders where public_reference = p_reference for update;
  if not found then raise exception 'Order not found'; end if;
  update public.orders set status = p_status,
    details = details || jsonb_build_object('tracking', coalesce(details->'tracking', '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('status', p_status, 'at', now(), 'note', p_note))) ||
      case when p_shipment is null then '{}'::jsonb else jsonb_build_object('shipment', p_shipment) end
    where id = placed.id;
end;
$$;
revoke all on function public.record_order_shipment(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_order_shipment(text,text,text,jsonb) to service_role;
commit;

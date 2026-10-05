begin;
create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_activity (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  product_id bigint,
  summary text not null,
  created_at timestamptz not null default now()
);
alter table public.store_admins enable row level security;
alter table public.admin_activity enable row level security;
revoke all on public.store_admins, public.admin_activity from anon, authenticated;
grant all on public.store_admins, public.admin_activity to service_role;
grant usage, select on sequence public.admin_activity_id_seq to service_role;
alter table public.products add column if not exists admin_revision integer not null default 0;
-- Catalog changes go through the protected backend, never a shopper's Supabase session.
revoke insert, update, delete on public.products from anon, authenticated;

-- Product edits and their audit records commit together. No destructive deletion.
create or replace function public.admin_save_product(p_actor uuid, p_id bigint, p_revision integer, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare saved public.products%rowtype; editable_columns text; values_columns text; product_data jsonb;
begin
  if not exists(select 1 from public.store_admins where user_id = p_actor) then raise exception 'Admin access required'; end if;
  if length(trim(p_data->>'product_name')) < 2 or length(trim(p_data->>'sku')) < 2
    or (p_data->>'selling_price')::numeric < 0 or (p_data->>'mrp')::numeric < (p_data->>'selling_price')::numeric
    or (p_data->>'stock')::integer < 0 then raise exception 'Invalid product'; end if;
  perform pg_advisory_xact_lock(hashtextextended('product-sku:' || lower(p_data->>'sku'),0));
  if exists(select 1 from public.products where lower(sku)=lower(p_data->>'sku') and (p_id is null or id<>p_id))
    then raise exception 'SKU already exists' using errcode='23505'; end if;
  product_data = p_data || jsonb_build_object('image_url',nullif(p_data->>'image_url',''),
    'discount_amount',(p_data->>'mrp')::numeric-(p_data->>'selling_price')::numeric);
  -- Support catalogs whose selling_price/discount_amount are generated columns.
  -- Only known editable fields are accepted; database-computed columns stay computed.
  select string_agg(format('%I',column_name),',' order by ordinal_position),
    string_agg(format('v.%I',column_name),',' order by ordinal_position)
    into editable_columns,values_columns from information_schema.columns
    where table_schema='public' and table_name='products' and is_generated='NEVER'
      and column_name in ('sku','product_name','description','mrp','selling_price','discount_amount','stock','image_url','is_active');
  if p_id is null then
    execute format('insert into public.products(%s) select %s from jsonb_populate_record(null::public.products,$1) v returning *',
      editable_columns,values_columns) into saved using product_data;
  else
    execute format('update public.products set (%s)=(select %s from jsonb_populate_record(null::public.products,$1) v),
      admin_revision=admin_revision+1 where id=$2 and admin_revision=$3 returning *',editable_columns,values_columns)
      into saved using product_data,p_id,p_revision;
    if saved.id is null then raise exception 'Product changed. Reload before editing.'; end if;
  end if;
  if saved.selling_price <> (p_data->>'selling_price')::numeric then raise exception 'Catalog price calculation does not match the requested selling price'; end if;
  insert into public.admin_activity(actor_id,action,product_id,summary)
    values(p_actor,case when p_id is null then 'product_created' else 'product_updated' end,saved.id,
      saved.product_name || case when saved.is_active then ' (active)' else ' (archived)' end);
  return to_jsonb(saved);
end;
$$;
revoke all on function public.admin_save_product(uuid,bigint,integer,jsonb) from public,anon,authenticated;
grant execute on function public.admin_save_product(uuid,bigint,integer,jsonb) to service_role;

create or replace function public.admin_store_metrics()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'orders',count(*),
    'paid_orders',count(*) filter(where details->'payment'->>'status'='Paid'),
    'live_sales',coalesce(sum(total_amount) filter(where details->'payment'->>'status'='Paid' and coalesce(details->>'test_mode','false') <> 'true'),0),
    'test_orders',count(*) filter(where details->>'test_mode'='true'),
    'awaiting_shipment',count(*) filter(where details->'payment'->>'status'='Paid' and status in ('Confirmed','Packed') and details->'shipment'->>'tracking_number' is null),
    'delivered',count(*) filter(where status='Delivered'),
    'shipments',count(*) filter(where details->'shipment'->>'tracking_number' is not null),
    'in_transit',count(*) filter(where status in ('Shipped','Out for delivery')),
    'low_stock',(select count(*) from public.products where is_active=true and stock <= 5),
    'customers',(select count(*) from auth.users)
  ) from public.orders;
$$;
revoke all on function public.admin_store_metrics() from public,anon,authenticated;
grant execute on function public.admin_store_metrics() to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
commit;

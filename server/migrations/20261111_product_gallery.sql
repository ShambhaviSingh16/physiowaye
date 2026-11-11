begin;

alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- The first gallery image is also the existing cover image, so older pages keep working.
create or replace function public.admin_save_product(p_actor uuid, p_id bigint, p_revision integer, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  saved public.products%rowtype;
  editable_columns text;
  values_columns text;
  product_data jsonb;
  gallery jsonb;
begin
  if not exists(select 1 from public.store_admins where user_id = p_actor) then raise exception 'Admin access required'; end if;
  if length(trim(p_data->>'product_name')) < 2 or length(trim(p_data->>'sku')) < 2
    or (p_data->>'selling_price')::numeric < 0 or (p_data->>'mrp')::numeric < (p_data->>'selling_price')::numeric
    or (p_data->>'stock')::integer < 0 then raise exception 'Invalid product'; end if;

  gallery = coalesce(p_data->'image_urls',
    case when nullif(p_data->>'image_url','') is null then '[]'::jsonb
      else jsonb_build_array(p_data->>'image_url') end);
  if jsonb_typeof(gallery) <> 'array' then raise exception 'Invalid product images'; end if;
  if jsonb_array_length(gallery) > 6
    or exists(select 1 from jsonb_array_elements_text(gallery) as item(url)
      where url is null or url !~ '^https://[^[:space:]]+$') then raise exception 'Invalid product images'; end if;

  perform pg_advisory_xact_lock(hashtextextended('product-sku:' || lower(p_data->>'sku'),0));
  if exists(select 1 from public.products where lower(sku)=lower(p_data->>'sku') and (p_id is null or id<>p_id))
    then raise exception 'SKU already exists' using errcode='23505'; end if;
  product_data = p_data || jsonb_build_object('image_urls',gallery,'image_url',gallery->>0,
    'discount_amount',(p_data->>'mrp')::numeric-(p_data->>'selling_price')::numeric);
  select string_agg(format('%I',column_name),',' order by ordinal_position),
    string_agg(format('v.%I',column_name),',' order by ordinal_position)
    into editable_columns,values_columns from information_schema.columns
    where table_schema='public' and table_name='products' and is_generated='NEVER'
      and column_name in ('sku','product_name','description','mrp','selling_price','discount_amount','stock','image_url','image_urls','is_active');
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

commit;

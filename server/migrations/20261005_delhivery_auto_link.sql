begin;
-- Server-side discovery may link an AWB only from an exact Delhivery ReferenceNo match.
create or replace function public.sync_delhivery_tracking(p_reference text, p_awb text, p_shipment jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare placed public.orders%rowtype;
begin
  if p_awb !~ '^[0-9]{10,20}$' or p_shipment->>'tracking_number' is distinct from p_awb
    or p_shipment->>'carrier' is distinct from 'Delhivery' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('delhivery:' || p_awb, 0));
  select * into placed from public.orders where public_reference = p_reference for update;
  if not found then return false; end if;
  if placed.details->'shipment'->>'tracking_number' is null then
    if p_shipment->>'reference' is distinct from p_reference then return false; end if;
    if coalesce(placed.details->'shipment'->>'carrier', '') not in ('', 'Delhivery') then return false; end if;
  elsif lower(coalesce(placed.details->'shipment'->>'carrier', '')) <> 'delhivery'
    or placed.details->'shipment'->>'tracking_number' is distinct from p_awb then return false;
  end if;
  if exists (select 1 from public.orders where id <> placed.id
    and lower(details->'shipment'->>'carrier') = 'delhivery'
    and details->'shipment'->>'tracking_number' = p_awb) then return false; end if;
  if placed.details->'shipment'->>'status_at' is not null and p_shipment->>'status_at' is not null
    and (placed.details->'shipment'->>'status_at')::timestamptz > (p_shipment->>'status_at')::timestamptz
    then return false; end if;
  update public.orders set
    status = case when status in ('Cancelled', 'Refunded') then status
      when p_shipment->>'fulfillment_status' in ('Packed', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled')
        then p_shipment->>'fulfillment_status' else status end,
    details = jsonb_set(coalesce(details, '{}'::jsonb), '{shipment}',
      coalesce(details->'shipment', '{}'::jsonb) || p_shipment)
    where id = placed.id;
  return true;
end;
$$;
revoke all on function public.sync_delhivery_tracking(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.sync_delhivery_tracking(text,text,jsonb) to service_role;
commit;

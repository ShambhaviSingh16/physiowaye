const { getTracking } = require('./delhivery');
async function syncOrderTracking(supabase, order) {
  const shipment = order.details?.shipment || {};
  // A saved shipment with another carrier must never be replaced by discovery.
  if (shipment.carrier && String(shipment.carrier).toLowerCase() !== 'delhivery') return false;
  const awb = shipment.tracking_number ? String(shipment.tracking_number) : null;
  const tracking = await getTracking(awb, awb ? null : order.public_reference);
  if (!tracking) return false;
  const { data, error } = await supabase.rpc('sync_delhivery_tracking', {
    p_reference: order.public_reference, p_awb: tracking.tracking_number, p_shipment: tracking
  });
  if (error) throw error;
  if (!data) throw new Error('Shipment changed during sync');
  return true;
}
module.exports = { syncOrderTracking };

// B2C tracking only. No shipment creation, pickup booking or customer data is sent.
const cache = new Map();
function timestamp(value) {
  if (!value) return null;
  const text = String(value).replace(' ', 'T');
  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function stage(status, type) {
  const text = String(status || '').toLowerCase();
  if (type === 'RT' || /rto|return|dto/.test(text)) return null;
  if (text === 'delivered') return 'Delivered';
  if (/cancel/.test(text)) return 'Cancelled';
  if (/out for delivery|dispatched/.test(text)) return 'Out for delivery';
  if (/in transit|pending|picked up/.test(text)) return 'Shipped';
  if (/manifest|ready to ship|ready for pickup/.test(text)) return 'Packed';
  return null;
}
async function fetchTracking(awb) {
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) throw new Error('Tracking is not configured');
  const environment = process.env.DELHIVERY_ENV || 'production';
  if (!['production', 'staging'].includes(environment)) throw new Error('Invalid tracking environment');
  const host = environment === 'staging' ? 'staging-express.delhivery.com' : 'track.delhivery.com';
  const response = await fetch(`https://${host}/api/v1/packages/json/?waybill=${encodeURIComponent(awb)}`, {
    headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Courier tracking unavailable');
  const payload = await response.json();
  const shipment = payload.ShipmentData?.map(item => item.Shipment).find(item => String(item?.AWB) === awb);
  if (!shipment?.Status?.Status) throw new Error('Shipment not found');
  const current = shipment.Status;
  const events = (Array.isArray(shipment.Scans) ? shipment.Scans : []).map(item => item.ScanDetail).filter(Boolean)
    .map(scan => ({ status: String(scan.Scan || 'Shipment update'), at: timestamp(scan.ScanDateTime),
      note: String(scan.Instructions || ''), location: String(scan.ScannedLocation || '') }))
    .filter(event => event.at).sort((a, b) => a.at.localeCompare(b.at));
  const statusAt = timestamp(current.StatusDateTime);
  if (statusAt && !events.some(event => event.at === statusAt && event.status === current.Status)) {
    events.push({ status: String(current.Status), at: statusAt, note: String(current.Instructions || ''), location: String(current.StatusLocation || '') });
    events.sort((a, b) => a.at.localeCompare(b.at));
  }
  return { carrier: 'Delhivery', tracking_number: awb, status: String(current.Status),
    status_type: String(current.StatusType || ''), status_at: statusAt,
    location: String(current.StatusLocation || ''), events: events.slice(-100),
    fulfillment_status: stage(current.Status, current.StatusType),
    synced_at: new Date().toISOString(), source: 'delhivery' };
}
async function getTracking(awb) {
  if (!/^\d{10,20}$/.test(awb)) throw new Error('Invalid AWB');
  const key = `${process.env.DELHIVERY_ENV || 'production'}:${awb}`;
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.promise;
  if (cache.size >= 1000) cache.delete(cache.keys().next().value);
  const entry = { expires: Date.now() + 60000, promise: null };
  entry.promise = fetchTracking(awb).catch(error => { entry.expires = Date.now() + 15000; throw error; });
  cache.set(key, entry);
  return entry.promise;
}
module.exports = { getTracking };

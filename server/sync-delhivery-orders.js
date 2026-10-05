// Run as a Render Cron Job to refresh orders even when nobody visits the site.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { syncOrderTracking } = require('./delhivery-sync');
async function main() {
  if (!process.env.DELHIVERY_API_TOKEN) throw new Error('DELHIVERY_API_TOKEN is required');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let lastId = null, updated = 0, failed = 0, checked = 0;
  while (true) {
    let query = supabase.from('orders').select('id, public_reference, details, status')
      .not('status', 'in', '(Delivered,Cancelled,Refunded)').order('id').limit(100);
    if (lastId !== null) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw new Error('Could not read orders');
    if (!data.length) break;
    // A stable ID cursor cannot skip orders when their statuses change during sync.
    lastId = data[data.length - 1].id;
    for (const order of data) {
      checked++;
      try { if (await syncOrderTracking(supabase, order)) updated++; }
      catch (_) { failed++; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log('Delhivery sync completed', { checked, updated, failed });
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Delhivery sync could not complete. Check database setup and environment variables.'); process.exitCode = 1; });

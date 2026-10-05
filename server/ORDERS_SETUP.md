# Deploy the order experience

## Order detail navigation

`orders.html` displays compact order cards with search and status filters.
Each card and its View order details link open `order.html?order=PUBLIC_REFERENCE`.
Track order opens that URL with `#tracking`. The success receipt opens the new
order directly. The detail endpoint checks the signed-in owner before returning
one order. Filters are preserved for the browser tab when returning to history.
Deploy the frontend and updated backend together; this navigation update needs no
additional database migration. B2C Delhivery shipments are discovered by exact website order reference and refreshed automatically.

## 1. Supabase migration (required first)

Run `server/migrations/20261003_order_experience.sql` in Supabase SQL Editor.
It adds random public references to existing orders, saved order details,
private checkout snapshots, atomic confirmation and a staff shipment update function.
The existing orders and items are retained. The schema must have numeric product IDs,
UUID user IDs, and a text `orders.status` that allows the new shipment statuses.
If your database has a status enum/check restricting values, extend it to include
Confirmed, Packed, Shipped, Out for delivery, Delivered and Cancelled before deploying.

Then deploy the backend on Render and the frontend together. Older cached checkout
scripts cannot confirm orders with the new verified endpoint; refresh checkout.

## 2. Razorpay recovery webhook

Add `RAZORPAY_WEBHOOK_SECRET` to Render Environment with a secret you choose.
In Razorpay's Webhooks settings for the same Test/Live mode as the API key, add:

`https://physiowaye.onrender.com/api/razorpay-webhook`

Use the same webhook secret and subscribe to `payment.captured`.
Redeploy Render. This allows the backend to create a confirmed order even if the
customer closes the browser after payment. Repeated callbacks/webhooks return the
existing order rather than inserting duplicates. The browser confirmation also
checks the checkout signature, owner, provider amount, currency and captured status.
See [Razorpay verification guidance](https://github.com/razorpay/razorpay-node/blob/master/documents/paymentVerfication.md)
and [webhook validation](https://github.com/razorpay/markdown-docs/blob/master/webhooks/validate-test.md).

## 3. Update shipment tracking

Until a courier integration/admin portal is added, staff update actual dispatch
events in Supabase SQL Editor. Use the customer's public reference:

```sql
select public.record_order_shipment(
  'PW-REPLACE_WITH_ACTUAL_REFERENCE', 'Packed',
  'Your equipment has been checked and packed.'
);

select public.record_order_shipment(
  'PW-REPLACE_WITH_ACTUAL_REFERENCE', 'Shipped',
  'Handed to the courier.',
  '{"carrier":"Actual courier","tracking_number":"Actual shipment number","tracking_url":"https://actual-courier.example/track"}'::jsonb
);
```

Allowed stages: Confirmed, Packed, Shipped, Out for delivery, Delivered, Cancelled.
Each call appends a dated event. Courier links must use HTTPS to be displayed.
These manual examples are optional for other couriers or legacy shipments. New Delhivery shipments use the automatic setup below.
Shipment status is independent of payment status: a paid order can be Confirmed
while it is being prepared. Never move an order to Delivered merely because it is paid.

## 4. Earlier orders, including database order 15

Existing orders have no payment reference or delivery snapshot. The migration
does not assume they were paid. Their product rows still appear, with explicit
messages for missing payment/address information.

To reconcile a known captured payment, use the real Payment ID from Razorpay.
From the `server` folder, with the matching Razorpay keys and Supabase service role
in local `.env`, run:

```powershell
node reconcile-order.js 15 pay_REPLACE_WITH_ACTUAL_PAYMENT_ID
```

Check the preview's customer, amount and payment details against that order.
Then repeat with `--apply`. It verifies the captured amount/currency and prevents
reusing an already linked payment. It changes Pending to Confirmed and records Paid.
Do not commit `.env` or share secrets. Historical delivery details cannot be recovered
from the old order record.

## Release checks to perform after deployment

This change has not been exercised against the live database or real checkout.
Place a new Test Mode order; open its details and tracking, check the address,
product quantities, prices, masked payment method, public reference and Paid badge.
Use keyboard navigation and narrow mobile widths. Record a Packed update in SQL
Editor and refresh the order. Configure the webhook and check its delivery logs.

Stock is checked before payment; this release does not reserve stock or connect to
an inventory/courier service. Staff fulfilment and refund handling remain operational
workflows. Configure these before scaling real payment volumes.


## 5. Automatic Delhivery B2C tracking

### Activate automatic discovery

1. Run `server/migrations/20261005_delhivery_auto_link.sql` in Supabase SQL Editor.
   It replaces the previous sync function and can run whether or not the earlier
   `20261005_delhivery_tracking.sql` was run. The original order-experience migration
   must already be installed. This update retains existing order data.
2. Keep `DELHIVERY_API_TOKEN` in Render Environment. Production is the default.
   Use `DELHIVERY_ENV=staging` only with a Delhivery staging account and token.
   Razorpay Test Mode does not switch the courier environment.
3. Deploy the updated frontend and backend together.
4. When creating a shipment in Delhivery One, use the website's full `PW-...`
   reference as its **Order ID / reference**. Copy it exactly, including case.
   The numeric AWB is assigned by Delhivery; it is distinct from the Order ID.

No AWB assignment or status entry in Supabase is needed for these new shipments.
The backend queries Delhivery by `ref_ids`, accepts only one exact `ReferenceNo`
match, retrieves its AWB, and saves the shipment and scan history automatically.
If no shipment exists yet, the page shows that tracking is awaiting shipment.
The website does not guess matches using a name, address, email or phone number.

Existing shipments whose Delhivery Order ID is a name, phone number, or another
reference cannot be discovered automatically. They need a one-time correct AWB
link using the staff SQL example in section 3; subsequent updates are automatic.
Do not link historical dashboard shipments to unrelated new website orders.

### Update even while nobody is viewing the website

Create a **Render Cron Job** using this repository:

- Root directory: `server`
- Build command: `npm ci`
- Command: `node sync-delhivery-orders.js`
- Schedule: `*/15 * * * *` (every 15 minutes; cron scheduling is UTC)
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `DELHIVERY_API_TOKEN`, and `DELHIVERY_ENV` only if staging is needed.
  Copy the existing server values privately. Never put them in frontend files.

Confirm the Supabase service-role variable name matches `server/supabase.js`.
The cron job scans nonterminal orders, discovers shipments, and saves their latest
status and history. Calls are spaced one second apart to limit provider traffic.
Jobs log aggregate counts only; individual customer data and tokens are not logged
by the tracking job. Render Cron Jobs may incur hosting charges according to your plan.
The job must be configured in Render; deploying the files alone does not schedule it.

### Customer experience and boundaries

The order detail page first shows saved data, then checks Delhivery automatically.
It checks again every minute while the tab is visible. The provider response is
cached for 60 seconds per shipment/reference per server process. Tracking history
includes scan times (India time converted to an absolute timestamp), locations,
remarks, current courier status, AWB and last checked time.
Forward milestones update Packed, Shipped, Out for delivery and Delivered, while
payment details stay unchanged. Returns/RTO are shown explicitly rather than
marking a parcel delivered to the buyer. If the courier is unavailable, saved data
remains visible with a notice and later checks retry automatically.

All shopper reads are owner-checked. Discovery and database syncing happen only
on the server using the private token. Customer requests cannot supply AWBs.
The sync function uses locking, checks reference/AWB ownership and rejects older
snapshots or a conflicting AWB assigned to another website order.

Shipment creation and pickup booking still happen in Delhivery One. This integration
retrieves tracking; it does not purchase shipping, book pickups or send notifications.
Packing updates appear only when Delhivery publishes a relevant status; internal
warehouse packing work is not inferred. One forward AWB per website order is supported.
Split shipments and separate reverse-pickup AWBs need a separate extension.

The live account has not been tested from this workspace. After deployment, compare
one genuine order's matching shipment with Delhivery One. An AWB from another account,
an unmanifested shipment, or mismatched staging/live credentials cannot be tracked.

Official references:
- [B2C Shipment Tracking API and ref_ids lookup](https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking)
- [Delhivery FAQ and scan statuses](https://one.delhivery.com/developer-portal/document/b2c/detail/faq)

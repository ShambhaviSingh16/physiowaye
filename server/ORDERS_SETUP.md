# Deploy the order experience

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
This is staff-maintained tracking; there is no automatic courier connection yet.
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

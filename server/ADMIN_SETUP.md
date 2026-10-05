# PhysioWaye owner dashboard

## 1. Apply the migration

Run all of `server/migrations/20261006_admin_dashboard.sql` in Supabase SQL Editor.
It creates the private admin allowlist, activity records, product revision field,
atomic product-edit function, aggregate metrics and public product image bucket.
Existing product/order records remain. Direct product INSERT/UPDATE/DELETE access
is revoked from shopper roles; catalog reads and service-role operations remain.

This uses the existing numeric `products.id` and the columns `sku`, `product_name`,
`description`, `mrp`, `selling_price`, `stock`, `image_url`, `is_active`. If your
live schema has additional required columns without defaults, tell your developer
before applying this migration. The save function skips generated price columns
and supplies a discount amount where that writable column exists. It rejects a
save if the database's calculated selling price differs from the requested price.
The store derives percentage discounts from MRP and selling price.

## 2. Grant the owner access (developer only)

The owner first creates an ordinary account using the existing Register page.
Use their own email and a private password; do not share a developer account.
After the account exists, run this once in Supabase, replacing the example email:

```sql
insert into public.store_admins(user_id)
select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict(user_id) do nothing;

select a.user_id, u.email
from public.store_admins a join auth.users u on u.id = a.user_id;
```

Check that the owner appears in the results. A missing email matches zero rows
and grants nobody access. Customer registration does not grant admin privileges.
Roles are never taken from editable user metadata. There is no shopper endpoint
for granting privileges or editing the allowlist.

To revoke a specific account's access later:

```sql
delete from public.store_admins
where user_id = (select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE'));
```

## 3. Deploy

Deploy the frontend and backend changes together. The backend already uses
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep these and all courier/payment
tokens in Render only. No new admin password or shared admin secret is needed.
The owner opens `https://www.physiowaye.com/admin.html` and bookmarks it.
The separate dashboard sign-in accepts the authorised email/password account.
Its session is shared with the existing customer site in that browser.

Every `/api/admin` request verifies the Supabase session and private allowlist
before reading data or changing products. Without access it returns 401/403;
an unavailable role table fails closed. Dashboard HTML is public, its data is not.

## 4. Owner's daily workflow

1. Open **Orders & shipments**. Search a reference or filter by order status.
2. Open a paid order and check products, quantities, customer contact details
   and complete delivery address. Test orders are labelled; they are not real sales.
3. Click **Copy order reference**.
4. Create the shipment in Delhivery One using that exact `PW-...` value as Order ID.
5. Delhivery tracking updates automatically through the existing integration.
   **Check Delhivery updates** also fetches its current snapshot from the dashboard.
   Keep the previously configured Cron Job for unattended updates.

The dashboard does not create shipments, book pickups or alter payment status.
Payment method and masked card data are shown only when actually saved by Razorpay.
Do not ship an unverified or test order as though it were a captured live payment.

## 5. Products

Add/edit SKU, product name, description, MRP, selling price, stock and image.
Uploads accept JPEG/PNG/WebP up to 5 MB with file-signature checks; SVG is excluded.
Public product images live in the `product-images` Supabase Storage bucket.
Upload permission is enforced by the admin backend, not public bucket policies.
An upload is made public immediately; only upload product imagery, not private
documents. Save the form to associate the uploaded URL with a product.

To remove a product from sale, uncheck **Available in the store** and save.
Archiving preserves existing order records and can be reversed. There is no
destructive product deletion button. Concurrent edits detected by the product
revision number are rejected; reload and reapply the intended change.

Saving a product and recording its activity commit in one database transaction.
Activity history records the admin account ID, action, product and time.
Cancelled edits can leave unused uploaded images; there is no automated asset
cleanup in this initial version. Only the primary product image is editable.

## 6. Customers and analytics

Customers show provided names/emails/phone numbers, sign-in providers, creation
and last-sign-in times. A full historical login log is not available.
Open a customer to view their orders; addresses and delivery phone numbers are
snapshots of each order, not an inferred permanent customer address.
Older orders can have missing address/payment/product snapshots and are labelled.

Lists are paginated in batches of 25. Live paid sales exclude test orders; the
metric is captured order value, not profit or refund-adjusted revenue. Other counts
include test orders as identified separately by the test-order count.
Analytics show orders, customers, paid orders, linked shipments, transit/delivered
orders, orders awaiting shipment and low stock (five units or fewer).

## Activation review

No tests were run during implementation. Before handing the dashboard to the owner,
verify authorised and unauthorised access, product create/edit/archive, image upload,
order/customer details, copying references, pricing validation and a linked courier
shipment on the deployed environment. Production changes and live account access
have not been performed from this workspace.

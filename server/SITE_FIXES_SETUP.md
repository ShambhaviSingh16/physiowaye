# Website fixes: release steps

These changes are prepared locally. They do not update the live website until the database, backend and frontend are deployed.

1. In the production Supabase SQL Editor, run the complete contents of
   `server/migrations/20261111_contact_messages.sql`. This creates a private table
   for contact form submissions. The public browser has no direct table access.
2. Deploy the updated `server` application to Render. Its existing Supabase
   service role configuration must remain available. The contact endpoint is
   `POST /api/contact`; only allowlisted store admins can read messages through
   `GET /api/admin/messages`.
3. Deploy the updated `client` to the existing frontend host. Keep
   `client/vercel.json` in the frontend root so the added response headers apply.
4. Sign in to `admin.html` and use **Messages** to read contact submissions.
   New messages are saved in the dashboard; this change does not send email
   notifications. The owner should check the inbox regularly and reply from
   their normal email account.

The guest cart is stored in the shopper's browser and is moved to their
account after sign-in. Checkout still requires an account. Product availability
and quantity are checked again by the backend.

The new privacy, shipping and purchase pages deliberately avoid specific
shipping times, return windows, refund deadlines and warranty promises. The
owner must supply and approve those commercial terms before publishing any
specific commitment. Checkout currently records delivery as ₹0; confirm with
the owner whether that is the intended charge before changing payment totals.

Product detail titles and structured data are currently inserted by browser
JavaScript. Some crawlers may not execute it. Full product search preview
support needs server-rendered or pre-rendered product pages in a later change.

PW-001 and PW-0011 images have been left unchanged as requested.

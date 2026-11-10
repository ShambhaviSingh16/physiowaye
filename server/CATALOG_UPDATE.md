# Existing catalog wording update

## Status: ready to apply

On 11 November 2026 the public API returned HTTP 200 with exactly eleven active products. All eleven existing SKUs match the spreadsheet codes, but two product identities do not match:

| SKU | Current live product | Enhanced spreadsheet product |
| --- | --- | --- |
| PW-001 | Mini Muscle Stimulator | Dual Channel TENS Machine |
| PW-0011 | Portable Physiotherapy Massage Table | 2 Fold Traction Bed |

The owner confirmed that PW-001 and PW-0011 should receive the new TENS-machine and traction-bed wording now, while their prices, stock and availability remain as they are. In the subsequent photo request, the owner asked to use the photos from each designated Drive folder for all eleven products, including these two. The designated [PW-001 folder](https://drive.google.com/drive/folders/1Cu36eRVdZw8ZlYpWZYp6uxUNI1bf_Moy) still shows a unit labeled "MINI MUSCLE STIMULATOR" and the [PW-0011 folder](https://drive.google.com/drive/folders/1kWD51BSe37SuHFyTw4ZrVEaSNz2yTyKn) still shows a "Portable Massage Table". Their new listing titles will therefore still differ from the supplied photos until the client supplies replacement images.

The checkout flow stores each new order's item name, description and price in `orders.details.items`, so existing orders with that snapshot retain their original wording. Older orders without an item snapshot fall back to the current product row in `server/server.js` and may display the new wording for old purchases. This migration changes no order records.

The remaining nine SKU/product types appear consistent by title. No live database edits were performed during this check.

Source: `Physiowaye_Product_Catalogue_Enhanced_Titles.xlsx` supplied by the client.
Target: the eleven existing SKUs PW-001 through PW-009, PW-0010 and PW-0011.
The six additional products are not inserted or published.

## Apply

Deploy the pending frontend changes first so the new titles have room on the product cards. Then run all of `migrations/20261111_existing_product_copy.sql` in Supabase SQL Editor after the existing admin migration. The script is one transaction; paste the whole file and run it once. If it reports an error, the transaction rolls back and no product wording changes.
It requires exactly one existing row per SKU, preserves the original wording in a private backup table, and updates only product_name, description and the admin edit revision.
The SQL changes no MRP, discount, selling price, stock, `image_url`, active status, ID or order record. The frontend deployment replaces the local SKU images with the client's Drive photos.
An open admin editor must reload the product after this change to avoid overwriting it with an older revision.
After the SQL succeeds, run this read-only check in a new SQL Editor query and confirm it returns eleven rows:

```sql
select sku, product_name, length(description) as description_characters,
       mrp, discount_amount, selling_price, stock, is_active
from public.products
where sku in ('PW-001','PW-002','PW-003','PW-004','PW-005','PW-006',
              'PW-007','PW-008','PW-009','PW-0010','PW-0011')
order by id;
```

Refresh the products page and open PW-001 and PW-0011 to see their new wording. Catalog and home cards display complete titles rather than forcing a two-line truncation. Full descriptions remain on the product detail page.

## Source matching

The public live API initially returned HTTP 500 while Supabase was paused. After the project resumed, it returned HTTP 200 and all eleven active rows; these were used for the SKU and title cross-check. The migration backs up the actual database wording when run.
New wording is copied as provided by the client, including the PW-0011 traction-bed title and PW-001 TENS title; no medical claims were independently validated.
## Client photos

The photo source is the client's [Drive product folder](https://drive.google.com/drive/folders/1Z8qbjqtTKf2sUmuGqUb5eOzEufPVuv74). All 54 images in the eleven existing SKU folders were downloaded and converted to JPEG for the website. Each folder maps only to its matching SKU. The first selected image becomes `client/assets/images/products/<sku>.jpg` for product cards, home, cart, orders, checkout and admin. The remaining images become `<sku>-2.jpg`, `<sku>-3.jpg`, and so on for the product detail gallery. PW-007's unnumbered clean product photo was selected as its main image; its numbered promotional images follow in the gallery. The old illustrative `-views.jpg` assets are retained in the repository but are no longer shown for these eleven SKUs.

| SKU | Gallery photos |
| --- | ---: |
| PW-001 | 5 |
| PW-002 | 6 |
| PW-003 | 4 |
| PW-004 | 5 |
| PW-005 | 4 |
| PW-006 | 6 |
| PW-007 | 5 |
| PW-008 | 5 |
| PW-009 | 5 |
| PW-0010 | 5 |
| PW-0011 | 4 |

No new products are added from the six additional catalog entries. Product photos are served from the deployed client assets, so the image change does not require a Supabase SQL update.

| SKU | Previous title (local catalog) | New client title |
| --- | --- | --- |
| PW-001 | Mini Muscle Stimulator with Reusable Electrode Pads, Output Cables, Gel Bottle, Fixation Straps, 13cm x 13cm | Physiowaye Dual Channel TENS Machine for Pain Relief & Muscle Therapy |
| PW-002 | 5 LED Ultrasound Therapy Machine – 1 MHz Advanced Physiotherapy Device with Continuous & Pulse Mode, Digital Timer & Intensity Control (5 LED US – Super Pro 40) | Physiowaye Digital Ultrasound Therapy Machine with Probe & Pulse Modes |
| PW-003 | Shortwave Diathermy 500W (SWD 28N) Physiotherapy Machine – Deep Heat Therapy for Pain Relief, Muscle Spasm, Arthritis & Rehabilitation | Physiowaye SWD 28N 500W Shortwave Diathermy Physiotherapy Machine |
| PW-004 | Mini Interferential Therapy Machine, Dual Channel Compact Physiotherapy Equipment with Reusable Electrode Pads, Connection Cables, Conductive Gel Bottle and Elastic Fixation Belt | Physiowaye Mini IFT Machine with 2kHz/4kHz Interferential Therapy |
| PW-005 | Physiowaye Wax Bath Therapy Unit – Paraffin Wax Heater for Physiotherapy Pain Relief, Arthritis, Joint Stiffness & Hand/Foot Rehabilitation | Physiowaye Electric Paraffin Wax Bath with Temperature Control |
| PW-006 | Mini Ultrasonic Therapy Device, Portable Physiotherapy Machine for Deep Tissue Pain Relief with Adjustable Intensity, Pulse Mode, Ultrasonic Probe and Gel Bottle | Physiowaye Mini Ultrasonic Therapy Machine with Probe & Pulse Mode |
| PW-007 | Interferential Therapy TENS Combination for Muscle Stimulation, Dual Channel Physiotherapy Machine with 4 Electrode Pads, 4 Output Cables, Power Cord, 15x15 cm | Physiowaye IFT + TENS + PMS Combo Machine with Adjustable Controls |
| PW-008 | MS + TENS Combination Machine, Dual Channel Physiotherapy Equipment, Compact Electrotherapy Unit with Electrode Pads, Lead Wires, Conductive Gel and Elastic Strap | Physiowaye MS + TENS Combo Machine for Muscle Stimulation & Therapy |
| PW-009 | TENS Two Channel Machine, Dual Channel Portable Physiotherapy Equipment with Electrode Pads, Lead Wires, Conductive Gel and Elastic Strap | Physiowaye 2 Channel TENS Machine for Electrotherapy & Pain Management |
| PW-0010 | Professional 5-in-1 Digital Therapy System, Combination Treatment Device with IFT, TENS, EMS, Ultrasound, Heat Therapy, Microcontroller Based Control Unit, Complete Kit with Electrode Pads | Physiowaye 5 in 1 Combo Machine for Multi-Mode Physiotherapy |
| PW-0011 | Physiowaye Portable Physiotherapy Massage Table – Foldable Wooden Therapy Bed with Face Cradle, Adjustable Height & Carry Case for Clinic, Home & Spa Use | Physiowaye 2 Fold Traction Bed for Physiotherapy & Rehabilitation |

## Optional rollback

Run `migrations/20261111_existing_product_copy_rollback.sql` only to undo this wording update. It restores rows only when they still contain this migration's exact new wording; later owner edits are preserved.

No automated tests were run.

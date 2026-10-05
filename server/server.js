require("dotenv").config();

const supabase = require("./supabase");
const express = require("express");
// const mysql = require("mysql2");
const cors = require("cors");
const Razorpay = require("razorpay");
const requireAuth = require("./middleware/auth");
const crypto = require("crypto");
const { syncOrderTracking } = require('./delhivery-sync');


const app = express();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.use(cors());
// The signature is computed over the original bytes, before JSON parsing.
app.post('/api/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhook is not configured.' });
  try {
    const signature = req.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(req.body).digest('hex');
    if (!/^[a-f0-9]{64}$/i.test(signature) || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) return res.sendStatus(400);
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event !== 'payment.captured') return res.sendStatus(200);
    const entity = event.payload?.payment?.entity;
    const { data: checkout, error } = await supabase.from('payment_sessions').select('*').eq('razorpay_order_id', entity?.order_id || '').maybeSingle();
    if (error) throw error;
    // Payments from older integrations do not have a saved checkout snapshot.
    if (!checkout) return res.sendStatus(200);
    const payment = await razorpay.payments.fetch(entity.id);
    await confirmCapturedPayment(checkout, payment);
    res.sendStatus(200);
  } catch (error) {
    console.error('Payment webhook failed', { message: error.message });
    res.sendStatus(500); // Let Razorpay retry; SQL confirmation is idempotent.
  }
});
app.use(express.json());
app.use('/api/admin', require('./admin'));

async function confirmCapturedPayment(checkout, payment) {
  if (payment.order_id !== checkout.razorpay_order_id || Number(payment.amount) !== Number(checkout.amount) || payment.currency !== 'INR' || payment.status !== 'captured') throw new Error('Payment capture is not confirmed.');
  const { data, error } = await supabase.rpc('confirm_paid_order', {
    p_user: checkout.user_id, p_order: checkout.razorpay_order_id,
    p_payment: { id: payment.id, status: 'Paid', method: payment.method, bank: payment.bank || null, wallet: payment.wallet || null, card_last4: payment.card?.last4 || null, card_network: payment.card?.network || null, verified_at: new Date().toISOString() }
  });
  if (error) throw error;
  return data;
}

/* ---------- PRODUCTS ---------- */

app.get("/api/products", async (req, res) => {
  try {

    const search = req.query.search;

    let query = supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    if (search) {
      query = query.ilike("product_name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json(error);
    }

    res.json(data);

  } catch (err) {
    res.status(500).json(err);
  }
});

/* ---------- SINGLE PRODUCT ---------- */

app.get("/api/products/:id", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json(err);
  }

});

/* ---------- ADD TO CART ---------- */

app.use("/api/cart", requireAuth);

app.post("/api/cart", async (req, res) => {

  try {

    console.log("CART REQUEST:", req.body);

    const { product_id, quantity } = req.body;
    const user_id = req.user.id;

    const { data: existing, error: existingError } =
      await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user_id)
        .eq("product_id", product_id)
        .maybeSingle();

    console.log("EXISTING:", existing);
    console.log("EXISTING ERROR:", existingError);

    if (existing) {

      const { error } = await supabase
        .from("cart")
        .update({
          quantity: existing.quantity + quantity
        })
        .eq("id", existing.id);

      if (error) {
        console.log("UPDATE ERROR:", error);
        return res.status(500).json(error);
      }

      return res.json({
        message: "Cart updated"
      });
    }

    const { data, error } = await supabase
      .from("cart")
      .insert([
        {
          user_id,
          product_id,
          quantity
        }
      ])
      .select();

    console.log("INSERT DATA:", data);
    console.log("INSERT ERROR:", error);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      message: "Added to cart"
    });

  } catch (err) {

    console.log("CATCH ERROR:", err);

    res.status(500).json(err);

  }

});

/* ---------- GET USER CART ---------- */

app.get("/api/cart/:userId", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("cart")
      .select(`
        id,
        quantity,
        products (
          id,
          sku,
          product_name,
          selling_price,
          mrp,
          image_url
        )
      `)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json(error);
    }

    res.json(data);

  } catch (err) {

    res.status(500).json(err);

  }

});

/* ---------- REMOVE CART ITEM ---------- */

app.delete("/api/cart/:cartId", async (req, res) => {

  try {

    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", req.params.cartId)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json(err);

  }

});

/* ---------- UPDATE CART QUANTITY ---------- */

app.put("/api/cart/:cartId", async (req, res) => {

  try {

    const { quantity } = req.body;

    const { error } = await supabase
      .from("cart")
      .update({ quantity })
      .eq("id", req.params.cartId)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json(err);

  }

});

app.post("/api/create-razorpay-order", requireAuth, async (req, res) => {

  try {

    const requested = req.body.items;
    const delivery = req.body.delivery || {};
    if (!Array.isArray(requested) || !requested.length || requested.length > 100 ||
      requested.some(item => !Number.isSafeInteger(Number(item.id)) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 1000) ||
      new Set(requested.map(item => String(item.id))).size !== requested.length) {
      return res.status(400).json({ error: "Please review your order items." });
    }
    const address = {};
    for (const field of ['name', 'email', 'phone', 'pincode', 'address', 'city', 'state']) {
      address[field] = String(delivery[field] || '').trim();
      if (!address[field] || address[field].length > (field === 'address' ? 500 : 150)) return res.status(400).json({ error: "Please complete your delivery details." });
    }
    if (!/^[1-9][0-9]{5}$/.test(address.pincode) || !/^[+0-9 ()-]{10,16}$/.test(address.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) return res.status(400).json({ error: "Please check your email, mobile number and PIN code." });
    const { data: products, error: productError } = await supabase.from('products').select('*').in('id', requested.map(item => item.id)).eq('is_active', true);
    if (productError) throw productError;
    const items = requested.map(item => {
      const product = products.find(product => String(product.id) === String(item.id));
      if (!product || Number(product.stock) < item.qty || !Number.isFinite(Number(product.selling_price)) || Number(product.selling_price) <= 0) throw new Error('An item is unavailable. Please review your bag.');
      return { id: product.id, qty: item.qty, price: Number(product.selling_price), mrp: Number(product.mrp || product.selling_price), name: product.product_name, description: product.description || '', sku: product.sku, image_url: product.image_url };
    });
    const amount = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount." });
    // Confirm the migration exists before creating a provider order.
    const { error: schemaError } = await supabase.from('payment_sessions').select('razorpay_order_id').limit(0);
    if (schemaError) throw schemaError;

    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    const { error: sessionError } = await supabase.from('payment_sessions').insert({ razorpay_order_id: order.id, user_id: req.user.id, amount, details: { items, delivery: address, shipping: 0, test_mode: process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_') } });
    if (sessionError) throw sessionError;

    res.json({ ...order, key_id: process.env.RAZORPAY_KEY_ID });

  } catch (err) {

    const providerError = err.error || {};
    console.error("Razorpay order creation failed", {
      status: err.statusCode,
      code: providerError.code,
      description: providerError.description || err.message
    });
    res.status(502).json({
      error: "Payment could not start. Please contact our team if this continues.",
      code: providerError.code || "PAYMENT_ORDER_FAILED"
    });

  }

});

/* ---------- CREATE ORDER ---------- */

app.use("/api/orders", requireAuth);

app.post("/api/orders", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(value => typeof value === 'string' && value.length < 200)) return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
    const { data: checkout, error } = await supabase.from('payment_sessions').select('*').eq('razorpay_order_id', razorpay_order_id).eq('user_id', req.user.id).single();
    if (error || !checkout) return res.status(404).json({ error: 'Checkout not found.' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${checkout.razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!/^[a-f0-9]{64}$/i.test(razorpay_signature) || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpay_signature, 'hex'))) return res.status(400).json({ error: 'Payment verification failed.' });
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.order_id !== checkout.razorpay_order_id || Number(payment.amount) !== Number(checkout.amount) || payment.currency !== 'INR' || payment.status !== 'captured') return res.status(409).json({ error: 'Payment capture is not confirmed yet. Contact support with your payment reference; do not pay again.' });
    // Store only the payment method and masked card metadata, never account/card credentials.
    const result = await confirmCapturedPayment(checkout, payment);
    res.json(result);
  } catch (error) {
    console.error('Order confirmation failed', { message: error.message, code: error.code });
    res.status(500).json({ error: 'We could not confirm your order. Contact support with your payment reference before paying again.' });
  }
});

function publicOrder(order) {
  return { reference: order.public_reference, created_at: order.created_at,
    total_amount: order.total_amount, status: order.status, details: order.details,
    items: order.details?.items || (order.order_items || []).map(line => ({
      id: line.products?.id, name: line.products?.product_name || 'Equipment', description: line.products?.description,
      sku: line.products?.sku, image_url: line.products?.image_url, qty: line.quantity, price: line.price
    }))
  };
}

app.get('/api/orders/tracking/:reference', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { data: order, error } = await supabase.from('orders').select('*')
      .eq('public_reference', req.params.reference).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ error: 'Order not found in your account.' });
    const linked = await syncOrderTracking(supabase, order);
    if (!linked) return res.json({ linked: false });
    const { data: refreshed, error: readError } = await supabase.from('orders').select('*')
      .eq('public_reference', req.params.reference).eq('user_id', req.user.id).single();
    if (readError) throw readError;
    res.json({ linked: true, status: refreshed.status, shipment: refreshed.details.shipment });
  } catch (_) {
    res.status(503).json({ error: 'Delhivery updates are unavailable right now. Your saved tracking is still shown.' });
  }
});

app.get('/api/orders/detail/:reference', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders')
      .select('*, order_items(*, products(id, sku, product_name, description, selling_price, image_url))')
      .eq('public_reference', req.params.reference).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found in your account.' });
    res.json(publicOrder(data));
  } catch (_) { res.status(500).json({ error: 'Unable to load this order.' }); }
});

app.get("/api/orders/:userId", async (req, res) => {

  try {

    const { data, error } =
      await supabase
        .from("orders")
        .select("*, order_items(*, products(id, sku, product_name, description, selling_price, image_url))")
        .eq(
          "user_id",
          req.user.id
        )
        .order(
          "created_at",
          { ascending: false }
        );

    if (error)
      return res.status(500)
        .json(error);

    // Public API does not expose database sequence identifiers.
    res.json(data.map(publicOrder));

  } catch (err) {

    res.status(500)
      .json({ error: 'Unable to load orders.' });

  }

});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running");
});

app.get("/", (req, res) => {
  res.send("Physiowaye API is running 🚀");
});

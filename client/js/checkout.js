const summary = document.getElementById('orderSummary');
const form = document.getElementById('checkoutForm');
const payButton = document.getElementById('payButton');
const statusMessage = document.getElementById('checkoutStatus');
const buyNowProductId = new URLSearchParams(location.search).get('buyNow');
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
let checkoutUser;
let paymentBusy = false;
let recordingOrder = false;
let orderCompleted = false;
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }
function setBusy(busy) { paymentBusy = busy; payButton.disabled = busy; payButton.textContent = busy ? 'Opening payment…' : 'Continue to payment →'; }
async function getCheckoutLines() {
  const response = await apiFetch(buyNowProductId ? `/products/${encodeURIComponent(buyNowProductId)}` : `/cart/${checkoutUser.id}`);
  if (!response.ok) throw new Error('We could not load your order. Please try again.');
  const data = await response.json();
  const lines = buyNowProductId ? [{ id: null, quantity: 1, products: data }] : data;
  if (!Array.isArray(lines)) throw new Error('Your order could not be loaded.');
  for (const line of lines) {
    if (!line.products || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) throw new Error('Please review the items in your cart.');
    if (Number(line.products.stock) < Number(line.quantity)) throw new Error('An item has insufficient stock. Please update your cart.');
  }
  return lines;
}
function renderLines(lines) {
  let total = 0, count = 0, savings = 0;
  summary.replaceChildren();
  for (const line of lines) {
    const product = line.products;
    const quantity = Number(line.quantity);
    total += Number(product.selling_price) * quantity;
    count += quantity;
    savings += Math.max(0, Number(product.mrp || 0) - Number(product.selling_price)) * quantity;
    const row = document.createElement('article');
    row.className = 'checkout-line';
    row.innerHTML = `<img alt=""><div><a href="product.html?id=${encodeURIComponent(product.id)}"><h3>${escapeHTML(product.product_name)}</h3></a><p>Qty: ${quantity} · ${money.format(product.selling_price)} each</p></div><strong>${money.format(Number(product.selling_price) * quantity)}</strong>`;
    const image = row.querySelector('img');
    const local = product.sku ? `assets/images/products/${String(product.sku).toLowerCase()}.jpg` : '';
    image.src = product.image_url || local;
    image.alt = product.product_name;
    image.onerror = () => { image.onerror = null; if (local && image.getAttribute('src') !== local) image.src = local; else image.hidden = true; };
    summary.append(row);
  }
  document.getElementById('reviewCount').textContent = `${count} ${count === 1 ? 'item' : 'items'} in this order`;
  document.getElementById('subtotalLabel').textContent = `Item subtotal (${count})`;
  document.getElementById('subtotal').textContent = money.format(total);
  document.getElementById('grandTotal').textContent = money.format(total);
  document.getElementById('savingsRow').hidden = savings === 0;
  document.getElementById('savings').textContent = money.format(savings);
  document.getElementById('editBag').href = buyNowProductId ? `product.html?id=${encodeURIComponent(buyNowProductId)}` : 'cart.html';
  document.getElementById('editBag').textContent = buyNowProductId ? 'View product' : 'Edit bag';
  return total;
}
async function initializeCheckout() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      if (buyNowProductId) sessionStorage.setItem('physiowaye_pending_purchase', JSON.stringify({ action: 'buyNow', productId: buyNowProductId }));
      location.replace('login.html'); return;
    }
    checkoutUser = session.user;
    document.getElementById('name').value = checkoutUser.user_metadata?.full_name || '';
    document.getElementById('email').value = checkoutUser.email || '';
    const lines = await getCheckoutLines();
    if (!lines.length) { summary.innerHTML = '<div class="empty-checkout">Your bag is empty. <a href="products.html">Explore equipment →</a></div>'; document.getElementById('reviewCount').textContent = 'No items to check out'; return; }
    renderLines(lines); payButton.disabled = false;
  } catch (error) { summary.innerHTML = '<div class="empty-checkout">We could not load your items. <a href="checkout.html">Try again</a></div>'; statusMessage.textContent = error.message; }
  finally { summary.removeAttribute('aria-busy'); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (paymentBusy || !checkoutUser || !form.reportValidity()) return;
  statusMessage.textContent = ''; setBusy(true);
  try {
    const lines = await getCheckoutLines();
    if (!lines.length) throw new Error('Your bag is empty.');
    const total = renderLines(lines);
    const items = lines.map(line => ({ id: line.products.id, qty: Number(line.quantity), price: Number(line.products.selling_price) }));
    const response = await apiFetch('/create-razorpay-order', { method: 'POST', body: JSON.stringify({ items: items.map(({ id, qty }) => ({ id, qty })), delivery: Object.fromEntries(['name', 'email', 'phone', 'pincode', 'address', 'city', 'state'].map(field => [field, document.getElementById(field).value.trim()])) }) });
    const paymentOrder = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Payment order request failed', { status: response.status, code: paymentOrder.code, error: paymentOrder.error });
      if (response.status === 401 || response.status === 403) throw new Error('Your sign-in has expired. Please sign in again before paying.');
      throw new Error(paymentOrder.error || paymentOrder.message || `Payment service is unavailable (${response.status}). Please contact our team.`);
    }
    if (!window.Razorpay || !paymentOrder.id) throw new Error('Payment is unavailable. Please refresh and try again.');
    const payment = new Razorpay({
      key: paymentOrder.key_id, amount: paymentOrder.amount, currency: 'INR', name: 'PhysioWaye', description: 'Equipment order', order_id: paymentOrder.id,
      prefill: { name: document.getElementById('name').value.trim(), email: document.getElementById('email').value.trim(), contact: document.getElementById('phone').value.trim() },
      theme: { color: '#158ec1' },
      modal: { ondismiss: () => { if (recordingOrder || orderCompleted) return; setBusy(false); statusMessage.textContent = 'Payment was closed. You can continue when you are ready.'; } },
      handler: async function (paymentResult) {
        recordingOrder = true; payButton.textContent = 'Confirming your order…';
        try {
          const orderResponse = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(paymentResult) });
          const result = await orderResponse.json();
          if (!orderResponse.ok || !result.success) throw new Error((result.error || 'Payment completed, but the order could not be recorded.') + ' Payment reference: ' + paymentResult.razorpay_payment_id);
          orderCompleted = true;
          if (!buyNowProductId) await Promise.allSettled(lines.map(line => apiFetch(`/cart/${line.id}`, { method: 'DELETE' })));
          document.getElementById('orderMessage').textContent = `Your equipment is one step closer. We’ve verified your payment and confirmed your order.`;
          document.getElementById('successReference').textContent = result.reference;
          document.getElementById('successTotal').textContent = money.format(result.total);
          document.getElementById('viewOrders').href = `order.html?order=${encodeURIComponent(result.reference)}`;
          document.getElementById('successModal').hidden = false;
          document.querySelector('.checkout-shell').inert = true;
          document.querySelector('.checkout-header').inert = true;
          document.getElementById('viewOrders').focus();
        } catch (error) { statusMessage.textContent = error.message; payButton.textContent = 'Please contact support'; }
      }
    });
    payment.on('payment.failed', () => { if (recordingOrder || orderCompleted) return; setBusy(false); statusMessage.textContent = 'Payment was not completed. Check its status before trying again.'; });
    payment.open();
  } catch (error) { setBusy(false); statusMessage.textContent = error.message; }
});
initializeCheckout();
document.getElementById('successModal').addEventListener('keydown', event => {
  if (event.key === 'Tab') { event.preventDefault(); document.getElementById('viewOrders').focus(); }
});

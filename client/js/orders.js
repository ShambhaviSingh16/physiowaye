const list = document.getElementById('ordersList'), ordersStatus = document.getElementById('ordersStatus');
const search = document.getElementById('orderSearch'), filter = document.getElementById('orderFilter');
const currency = new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 });
let orders = [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function date(value) {
  if (!value) return 'Not available';
  const parsed = new Date(/T/.test(value) && !/(Z|[+-]\d\d:\d\d)$/.test(value) ? `${value}Z` : value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function itemHTML(item) {
  const image = item.sku ? `assets/images/products/${encodeURIComponent(String(item.sku).toLowerCase())}.jpg` : item.image_url;
  const safeImage = image && (/^https?:\/\//.test(image) || image.startsWith('assets/')) ? image : 'assets/images/logo.png';
  return `<article class="order-product"><img loading="lazy" src="${esc(safeImage)}" alt="${esc(item.name)}"><div><a href="product.html?id=${encodeURIComponent(item.id || '')}"><h3>${esc(item.name || 'Equipment')}</h3></a><p>Quantity ${esc(item.qty)} · ${currency.format(Number(item.price) || 0)} each</p>${item.description ? `<details class="product-overview"><summary>Product overview</summary><p>${esc(item.description)}</p></details>` : ''}</div><strong>${currency.format(Number(item.price || 0) * Number(item.qty || 0))}</strong></article>`;
}
function trackingHTML(order) {
  const events = order.details?.tracking || [], shipment = order.details?.shipment || {};
  const stages = ['Confirmed','Packed','Shipped','Out for delivery','Delivered'];
  const current = stages.findIndex(stage => stage.toLowerCase() === String(order.status).toLowerCase());
  let link = '';
  try { const url = new URL(shipment.tracking_url); if (url.protocol === 'https:') link = `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Open courier tracking ↗</a>`; } catch (_) {}
  return `<section class="order-tracking"><div class="order-section-heading"><h3>Track your equipment</h3><span>${esc(order.status || 'Pending')}</span></div>${/cancelled|refunded/i.test(order.status) ? '<p>This order is closed. Contact our team for help.</p>' : `<ol class="shipment-steps">${stages.map((stage,i) => `<li class="${i <= current ? 'reached' : ''}" ${i === current ? 'aria-current="step"' : ''}><span aria-hidden="true">${i < current ? '✓' : i+1}</span><strong>${stage}</strong><small>${i < current ? 'Completed' : i === current ? 'Current stage' : 'Awaiting update'}</small></li>`).join('')}</ol>`}<div class="shipment-note">${shipment.carrier ? `<strong>${esc(shipment.carrier)}</strong><p>Tracking number: ${esc(shipment.tracking_number || 'Awaiting assignment')}</p>${link}` : '<strong>Courier details will appear after dispatch.</strong><p>Our team will update this timeline as your equipment moves. No delivery date has been confirmed yet.</p>'}</div>${events.length ? `<ul class="tracking-events">${events.slice().reverse().map(event => `<li><strong>${esc(event.status)}</strong><time>${esc(date(event.at))}</time><p>${esc(event.note || '')}</p></li>`).join('')}</ul>` : '<p class="legacy-note">Detailed tracking was not recorded for this earlier order. Contact our team for an update.</p>'}</section>`;
}
function renderOrder(order) {
  const details = order.details || {}, items = order.items || [], payment = details.payment, delivery = details.delivery;
  const reference = order.reference || 'Reference unavailable', total = Number(order.total_amount) || 0;
  const subtotal = items.reduce((sum,item) => sum + Number(item.price || 0)*Number(item.qty || 0),0);
  const savings = items.reduce((sum,item) => sum + Math.max(0,Number(item.mrp || item.price)-Number(item.price || 0))*Number(item.qty || 0),0);
  const count = items.reduce((sum,item) => sum + Number(item.qty || 0),0);
  const method = payment ? [{card:'Card',upi:'UPI',netbanking:'Netbanking',wallet:'Wallet',emi:'EMI',paylater:'Pay later'}[payment.method] || 'Online payment',payment.card_network,payment.card_last4 ? `•••• ${payment.card_last4}` : payment.bank || payment.wallet].filter(Boolean).join(' · ') : 'Payment record unavailable';
  const card = document.createElement('article'); card.className = 'purchase-card';
  card.innerHTML = `<header class="purchase-header"><div><span class="order-micro">ORDER REFERENCE</span><strong class="public-reference">${esc(reference)}</strong><p>Placed ${esc(date(order.created_at))}</p></div><div class="order-badges"><span>${esc(order.status || 'Pending')}</span><span class="payment-badge ${payment?.status === 'Paid' ? 'is-paid' : ''}">${payment?.status === 'Paid' ? '✓ Paid' : 'Payment unverified'}</span>${details.test_mode ? '<span class="test-badge">Test order</span>' : ''}</div></header><div class="purchase-products">${items.length ? items.map(itemHTML).join('') : '<p>Product details are unavailable for this earlier order.</p>'}</div><div class="purchase-bottom"><div><span>${count || '—'} items · Order total</span><strong>${currency.format(total)}</strong></div><div class="order-actions"><button type="button" data-action="details" aria-expanded="false">View order details ↓</button><button type="button" data-action="track" aria-expanded="false">Track order →</button></div></div><div class="purchase-detail" hidden><div class="order-section-heading"><h3>Order details</h3><button type="button" class="close-detail">Close ↑</button></div><div class="order-detail-grid"><section><h4>Delivery address</h4>${delivery ? `<strong>${esc(delivery.name)}</strong><p>${esc(delivery.address)}<br>${esc(delivery.city)}, ${esc(delivery.state)} ${esc(delivery.pincode)}</p><p>${esc(delivery.phone)}<br>${esc(delivery.email)}</p>` : '<p>Delivery details were not saved for this earlier order.</p>'}</section><section><h4>Payment details</h4><strong>${esc(method)}</strong><p>${payment ? `Status: ${esc(payment.status)}<br>Verified ${esc(date(payment.verified_at))}` : 'This earlier order has no verified payment record.'}</p>${payment ? `<span class="order-micro">PAYMENT REFERENCE</span><p>${esc(payment.id)}</p>` : ''}${details.test_mode ? '<small>Test Mode · No real money was charged.</small>' : ''}</section><section class="price-breakup"><h4>Price breakdown</h4><div><span>Items subtotal</span><b>${currency.format(subtotal)}</b></div>${details.shipping != null ? `<div><span>Delivery charges</span><b>${currency.format(details.shipping)}</b></div>` : ''}${Math.abs(total-subtotal-Number(details.shipping || 0)) > .01 ? `<div><span>Other recorded charges</span><b>${currency.format(total-subtotal-Number(details.shipping || 0))}</b></div>` : ''}<div class="breakup-total"><span>Order total</span><b>${currency.format(total)}</b></div>${savings ? `<p class="saved-amount">You saved ${currency.format(savings)} on these products.</p>` : ''}</section></div><a class="order-help-link" href="https://wa.me/919540043453?text=${encodeURIComponent(`Hi PhysioWaye, I need help with order ${reference}.`)}" target="_blank" rel="noopener noreferrer">Need help with this order? Chat with us ↗</a></div><div class="purchase-tracking" hidden>${trackingHTML(order)}<button type="button" class="close-tracking">Close tracking ↑</button></div>`;
  const detail = card.querySelector('.purchase-detail'), track = card.querySelector('.purchase-tracking');
  const detailButton = card.querySelector('[data-action="details"]'), trackButton = card.querySelector('[data-action="track"]');
  function toggle(panel,button,force) { panel.hidden = force == null ? !panel.hidden : !force; button.setAttribute('aria-expanded',String(!panel.hidden)); }
  detailButton.onclick = () => toggle(detail,detailButton);
  trackButton.onclick = () => { toggle(track,trackButton); if (!track.hidden) track.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth',block:'nearest'}); };
  card.querySelector('.close-detail').onclick = () => { toggle(detail,detailButton,false); detailButton.focus(); };
  card.querySelector('.close-tracking').onclick = () => { toggle(track,trackButton,false); trackButton.focus(); };
  card.querySelectorAll('.order-product img').forEach(img => { img.onerror = () => { img.onerror = null; img.src = 'assets/images/logo.png'; }; });
  if (new URLSearchParams(location.search).get('order') === order.reference) toggle(detail,detailButton,true);
  return card;
}
function render() {
  const query = search.value.trim().toLowerCase();
  const visible = orders.filter(order => {
    const status = String(order.status || 'Pending').toLowerCase();
    const matches = filter.value === 'all' || (filter.value === 'delivered' ? status === 'delivered' : filter.value === 'cancelled' ? /cancelled|refunded/.test(status) : !/delivered|cancelled|refunded/.test(status));
    return matches && `${order.reference || ''} ${(order.items || []).map(item => item.name).join(' ')}`.toLowerCase().includes(query);
  });
  ordersStatus.textContent = `${visible.length} ${visible.length === 1 ? 'order':'orders'}${visible.length !== orders.length ? ` of ${orders.length}`:''}`;
  list.replaceChildren(...visible.map(renderOrder));
  if (!visible.length) list.innerHTML = `<section class="orders-empty"><span aria-hidden="true">◇</span><h3>${orders.length ? 'No matching orders':'Your next step starts here.'}</h3><p>${orders.length ? 'Try another product name, reference or status.':'Find the right equipment. Your orders and delivery updates will appear here.'}</p>${orders.length ? '<button id="clearOrderFilters" type="button">Clear filters</button>':'<a href="products.html">Explore equipment →</a>'}</section>`;
  document.getElementById('clearOrderFilters')?.addEventListener('click',() => { search.value=''; filter.value='all'; render(); search.focus(); });
}
async function loadOrders() {
  list.setAttribute('aria-busy','true');
  try {
    const {data:{session}} = await supabaseClient.auth.getSession();
    if (!session) { location.replace('login.html'); return; }
    const response = await apiFetch(`/orders/${encodeURIComponent(session.user.id)}`);
    if (!response.ok) throw new Error('Unable to load orders');
    orders = await response.json();
    if (!Array.isArray(orders)) throw new Error('Invalid orders response');
    render();
  } catch (_) {
    ordersStatus.textContent = 'Your orders could not be loaded.';
    list.innerHTML = '<section class="orders-empty"><h3>Let’s try that again.</h3><p>We couldn’t reach your order history.</p><button id="retryOrders" type="button">Retry</button></section>';
    document.getElementById('retryOrders').onclick = loadOrders;
  } finally { list.setAttribute('aria-busy','false'); }
}
search.addEventListener('input',render); filter.addEventListener('change',render); loadOrders();

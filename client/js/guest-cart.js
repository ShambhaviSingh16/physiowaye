const GUEST_CART_KEY = 'physiowaye_guest_cart';

function guestCartItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => Number.isSafeInteger(Number(item.productId)) && Number(item.productId) > 0 &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100);
  } catch (_) {
    return [];
  }
}

function saveGuestCart(items) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

function addGuestCartItem(productId, stock) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id < 1) return false;
  const items = guestCartItems();
  const existing = items.find(item => Number(item.productId) === id);
  const limit = Math.min(100, Math.max(0, Number(stock) || 0));
  if (!limit || (existing?.quantity || 0) >= limit) return false;
  if (existing) existing.quantity += 1;
  else items.push({ productId: id, quantity: 1 });
  saveGuestCart(items);
  return true;
}

function setGuestCartQuantity(productId, quantity) {
  const id = Number(productId);
  const items = guestCartItems().filter(item => Number(item.productId) !== id);
  if (Number.isInteger(quantity) && quantity > 0) {
    items.push({ productId: id, quantity: Math.min(quantity, 100) });
  }
  saveGuestCart(items);
}

let guestCartSyncPromise;
async function syncGuestCart() {
  if (guestCartSyncPromise) return guestCartSyncPromise;
  guestCartSyncPromise = moveGuestCartToAccount();
  try { return await guestCartSyncPromise; }
  finally { guestCartSyncPromise = undefined; }
}

async function moveGuestCartToAccount() {
  const items = guestCartItems();
  if (!items.length) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  for (const item of items) {
    const response = await apiFetch('/cart', {
      method: 'POST',
      body: JSON.stringify({ product_id: item.productId, quantity: item.quantity })
    });
    if (!response.ok) throw new Error('We could not move every item to your account. Please try again.');
    setGuestCartQuantity(item.productId, 0);
  }
}

const cartItemsDiv = document.getElementById('cartItems');
const totalDiv = document.getElementById('total');
const cartStatus = document.getElementById('cartStatus');
const checkoutLink = document.getElementById('checkoutLink');
const cartMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const cartEscape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let cartSession = null;

async function loadCart() {
  cartStatus.textContent = '';
  cartStatus.dataset.state = 'idle';
  cartStatus.setAttribute('role', 'status');
  cartStatus.setAttribute('aria-live', 'polite');
  cartItemsDiv.setAttribute('aria-busy', 'true');
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    cartSession = session;
    let items;
    let syncFailed = false;
    if (session) {
      try { await syncGuestCart(); } catch (error) {
        syncFailed = true;
        cartStatus.dataset.state = 'error';
        cartStatus.setAttribute('role', 'alert');
        cartStatus.setAttribute('aria-live', 'assertive');
        cartStatus.textContent = error.message;
        showToast('Some guest items could not be moved to your account.', { type: 'error', title: 'Cart sync incomplete', announce: false });
      }
      const response = await apiFetch(`/cart/${encodeURIComponent(session.user.id)}`);
      if (!response.ok) throw new Error('Your cart could not be loaded. Please try again.');
      items = (await response.json()).map(item => ({ id: item.id, quantity: item.quantity, product: item.products }));
    } else {
      items = (await Promise.all(guestCartItems().map(async item => {
        const response = await apiFetch(`/products/${item.productId}`);
        if (!response.ok) return null;
        const product = await response.json();
        return product.is_active && Number(product.stock) > 0
          ? { id: item.productId, quantity: item.quantity, product } : null;
      }))).filter(Boolean);
    }
    renderCart(items);
    updateCartCount();
    return !syncFailed;
  } catch (error) {
    cartStatus.dataset.state = 'error';
    cartStatus.setAttribute('role', 'alert');
    cartStatus.setAttribute('aria-live', 'assertive');
    cartStatus.textContent = error.message;
    showToast(error.message, { type: 'error', title: 'Cart unavailable', announce: false });
    cartItemsDiv.replaceChildren();
    totalDiv.textContent = '';
    return false;
  } finally {
    cartItemsDiv.removeAttribute('aria-busy');
  }
}

function renderCart(items) {
  cartItemsDiv.replaceChildren();
  checkoutLink.hidden = items.length === 0;
  if (!items.length) {
    cartItemsDiv.innerHTML = '<div class="empty-cart"><h2>Your cart is empty</h2><p>Browse our physiotherapy equipment and add items to your cart.</p><a href="products.html" class="btn-primary">Browse products</a></div>';
    totalDiv.textContent = '';
    return;
  }
  let total = 0;
  items.forEach(item => {
    const product = item.product;
    const quantity = Math.min(Number(item.quantity) || 1, Number(product.stock) || 1);
    const lineTotal = Number(product.selling_price) * quantity;
    total += lineTotal;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `<div class="cart-image"><img src="${cartEscape(product.image_url || `assets/images/products/${String(product.sku || '').toLowerCase()}.jpg?v=catalog-20261111`)}" alt="${cartEscape(product.product_name)}"></div><div class="cart-info"><h3>${cartEscape(product.product_name)}</h3><p class="price">${cartMoney.format(Number(product.selling_price))}</p><div class="cart-controls"><button type="button" data-action="decrease" data-id="${cartEscape(item.id)}" aria-label="Decrease quantity of ${cartEscape(product.product_name)}">−</button><span>${quantity}</span><button type="button" data-action="increase" data-id="${cartEscape(item.id)}" aria-label="Increase quantity of ${cartEscape(product.product_name)}" ${quantity >= Number(product.stock) ? 'disabled' : ''}>+</button><button type="button" class="remove-btn" data-action="remove" data-id="${cartEscape(item.id)}">Remove</button></div><p>${cartMoney.format(Number(product.selling_price))} × ${quantity} = ${cartMoney.format(lineTotal)}</p></div>`;
    cartItemsDiv.append(row);
  });
  totalDiv.textContent = `Total: ${cartMoney.format(total)}`;
}

cartItemsDiv.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  button.disabled = true;
  const id = Number(button.dataset.id);
  const row = button.closest('.cart-item');
  const current = Number(row.querySelector('.cart-controls span').textContent);
  const next = button.dataset.action === 'increase' ? current + 1 : current - 1;
  try {
    if (cartSession) {
      const response = await apiFetch(`/cart/${id}`, button.dataset.action === 'remove' || next <= 0
        ? { method: 'DELETE' }
        : { method: 'PUT', body: JSON.stringify({ quantity: next }) });
      if (!response.ok) throw new Error('The cart could not be updated. Please try again.');
    } else {
      setGuestCartQuantity(id, button.dataset.action === 'remove' ? 0 : next);
    }
    if (await loadCart()) {
      showToast(button.dataset.action === 'remove' || next <= 0 ? 'The item was removed from your cart.' : 'Your cart total has been updated.', {
        title: button.dataset.action === 'remove' || next <= 0 ? 'Item removed' : 'Quantity updated'
      });
    }
  } catch (error) {
    cartStatus.dataset.state = 'error';
    cartStatus.setAttribute('role', 'alert');
    cartStatus.setAttribute('aria-live', 'assertive');
    cartStatus.textContent = error.message;
    showToast(error.message, { type: 'error', title: 'Cart not updated', announce: false });
    button.disabled = false;
  }
});

checkoutLink.addEventListener('click', event => {
  if (cartSession) return;
  event.preventDefault();
  sessionStorage.setItem('physiowaye_pending_purchase', JSON.stringify({ action: 'checkoutCart' }));
  window.location.href = 'login.html';
});

loadCart();

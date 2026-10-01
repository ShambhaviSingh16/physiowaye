const user = JSON.parse(sessionStorage.getItem("user"));
const summary = document.getElementById("orderSummary");
const buyNowProductId = new URLSearchParams(window.location.search).get("buyNow");

if (!user) window.location.href = "login.html";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function getCheckoutLines() {
  if (buyNowProductId) {
    const response = await apiFetch(`/products/${encodeURIComponent(buyNowProductId)}`);
    if (!response.ok) throw new Error("This product is unavailable.");
    const product = await response.json();
    if (Number(product.stock) < 1) throw new Error("This product is currently out of stock.");
    return [{ id: null, quantity: 1, products: product }];
  }
  const response = await apiFetch(`/cart/${user.id}`);
  if (!response.ok) throw new Error("Could not load your cart.");
  return response.json();
}

async function renderSummary() {
  try {
    const lines = await getCheckoutLines();
    if (!lines.length) {
      summary.innerHTML = '<div class="empty-checkout"><h2>Your Cart is Empty</h2><p>Add products before checkout.</p></div>';
      document.querySelector(".place-order-btn").style.display = "none";
      return;
    }
    let totalItems = 0;
    let totalPrice = 0;
    let html = "";
    lines.forEach(item => {
      const product = item.products;
      const quantity = Number(item.quantity) || 1;
      const lineTotal = Number(product.selling_price) * quantity;
      totalItems += quantity;
      totalPrice += lineTotal;
      html += `<div class="order-item"><div><div class="order-name">${escapeHTML(product.product_name)}</div><div class="order-qty">Quantity: ${quantity}</div></div><div>${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(lineTotal)}</div></div>`;
    });
    html += `<div class="summary-box"><h3>Total Items: ${totalItems}</h3><h3>Total Amount: ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalPrice)}</h3></div>`;
    summary.innerHTML = html;
  } catch (error) {
    summary.innerHTML = `<div class="empty-checkout"><h2>Checkout unavailable</h2><p>${error.message}</p><a href="products.html">Return to products</a></div>`;
    document.querySelector(".place-order-btn").style.display = "none";
  }
}

renderSummary();

window.placeOrder = async function () {
  if (!user) return;
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  if (!name || !email || !phone || !address) return alert("Please fill all details");

  try {
    const lines = await getCheckoutLines();
    if (!lines.length) return alert("Your cart is empty.");
    const items = lines.map(item => ({
      id: item.products.id,
      qty: Number(item.quantity) || 1,
      price: Number(item.products.selling_price) || 0
    }));
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const razorpayRes = await apiFetch("/create-razorpay-order", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: total })
    });
    if (!razorpayRes.ok) throw new Error("Could not start payment. Please try again.");
    const razorpayOrder = await razorpayRes.json();
    const options = {
      key: "rzp_test_T51j3XaiQx5sos", amount: razorpayOrder.amount, currency: "INR",
      name: "PhysioWaye", description: "Order Payment", order_id: razorpayOrder.id,
      handler: async function () {
        try {
          const orderRes = await apiFetch("/orders", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, total_amount: total })
          });
          const result = await orderRes.json();
          if (!orderRes.ok || !result.success) throw new Error("Order could not be recorded.");
          if (!buyNowProductId) {
            for (const line of lines) await apiFetch(`/cart/${line.id}`, { method: "DELETE" });
          }
          showOrderSuccess(result.order_id);
        } catch (error) {
          console.error(error);
          alert(error.message || "Order failed. Please contact support before retrying payment.");
        }
      },
      prefill: { name, email, contact: phone },
      theme: { color: "#168fc8" }
    };
    new Razorpay(options).open();
  } catch (error) {
    console.error(error);
    alert(error.message || "Something went wrong.");
  }
};

function showOrderSuccess(orderId) {
  document.getElementById("orderMessage").textContent = "Your order has been placed successfully.";
  document.getElementById("successModal").style.display = "flex";
}

function goToOrders() { window.location.href = "orders.html"; }

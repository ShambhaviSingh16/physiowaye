const user = sessionStorage.getItem("user");
if (!user) {
  alert("Please login to view cart");
  window.location.href = "login.html";
}
// const API = "http://localhost:5000/api";
const cartItemsDiv = document.getElementById("cartItems");
const totalDiv = document.getElementById("total");

async function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (cart.length === 0) {
    cartItemsDiv.innerHTML = "<p>Your cart is empty.</p>";
    totalDiv.innerText = "";
    return;
  }

  let total = 0;
  cartItemsDiv.innerHTML = "";

  for (const item of cart) {
    const res = await fetch(
      `https://physiowaye.onrender.com/api/products/${item.id}`
    );
    const product = await res.json();

    const itemTotal = product.price * item.qty;
    total += itemTotal;

    cartItemsDiv.innerHTML += `
      <p>
        <strong>${product.name}</strong><br>
        Qty: ${item.qty} × ₹${product.price} = ₹${itemTotal}
      </p>
      <hr>
    `;
  }

  totalDiv.innerText = `Total: ₹${total}`;
}

loadCart();

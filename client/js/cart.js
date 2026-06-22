const user = sessionStorage.getItem("user");
if (!user) {
  alert("Please login to view cart");
  window.location.href = "login.html";
}
// const API = "http://localhost:5000/api";
const cartItemsDiv = document.getElementById("cartItems");
const totalDiv = document.getElementById("total");

async function loadCart() {

  const userObj =
    JSON.parse(sessionStorage.getItem("user"));

  const res = await fetch(
    `https://physiowaye.onrender.com/api/cart/${userObj.id}`
  );

  const cart = await res.json();

  if (!cart.length) {

    cartItemsDiv.innerHTML =
      "<p>Your cart is empty.</p>";

    totalDiv.innerText = "";

    return;

  }

  let total = 0;

  cartItemsDiv.innerHTML = "";

  for (const item of cart) {

    const product = item.products;

    const itemTotal =
      product.selling_price * item.quantity;

    total += itemTotal;

    cartItemsDiv.innerHTML += `

<div class="cart-item">

<strong>
${product.product_name}
</strong>

<div class="cart-controls">

<button
onclick="changeQty(${item.id}, ${item.quantity}, -1)">
−
</button>

<span>${item.quantity}</span>

<button
onclick="changeQty(${item.id}, ${item.quantity}, 1)">
+
</button>

<button
class="remove-btn"
onclick="removeItem(${item.id})">
Remove
</button>

</div>

<p>
₹${product.selling_price}
×
${item.quantity}
=
₹${itemTotal}
</p>

<hr>

</div>

`;

  }

  totalDiv.innerText =
    `Total: ₹${total}`;

}

loadCart();
updateCartCount();
async function changeQty(cartId, currentQty, change) {

  const newQty = currentQty + change;

  if (newQty <= 0) {

    await fetch(
      `https://physiowaye.onrender.com/api/cart/${cartId}`,
      {
        method: "DELETE"
      }
    );

  } else {

    await fetch(
      `https://physiowaye.onrender.com/api/cart/${cartId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          quantity: newQty
        })
      }
    );

  }

  loadCart();
  updateCartCount();
}

async function removeItem(cartId) {

  await fetch(
    `https://physiowaye.onrender.com/api/cart/${cartId}`,
    {
      method: "DELETE"
    }
  );

  loadCart();
  updateCartCount();
}
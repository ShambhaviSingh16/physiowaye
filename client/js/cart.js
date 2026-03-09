const user = sessionStorage.getItem("user");
if (!user) {
  alert("Please login to view cart");
  window.location.href = "login.html";
}
// const API = "http://localhost:5000/api";
const cartItemsDiv = document.getElementById("cartItems");
const totalDiv = document.getElementById("total");

async function loadCart() {
  const userObj = JSON.parse(sessionStorage.getItem("user"));
  const cartKey = `cart_${userObj.id}`;
  const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

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
<div class="cart-item">

<strong>${product.name}</strong>

<div class="cart-controls">

<button onclick="changeQty(${product.id}, -1)">−</button>

<span>${item.qty}</span>

<button onclick="changeQty(${product.id}, 1)">+</button>

<button class="remove-btn" onclick="removeItem(${product.id})">
Remove
</button>

</div>

<p>₹${product.price} × ${item.qty} = ₹${itemTotal}</p>

<hr>

</div>
`;
  }

  totalDiv.innerText = `Total: ₹${total}`;
}

loadCart();
updateCartCount();
function changeQty(id, change){

const user = JSON.parse(sessionStorage.getItem("user"));
let cart = JSON.parse(localStorage.getItem("cart_"+user.id)) || [];

const item = cart.find(i => i.id === id);

if(!item) return;

item.qty += change;

if(item.qty <= 0){
cart = cart.filter(i => i.id !== id);
}

localStorage.setItem("cart_"+user.id, JSON.stringify(cart));

loadCart();
updateCartCount();
}


function removeItem(id){

const user = JSON.parse(sessionStorage.getItem("user"));

let cart = JSON.parse(localStorage.getItem("cart_"+user.id)) || [];

cart = cart.filter(i => i.id !== id);

localStorage.setItem("cart_"+user.id, JSON.stringify(cart));

loadCart();
updateCartCount();

}
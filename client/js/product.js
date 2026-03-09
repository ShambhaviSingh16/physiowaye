// const API = "http://localhost:5000/api";
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const productCard = document.getElementById("productCard");

fetch(`https://physiowaye.onrender.com/api/products/${productId}`)
  .then(res => res.json())
  .then(product => {
    productCard.innerHTML = `
      <h1>${product.name}</h1>
      <p class="product-desc">${product.description}</p>
      <p class="price">
        ₹${product.price}
        <span class="mrp">₹${product.mrp}</span>
        <span class="discount">(${product.discount}% OFF)</span>
      </p>
      <button class="btn-primary" onclick="addToCart(${product.id})">
        Add to Cart
      </button>
    `;
  });

function addToCart(id) {

  const user = JSON.parse(sessionStorage.getItem("user"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const cartKey = `cart_${user.id}`;

  let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

  const existing = cart.find(i => i.id === id);

  if (existing) existing.qty++;
  else cart.push({ id, qty: 1 });

  localStorage.setItem(cartKey, JSON.stringify(cart));

  alert("Product added to cart");
}
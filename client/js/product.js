// const API = "http://localhost:5000/api";
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const productCard = document.getElementById("productCard");

fetch(`http://localhost:5000/api/products/${productId}`)
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
  if (!sessionStorage.getItem("user")) {
    window.location.href = "login.html";
    return;
  }

  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find(i => i.id === id);

  if (existing) existing.qty++;
  else cart.push({ id, qty: 1 });

  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Product added to cart");
}

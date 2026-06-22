// const API = "http://localhost:5000/api";
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const productCard = document.getElementById("productCard");

fetch(`https://physiowaye.onrender.com/api/products/${productId}`)
  .then(res => res.json())
.then(product => {

  const discountPercent =
    Math.round(
      ((product.mrp - product.selling_price) /
      product.mrp) * 100
    );

  productCard.innerHTML = `

<div class="product-detail-layout">

<div>

<img
src="https://placehold.co/700x500/e5e7eb/64748b?text=PhysioWaye"
style="
width:100%;
border-radius:20px;
"
>

</div>

<div>

<h1>${product.product_name}</h1>

<br>

<p class="product-desc">
${product.description}
</p>

<br>

<h2>
₹${product.selling_price}
</h2>

<p>

<span style="text-decoration:line-through">
₹${product.mrp}
</span>

<span style="color:green">
(${discountPercent}% OFF)
</span>

</p>

<br>

<button
class="btn-primary"
onclick="addToCart(${product.id})">

Add To Cart

</button>
<p class="stock-status">

✓ In Stock

</p>
<div class="trust-badges">

<span>✓ Secure Payment</span>

<span>✓ Genuine Products</span>

<span>✓ Fast Delivery</span>

<span>✓ GST Invoice</span>

</div>

</div>

</div>
`;
});

async function addToCart(id) {

  const user = JSON.parse(sessionStorage.getItem("user"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

try {

  const response = await fetch(
    "https://physiowaye.onrender.com/api/cart",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        product_id: id,
        quantity: 1
      })
    }
  );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Cart error"
    );
  }

showToast("✓ Product added to cart");

  updateCartCount();

} catch (err) {

  console.error(
    "Cart API Error:",
    err
  );

}

}

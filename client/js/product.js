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

</div>

</div>
`;
});

// function addToCart(id) {

//   const user = JSON.parse(sessionStorage.getItem("user"));

//   if (!user) {
//     window.location.href = "login.html";
//     return;
//   }

//   const cartKey = `cart_${user.id}`;
// let cart = JSON.parse(localStorage.getItem("cart_"+user.id)) || [];

//   const existing = cart.find(i => i.id === id);

//   if (existing) existing.qty++;
//   else cart.push({ id, qty: 1 });

// localStorage.setItem("cart_"+user.id, JSON.stringify(cart));

//   alert("Product added to cart");
// }
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

    const result = await response.json();

    console.log(result);

  } catch (err) {

    console.error("Cart API Error:", err);

  }

  // LOCAL BACKUP

  let cart =
    JSON.parse(
      localStorage.getItem("cart_" + user.id)
    ) || [];

  const existing = cart.find(i => i.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id,
      qty: 1
    });
  }

  localStorage.setItem(
    "cart_" + user.id,
    JSON.stringify(cart)
  );

  alert("Product added to cart");

}

const grid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");

function loadProducts(search = "") {

  fetch(`https://physiowaye.onrender.com/api/products?search=${search}`)

    .then(res => res.json())

    .then(products => {

      grid.innerHTML = "";

      products.forEach(p => {

        const discountPercent =
          Math.round(
            ((p.mrp - p.selling_price) / p.mrp) * 100
          );

        grid.innerHTML += `

<div class="product-modern">

<img
src="https://placehold.co/600x400/e5e7eb/64748b?text=PhysioWaye"
class="product-image"
>

<div class="product-content">

<span class="discount-badge">
${discountPercent}% OFF
</span>

<h3>${p.product_name}</h3>

<p>${p.description.substring(0,120)}...</p>

<br>

<div class="product-price">

₹${p.selling_price}

<span style="
text-decoration:line-through;
font-size:16px;
color:gray;
">
₹${p.mrp}
</span>

</div>

<br>

<a
href="product.html?id=${p.id}"
class="btn-primary">

View Details

</a>

</div>

</div>

`;
      });

    })

    .catch(err => {

      console.error(err);

      grid.innerHTML =
        "<p>Unable to load products.</p>";

    });

}

loadProducts();

searchInput.addEventListener(
  "input",
  e => loadProducts(e.target.value)
);
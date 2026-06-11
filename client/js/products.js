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
          <div class="feature-card">

            <h3>${p.product_name}</h3>

            <p>${p.description}</p>

            <p>

              ₹${p.selling_price}

              <span style="text-decoration:line-through">

                ₹${p.mrp}

              </span>

              <span style="color:green">

                (${discountPercent}% OFF)

              </span>

            </p>

            <a href="product.html?id=${p.id}"
               class="btn-primary">

              View Details

            </a>

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
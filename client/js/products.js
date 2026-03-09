// const API = "http://localhost:5000/api";
const grid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");

function loadProducts(search = "") {
  fetch(`https://physiowaye.onrender.com/api/products?search=${search}`)
    .then(res => res.json())
    .then(products => {
      grid.innerHTML = "";

      products.forEach(p => {
        grid.innerHTML += `
          <div class="feature-card">
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <p>
              ₹${p.price}
              <span style="text-decoration:line-through">₹${p.mrp}</span>
              <span style="color:green">(${p.discount}% OFF)</span>
            </p>
            <a href="product.html?id=${p.id}" class="btn-primary">
              View Details
            </a>
          </div>
        `;
      });
    });
}

loadProducts();
searchInput.addEventListener("input", e => loadProducts(e.target.value));

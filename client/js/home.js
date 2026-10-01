const featuredGrid = document.getElementById("homeFeaturedProducts");

if (featuredGrid) {
  apiFetch("/products")
    .then(response => {
      if (!response.ok) throw new Error("Could not load products");
      return response.json();
    })
    .then(products => {
      featuredGrid.replaceChildren();
      (Array.isArray(products) ? products.slice(0, 4) : []).forEach(product => {
        const link = document.createElement("a");
        link.className = "home-product-card";
        link.href = `product.html?id=${encodeURIComponent(product.id)}`;
        const imageWrap = document.createElement("div");
        imageWrap.className = "home-product-image";
        const image = document.createElement("img");
        image.src = product.image_url || (product.sku ? `assets/images/products/${String(product.sku).toLowerCase()}.jpg` : "");
        image.alt = product.product_name || "Physiotherapy equipment";
        image.loading = "lazy";
        image.onerror = () => { imageWrap.textContent = "Physiotherapy equipment"; imageWrap.classList.add("product-media-placeholder"); };
        imageWrap.append(image);
        const details = document.createElement("div");
        details.className = "home-product-details";
        const name = document.createElement("h3");
        name.textContent = product.product_name || "Physiotherapy equipment";
        const price = document.createElement("strong");
        price.textContent = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(product.selling_price) || 0);
        const action = document.createElement("span");
        action.className = "home-product-action";
        action.textContent = "View product  ↗";
        details.append(name, price, action);
        link.append(imageWrap, details);
        featuredGrid.append(link);
      });
      if (!featuredGrid.children.length) featuredGrid.innerHTML = '<p class="home-loading">Products will be available here soon. <a href="products.html">Browse the store</a></p>';
    })
    .catch(error => {
      console.error("Unable to load home page products:", error);
      featuredGrid.innerHTML = '<p class="home-loading">See the full range in <a href="products.html">our product store</a>.</p>';
    });
}

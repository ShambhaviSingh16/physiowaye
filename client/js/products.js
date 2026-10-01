const grid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");
const productsStatus = document.getElementById("productsStatus");
const formatINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-modern";
  card.dataset.productId = product.id;
  card.setAttribute("aria-label", product.product_name || "Physiotherapy equipment");
  const detailsUrl = `product.html?id=${encodeURIComponent(product.id)}`;

  const media = document.createElement("div");
  media.className = "product-media";

  const localImage = product.sku
    ? `assets/images/products/${String(product.sku).toLowerCase()}.jpg`
    : null;
  const imageSource = product.image_url || localImage;

  if (imageSource) {
    const image = document.createElement("img");
    image.src = imageSource;
    image.alt = product.product_name || "Physiotherapy equipment";
    image.loading = "lazy";
    image.onerror = () => {
      if (product.image_url && localImage) {
        image.src = localImage;
        image.onerror = () => showImageFallback(media);
        return;
      }
      image.remove();
      showImageFallback(media);
    };
    media.append(image);
  } else {
    showImageFallback(media);
  }

  const detailsLink = document.createElement("a");
  detailsLink.className = "product-card-link";
  detailsLink.href = detailsUrl;
  detailsLink.setAttribute("aria-label", `View details for ${product.product_name || "this product"}`);

  const content = document.createElement("div");
  content.className = "product-content";

  const discount = Number(product.mrp) > 0
    ? Math.max(0, Math.round((1 - Number(product.selling_price) / Number(product.mrp)) * 100))
    : 0;

  if (discount > 0) {
    const badge = document.createElement("span");
    badge.className = "discount-badge";
    badge.textContent = `${discount}% off`;
    content.append(badge);
  }

  const title = document.createElement("h2");
  title.textContent = product.product_name || "Physiotherapy equipment";

  const description = document.createElement("p");
  description.className = "product-description";
  const fullDescription = product.description || "Quality equipment for physiotherapy and rehabilitation.";
  description.textContent = fullDescription.length > 118
    ? `${fullDescription.slice(0, 118).trim()}…`
    : fullDescription;

  const priceRow = document.createElement("div");
  priceRow.className = "product-price-row";

  const price = document.createElement("strong");
  price.className = "product-price";
  price.textContent = formatINR.format(Number(product.selling_price) || 0);
  priceRow.append(price);

  if (Number(product.mrp) > Number(product.selling_price)) {
    const mrp = document.createElement("del");
    mrp.textContent = formatINR.format(Number(product.mrp));
    priceRow.append(mrp);
  }

  content.append(title, description, priceRow);
  detailsLink.append(media, content);

  const actions = document.createElement("div");
  actions.className = "product-card-actions";
  const inStock = Number(product.stock) > 0;

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "product-card-button product-card-add";
  addButton.textContent = inStock ? "Add to cart" : "Out of stock";
  addButton.disabled = !inStock;
  addButton.addEventListener("click", () => addCatalogProductToCart(product.id, addButton));

  const buyButton = document.createElement("button");
  buyButton.type = "button";
  buyButton.className = "product-card-button product-card-buy";
  buyButton.textContent = "Buy now";
  buyButton.disabled = !inStock;
  buyButton.addEventListener("click", () => buyCatalogProductNow(product.id, buyButton));

  actions.append(addButton, buyButton);
  card.append(detailsLink, actions);
  card.addEventListener("click", event => {
    if (!event.target.closest("a, button")) window.location.href = detailsUrl;
  });
  card.addEventListener("keydown", event => {
    if (event.target === card && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      window.location.href = detailsUrl;
    }
  });
  card.tabIndex = 0;
  card.setAttribute("role", "group");
  return card;
}

async function requireCatalogSession(action, productId) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return true;
  sessionStorage.setItem("physiowaye_pending_purchase", JSON.stringify({ action, productId }));
  window.location.href = "login.html";
  return false;
}

async function addCatalogProductToCart(productId, button) {
  if (!(await requireCatalogSession("add", productId))) return;
  button.disabled = true;
  try {
    const response = await apiFetch("/cart", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity: 1 })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not add this item");
    showToast("Added to your cart");
    updateCartCount();
  } catch (error) {
    console.error("Cart request failed:", error);
    showToast("We couldn’t add this item. Please try again.");
  } finally {
    button.disabled = false;
  }
}

async function buyCatalogProductNow(productId, button) {
  if (!(await requireCatalogSession("buyNow", productId))) return;
  button.disabled = true;
  window.location.href = `checkout.html?buyNow=${encodeURIComponent(productId)}`;
}

function showImageFallback(media) {
  media.classList.add("product-media-placeholder");
  media.textContent = "Physiotherapy equipment";
}

async function loadProducts(search = "") {
  productsStatus.textContent = "Loading products…";
  grid.setAttribute("aria-busy", "true");

  try {
    const response = await apiFetch(`/products?search=${encodeURIComponent(search.trim())}`);
    if (!response.ok) throw new Error("Product request failed");

    const products = await response.json();
    grid.replaceChildren();

    if (!Array.isArray(products) || products.length === 0) {
      productsStatus.textContent = search.trim()
        ? "No products match your search. Try a different term."
        : "No products are available right now.";
      return;
    }

    products.forEach(product => grid.append(createProductCard(product)));
    productsStatus.textContent = `${products.length} ${products.length === 1 ? "product" : "products"} available`;
  } catch (error) {
    console.error("Unable to load products:", error);
    productsStatus.textContent = "We couldn’t load products. Please try again.";
  } finally {
    grid.removeAttribute("aria-busy");
  }
}

let searchTimer;
searchInput.addEventListener("input", event => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadProducts(event.target.value), 250);
});

const initialSearch = new URLSearchParams(window.location.search).get("search") || "";
searchInput.value = initialSearch;
loadProducts(initialSearch);

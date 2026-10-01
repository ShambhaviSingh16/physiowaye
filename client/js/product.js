const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const productCard = document.getElementById("productCard");
const formatINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function renderProduct(product) {
  productCard.replaceChildren();

  const layout = document.createElement("div");
  layout.className = "product-detail-layout";

  const visual = document.createElement("div");
  visual.className = "product-gallery";
  const sku = String(product.sku || "").toLowerCase();
  const localImage = sku ? `assets/images/products/${sku}.jpg` : null;
  const viewsImage = sku ? `assets/images/products/${sku}-views.jpg` : null;
  const gallerySheetUrl = viewsImage ? new URL(viewsImage, document.baseURI).href : (localImage ? new URL(localImage, document.baseURI).href : "");
  const galleryMain = document.createElement("div");
  galleryMain.className = "product-detail-visual product-gallery-stage";
  galleryMain.setAttribute("role", "group");
  galleryMain.setAttribute("aria-roledescription", "carousel");

  const slides = [{ type: "image", src: product.image_url || localImage, label: "Product overview" }];
  if (viewsImage) {
    [
      ["0% 0%", "Front view"], ["100% 0%", "Side view"],
      ["0% 100%", "Control panel detail"], ["100% 100%", "Included accessories"]
    ].forEach(([position, label]) => slides.push({ type: "sheet", position, label }));
  }

  const galleryFrame = document.createElement("div");
  galleryFrame.className = "product-gallery-frame";
  galleryMain.append(galleryFrame);

  const galleryPrevious = document.createElement("button");
  galleryPrevious.type = "button";
  galleryPrevious.className = "product-gallery-arrow product-gallery-arrow-previous";
  galleryPrevious.setAttribute("aria-label", "Show previous product image");
  galleryPrevious.textContent = "\u2039";

  const galleryNext = document.createElement("button");
  galleryNext.type = "button";
  galleryNext.className = "product-gallery-arrow product-gallery-arrow-next";
  galleryNext.setAttribute("aria-label", "Show next product image");
  galleryNext.textContent = "\u203a";
  galleryMain.append(galleryPrevious, galleryNext);
  visual.append(galleryMain);

  const galleryThumbs = document.createElement("div");
  galleryThumbs.className = "product-gallery-thumbs";
  galleryThumbs.setAttribute("aria-label", "Choose a product view");
  let activeSlide = 0;
  let autoAdvanceTimer;
  const renderSlide = (index, direction = 1) => {
    activeSlide = (index + slides.length) % slides.length;
    const slide = slides[activeSlide];
    const entering = document.createElement("div");
    entering.className = `product-gallery-frame gallery-enter-${direction > 0 ? "next" : "previous"}`;
    entering.setAttribute("aria-hidden", "true");

    if (slide.type === "image") {
      const photo = document.createElement("img");
      photo.alt = "";
      photo.src = slide.src || "";
      photo.onerror = () => {
        if (product.image_url && localImage && photo.src !== new URL(localImage, document.baseURI).href) {
          photo.src = new URL(localImage, document.baseURI).href;
        } else {
          galleryFrame.classList.add("product-gallery-image-fallback");
          galleryFrame.replaceChildren();
          galleryFrame.textContent = "Physiotherapy equipment";
        }
      };
      entering.append(photo);
    } else {
      entering.classList.add("product-gallery-sheet");
      entering.style.backgroundImage = `url("${gallerySheetUrl}")`;
      entering.style.backgroundPosition = slide.position;
    }

    galleryFrame.className = "product-gallery-frame";
    void galleryFrame.offsetWidth;
    galleryFrame.className = entering.className;
    galleryFrame.replaceChildren(...entering.childNodes);
    galleryFrame.style.backgroundImage = entering.style.backgroundImage;
    galleryFrame.style.backgroundPosition = entering.style.backgroundPosition;
    galleryMain.setAttribute("aria-label", `${slide.label}, image ${activeSlide + 1} of ${slides.length}`);
    galleryThumbs.querySelectorAll("button").forEach((button, buttonIndex) => {
      button.setAttribute("aria-current", buttonIndex === activeSlide ? "true" : "false");
    });
  };

  const setView = (button, slide, index) => {
    button.type = "button";
    button.className = "product-gallery-thumb";
    button.setAttribute("aria-label", `Show ${slide.label.toLowerCase()}`);
    if (slide.type === "image") {
      const thumbnail = document.createElement("img");
      thumbnail.src = slide.src || "";
      thumbnail.alt = "";
      thumbnail.onerror = () => { thumbnail.src = localImage || ""; };
      button.append(thumbnail);
    } else {
      button.style.backgroundImage = `url("${gallerySheetUrl}")`;
      button.style.backgroundPosition = slide.position;
    }
    button.addEventListener("click", () => {
      renderSlide(index, index >= activeSlide ? 1 : -1);
    });
    galleryThumbs.append(button);
  };
  slides.forEach((slide, index) => setView(document.createElement("button"), slide, index));
  renderSlide(0);
  galleryPrevious.addEventListener("click", () => renderSlide(activeSlide - 1, -1));
  galleryNext.addEventListener("click", () => renderSlide(activeSlide + 1, 1));

  const stopAutoAdvance = () => {
    window.clearInterval(autoAdvanceTimer);
    autoAdvanceTimer = undefined;
  };
  const startAutoAdvance = () => {
    if (autoAdvanceTimer || slides.length < 2 || document.hidden) return;
    autoAdvanceTimer = window.setInterval(() => renderSlide(activeSlide + 1, 1), 4500);
  };
  visual.addEventListener("pointerenter", event => {
    if (event.pointerType !== "touch") startAutoAdvance();
  });
  visual.addEventListener("pointerleave", stopAutoAdvance);
  visual.addEventListener("focusin", startAutoAdvance);
  visual.addEventListener("focusout", event => {
    if (!visual.contains(event.relatedTarget)) stopAutoAdvance();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAutoAdvance();
    else if (visual.matches(":hover")) startAutoAdvance();
  });

  visual.append(galleryThumbs);
  const imageNote = document.createElement("p");
  imageNote.className = "product-image-note";
  imageNote.textContent = "Illustrative product views. Please confirm exact model details with our team.";
  visual.append(imageNote);

  const info = document.createElement("div");
  info.className = "product-detail-info";

  const category = document.createElement("span");
  category.className = "eyebrow";
  category.textContent = product.sku ? `PHYSIOWAYE  /  ${product.sku}` : "PHYSIOWAYE EQUIPMENT";

  const title = document.createElement("h1");
  title.textContent = product.product_name || "Physiotherapy equipment";

  const description = document.createElement("p");
  description.className = "product-desc";
  description.textContent = product.description || "Product details will be available soon.";

  const price = document.createElement("div");
  price.className = "product-detail-price";
  const selling = document.createElement("strong");
  selling.textContent = formatINR.format(Number(product.selling_price) || 0);
  price.append(selling);
  if (Number(product.mrp) > Number(product.selling_price)) {
    const mrp = document.createElement("del");
    mrp.textContent = formatINR.format(Number(product.mrp));
    price.append(mrp);
  }

  const stock = document.createElement("p");
  const inStock = Number(product.stock) > 0;
  stock.className = inStock ? "stock-status" : "stock-status stock-unavailable";
  stock.textContent = inStock ? "In stock and ready to order" : "Currently out of stock";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn-primary product-add-button";
  addButton.textContent = inStock ? "Add to cart" : "Unavailable";
  addButton.disabled = !inStock;
  addButton.addEventListener("click", () => addToCart(product.id));

  const buyButton = document.createElement("button");
  buyButton.type = "button";
  buyButton.className = "product-buy-now-button";
  buyButton.textContent = inStock ? "Buy now" : "Unavailable";
  buyButton.disabled = !inStock;
  buyButton.addEventListener("click", () => buyNow(product.id, buyButton));

  const purchaseActions = document.createElement("div");
  purchaseActions.className = "product-detail-actions";
  purchaseActions.append(addButton, buyButton);

  const benefits = document.createElement("div");
  benefits.className = "trust-badges";
  ["Secure checkout", "Support when you need it", "Carefully selected equipment"].forEach(text => {
    const item = document.createElement("span");
    item.textContent = text;
    benefits.append(item);
  });

  info.append(category, title, description, price, stock, purchaseActions, benefits);
  layout.append(visual, info);
  productCard.append(layout);
}

function showImageFallback(visual) {
  visual.classList.add("product-media-placeholder");
  visual.textContent = "Physiotherapy equipment";
}

async function loadProduct() {
  if (!productId) {
    productCard.innerHTML = '<p class="products-status">This product link is incomplete.</p>';
    return;
  }

  try {
    const response = await apiFetch(`/products/${encodeURIComponent(productId)}`);
    if (!response.ok) throw new Error("Product not found");
    renderProduct(await response.json());
  } catch (error) {
    console.error("Unable to load product:", error);
    productCard.innerHTML = '<div class="catalog-empty"><h1>Product unavailable</h1><p>We couldn’t load this product. Please return to the catalog and try again.</p><a class="btn-primary" href="products.html">Browse products</a></div>';
  }
}

async function addToCart(id) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    sessionStorage.setItem("physiowaye_pending_purchase", JSON.stringify({ action: "add", productId: id }));
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await apiFetch("/cart", {
      method: "POST",
      body: JSON.stringify({ product_id: id, quantity: 1 })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not add this item");
    showToast("Added to your cart");
    updateCartCount();
  } catch (error) {
    console.error("Cart request failed:", error);
    showToast("We couldn’t add this item. Please try again.");
  }
}

async function buyNow(id, button) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    sessionStorage.setItem("physiowaye_pending_purchase", JSON.stringify({ action: "buyNow", productId: id }));
    window.location.href = "login.html";
    return;
  }

  button.disabled = true;
  window.location.href = `checkout.html?buyNow=${encodeURIComponent(id)}`;
}

loadProduct();

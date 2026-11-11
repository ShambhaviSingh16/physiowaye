/* =========================================
   LOGIN WITH EMAIL
========================================= */

async function login() {

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value.trim();

  const error =
    document.getElementById("loginError");

  error.innerText = "";

  if (!email || !password) {
    error.innerText = "All fields required";
    return;
  }

  const { data, error: authError } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (authError) {
    error.innerText = authError.message;
    return;
  }

  sessionStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );

  try { await syncGuestCart(); }
  catch (syncError) { error.innerText = syncError.message; return; }

  if (await completePendingPurchase()) return;

  window.location.href = "products.html";
}

/* =========================================
   REGISTER WITH EMAIL
========================================= */

async function register() {

  const name =
    document.getElementById("name").value.trim();

  const email =
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value.trim();

  const error =
    document.getElementById("error");

  error.innerText = "";

  if (!name || !email || !password) {
    error.innerText = "All fields required";
    return;
  }

  const { data, error: authError } =
    await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

  if (authError) {
    error.innerText = authError.message;
    return;
  }

  alert(
    "Registration successful. Please verify your email."
  );

  window.location.href = "login.html";
}

/* =========================================
   GOOGLE LOGIN
========================================= */

async function googleLogin() {

  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("login.html", window.location.href).href
    }
  });

}

document.addEventListener("DOMContentLoaded", () => {

  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await login();
    });
  }

  const registerForm =
    document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await register();
    });
  }

  const googleBtn =
    document.getElementById("googleLoginBtn");

  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      await googleLogin();
    });
  }

});

/* =========================================
   NAVBAR CONTROL
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    const loginBtn =
      document.getElementById("loginBtn");

    const logoutBtn =
      document.getElementById("logoutBtn");

    const cartBtn =
      document.getElementById("cartBtn");

    const ordersBtn =
      document.getElementById("ordersBtn");

    const profileBtn =
      document.getElementById("profileBtn");

    if (session) {

      sessionStorage.setItem(
        "user",
        JSON.stringify(session.user)
      );

      loginBtn?.classList.add("hidden");
      logoutBtn?.classList.remove("hidden");
      cartBtn?.classList.remove("hidden");
      ordersBtn?.classList.remove("hidden");
      profileBtn?.classList.remove("hidden");

      let cartSynced = true;
      try { await syncGuestCart(); }
      catch (syncError) {
        cartSynced = false;
        console.error(syncError);
        const loginError = document.getElementById('loginError');
        if (loginError) loginError.textContent = syncError.message;
      }

      if (cartSynced && await completePendingPurchase()) return;

    } else {

      loginBtn?.classList.remove("hidden");
      logoutBtn?.classList.add("hidden");
      cartBtn?.classList.remove("hidden");
      ordersBtn?.classList.add("hidden");
      profileBtn?.classList.add("hidden");
    }

    updateCartCount();

  }
);

async function completePendingPurchase() {
  const savedAction = sessionStorage.getItem("physiowaye_pending_purchase");
  if (!savedAction) return false;

  let pending;
  try {
    pending = JSON.parse(savedAction);
  } catch {
    sessionStorage.removeItem("physiowaye_pending_purchase");
    return false;
  }

  if (pending.action === 'checkoutCart') {
    sessionStorage.removeItem('physiowaye_pending_purchase');
    window.location.replace('checkout.html');
    return true;
  }
  const productId = String(pending.productId || "");
  if (!/^[\w-]+$/.test(productId)) {
    sessionStorage.removeItem("physiowaye_pending_purchase");
    return false;
  }

  sessionStorage.removeItem("physiowaye_pending_purchase");
  if (pending.action === "buyNow") {
    window.location.replace(`checkout.html?buyNow=${encodeURIComponent(productId)}`);
    return true;
  }

  if (pending.action === "add") {
    try {
      const response = await apiFetch("/cart", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not add this item");
      window.location.replace("cart.html");
      return true;
    } catch (error) {
      console.error("Pending cart action failed:", error);
      const loginError = document.getElementById("loginError");
      if (loginError) loginError.textContent = "You’re signed in, but we couldn’t add that item. Please try again from the product page.";
      return true;
    }
  }

  return false;
}

async function updateCartCount() {

  const user =
    JSON.parse(
      sessionStorage.getItem("user")
    );

  if (!user) {
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = guestCartItems().reduce((sum, item) => sum + item.quantity, 0);
    return;
  }

  try {

    const res = await apiFetch(`/cart/${user.id}`);

    const cart = await res.json();

    let total = 0;

    cart.forEach(item => {
      total += item.quantity;
    });

    const badge =
      document.getElementById("cartCount");

    if (badge) {
      badge.innerText = total;
    }

  } catch (err) {

    console.error(
      "Cart Count Error:",
      err
    );

  }

}

/* =========================================
   LOGOUT
========================================= */

document
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    async (event) => {

      event.preventDefault();

      await supabaseClient.auth.signOut();

      sessionStorage.removeItem("user");

      window.location.href =
        "index.html";

    }
  );


let activeToast = null;
let activeToastTimer = null;

function showToast(message, options = {}) {
  if (activeToast) activeToast.remove();
  window.clearTimeout(activeToastTimer);

  const type = options.type === "error" ? "error" : "success";
  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  if (options.announce === false) {
    toast.setAttribute("aria-hidden", "true");
  } else {
    toast.setAttribute("role", type === "error" ? "alert" : "status");
  }
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "error" ? "!" : "✓";

  const copy = document.createElement("div");
  copy.className = "toast-copy";
  const heading = document.createElement("strong");
  heading.textContent = options.title || (type === "error" ? "Please try again" : "All set");
  const detail = document.createElement("span");
  detail.textContent = message;
  copy.append(heading, detail);

  toast.append(icon, copy);
  if (options.actionHref && options.actionLabel) {
    const action = document.createElement("a");
    action.className = "toast-action";
    action.href = options.actionHref;
    action.textContent = options.actionLabel;
    toast.append(action);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "toast-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.textContent = "×";
  toast.append(dismiss);

  const close = () => {
    window.clearTimeout(activeToastTimer);
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 200);
    if (activeToast === toast) activeToast = null;
  };
  const startDismissTimer = () => {
    window.clearTimeout(activeToastTimer);
    activeToastTimer = window.setTimeout(close, type === "error" ? 7000 : 5500);
  };

  dismiss.addEventListener("click", close);
  toast.addEventListener("pointerenter", () => window.clearTimeout(activeToastTimer));
  toast.addEventListener("pointerleave", startDismissTimer);
  toast.addEventListener("focusin", () => window.clearTimeout(activeToastTimer));
  toast.addEventListener("focusout", event => {
    if (!toast.contains(event.relatedTarget)) startDismissTimer();
  });

  document.body.append(toast);
  activeToast = toast;
  window.requestAnimationFrame(() => toast.classList.add("show"));
  startDismissTimer();
}

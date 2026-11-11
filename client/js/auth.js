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
    showToast('Enter your email and password.', { type: 'error', title: 'Sign-in needs details', announce: false });
    return;
  }

  let data, authError;
  try {
    ({ data, error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    }));
  } catch (requestError) { authError = requestError; }

  if (authError) {
    error.innerText = authError.message || 'Please try again.';
    showToast(error.innerText, { type: 'error', title: 'Could not sign in', announce: false });
    return;
  }

  sessionStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );

  try { await syncGuestCart(); }
  catch (syncError) {
    error.innerText = syncError.message;
    showToast('Your cart could not be synced. Please try again.', { type: 'error', title: 'Cart sync failed', announce: false });
    return;
  }

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
    showToast('Enter your name, email and password.', { type: 'error', title: 'Complete your details', announce: false });
    return;
  }

  let authError;
  try {
    ({ error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    }));
  } catch (requestError) { authError = requestError; }

  if (authError) {
    error.innerText = authError.message || 'Please try again.';
    showToast(error.innerText, { type: 'error', title: 'Account not created', announce: false });
    return;
  }

  showToastAfterNavigation('Check your email for the verification link, then sign in.', { title: 'Account created' });

  window.location.href = "login.html";
}

/* =========================================
   GOOGLE LOGIN
========================================= */

async function googleLogin() {
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("login.html", window.location.href).href
      }
    });
    if (error) throw error;
  } catch (error) {
    showToast(error.message || 'Please try again.', { type: 'error', title: 'Google sign-in unavailable' });
  }

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
      showToast('Please try again from the product page.', { type: 'error', title: 'Item not added', announce: false });
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



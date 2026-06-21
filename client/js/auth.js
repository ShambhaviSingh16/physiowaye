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
      redirectTo:
        "https://physiowaye.com/products.html"
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

    if (session) {

      sessionStorage.setItem(
        "user",
        JSON.stringify(session.user)
      );

      loginBtn?.classList.add("hidden");
      logoutBtn?.classList.remove("hidden");
      cartBtn?.classList.remove("hidden");

    } else {

      loginBtn?.classList.remove("hidden");
      logoutBtn?.classList.add("hidden");
      cartBtn?.classList.add("hidden");

    }

    updateCartCount();

  }
);

function updateCartCount() {

  const user =
    JSON.parse(
      sessionStorage.getItem("user")
    );

  if (!user) return;

  const cart =
    JSON.parse(
      localStorage.getItem(
        "cart_" + user.id
      )
    ) || [];

  let total = 0;

  cart.forEach(i => total += i.qty);

  const badge =
    document.getElementById("cartCount");

  if (badge)
    badge.innerText = total;

}

/* =========================================
   LOGOUT
========================================= */

document
  .getElementById("logoutBtn")
  ?.addEventListener(
    "click",
    async () => {

      await supabaseClient.auth.signOut();

      sessionStorage.removeItem("user");

      window.location.href =
        "index.html";

    }
  );
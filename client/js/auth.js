const API = "http://localhost:5000/api";

/* ---------- LOGIN ---------- */
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("loginError");

  error.innerText = "";

  if (!email || !password) {
    error.innerText = "All fields required";
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      error.innerText = data.message;
      return;
    }

    sessionStorage.setItem("user", JSON.stringify(data));
    window.location.href = "products.html";

  } catch {
    error.innerText = "Server not reachable";
  }
}

/* ---------- REGISTER ---------- */
async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  error.innerText = "";

  if (!name || !email || !password) {
    error.innerText = "All fields required";
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      error.innerText = data.message;
      return;
    }

    alert("Registration successful. Please login.");
    window.location.href = "login.html";

  } catch {
    error.innerText = "Server not reachable";
  }
}

/* ---------- NAVBAR CONTROL ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = sessionStorage.getItem("user");
  const loginBtn = document.getElementById("loginBtn");
  const cartBtn = document.getElementById("cartBtn");

  if (user) {
    loginBtn?.classList.add("hidden");
    cartBtn?.classList.remove("hidden");
  } else {
    loginBtn?.classList.remove("hidden");
    cartBtn?.classList.add("hidden");
  }
});

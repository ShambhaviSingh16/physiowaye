document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  const navItems = navLinks.querySelectorAll("a");

  // Toggle menu open / close using SAME icon
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.contains("active");

    if (isOpen) {
      navLinks.classList.remove("active");
      menuToggle.classList.remove("active"); // back to ☰
    } else {
      navLinks.classList.add("active");
      menuToggle.classList.add("active"); // transform to ✖
    }
  });

  // Close menu when any nav link is clicked
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navLinks.classList.remove("active");
      menuToggle.classList.remove("active");
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (!menuToggle || !navLinks) return;

  const setOpen = open => {
    navLinks.classList.toggle('active', open);
    menuToggle.classList.toggle('active', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  menuToggle.addEventListener('click', () => {
    setOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });
  navLinks.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!navLinks.contains(event.target) && !menuToggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menuToggle.focus();
    }
  });
});

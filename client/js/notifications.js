let activeToast = null;
let activeToastTimer = null;

function showToast(message, options = {}) {
  if (activeToast) activeToast.remove();
  window.clearTimeout(activeToastTimer);

  const type = options.type === 'error' ? 'error' : options.type === 'info' ? 'info' : 'success';
  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  if (options.announce === false) {
    toast.setAttribute('role', 'group');
    toast.setAttribute('aria-label', 'Notification');
  } else {
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  }

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = type === 'error' ? '!' : type === 'info' ? 'i' : '✓';

  const copy = document.createElement('div');
  copy.className = 'toast-copy';
  const heading = document.createElement('strong');
  heading.textContent = options.title || (type === 'error' ? 'Please try again' : type === 'info' ? 'Heads up' : 'All set');
  const detail = document.createElement('span');
  detail.textContent = message;
  copy.append(heading, detail);
  toast.append(icon, copy);

  if (options.actionHref && options.actionLabel) {
    const action = document.createElement('a');
    action.className = 'toast-action';
    action.href = options.actionHref;
    action.textContent = options.actionLabel;
    toast.append(action);
  }

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '×';
  toast.append(dismiss);

  const close = () => {
    if (activeToast !== toast) { toast.remove(); return; }
    window.clearTimeout(activeToastTimer);
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 200);
    if (activeToast === toast) activeToast = null;
  };
  const startDismissTimer = () => {
    if (activeToast !== toast) return;
    window.clearTimeout(activeToastTimer);
    activeToastTimer = window.setTimeout(close, type === 'error' ? 7000 : 5500);
  };

  dismiss.addEventListener('click', close);
  toast.addEventListener('pointerenter', () => window.clearTimeout(activeToastTimer));
  toast.addEventListener('pointerleave', startDismissTimer);
  toast.addEventListener('focusin', () => window.clearTimeout(activeToastTimer));
  toast.addEventListener('focusout', event => {
    if (!toast.contains(event.relatedTarget)) startDismissTimer();
  });

  document.body.append(toast);
  activeToast = toast;
  window.requestAnimationFrame(() => toast.classList.add('show'));
  startDismissTimer();
}

function showToastAfterNavigation(message, options = {}) {
  try {
    sessionStorage.setItem('physiowaye_flash_notice', JSON.stringify({ message, options }));
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  let saved;
  try {
    saved = sessionStorage.getItem('physiowaye_flash_notice');
    sessionStorage.removeItem('physiowaye_flash_notice');
  } catch (_) { return; }
  if (!saved) return;
  try {
    const notice = JSON.parse(saved);
    if (typeof notice.message === 'string' && notice.message) showToast(notice.message, notice.options || {});
  } catch (_) {}
});

const contactForm = document.getElementById('contactForm');
contactForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const button = contactForm.querySelector('[type="submit"]');
  const status = document.getElementById('contactStatus');
  const fields = new FormData(contactForm);
  button.disabled = true;
  status.dataset.state = 'sending';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Sending your message…';
  try {
    const response = await fetch(`${API_BASE_URL}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fields))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Your message could not be sent.');
    contactForm.reset();
    status.dataset.state = 'success';
    status.textContent = 'Message sent. Our team will reply by email.';
    showToast('Our team will reply by email.', { title: 'Message sent', announce: false });
  } catch (error) {
    status.dataset.state = 'error';
    status.setAttribute('role', 'alert');
    status.setAttribute('aria-live', 'assertive');
    status.textContent = error.message || 'Your message could not be sent. Please email physiowaye@gmail.com directly.';
    showToast('Please try again or email us directly.', { type: 'error', title: 'Message not sent', announce: false });
  } finally {
    button.disabled = false;
  }
});

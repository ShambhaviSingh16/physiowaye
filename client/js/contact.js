const contactForm = document.getElementById('contactForm');
contactForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const button = contactForm.querySelector('[type="submit"]');
  const status = document.getElementById('contactStatus');
  const fields = new FormData(contactForm);
  button.disabled = true;
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
    status.textContent = 'Message sent. Our team will reply by email.';
  } catch (error) {
    status.textContent = `${error.message} You can also email physiowaye@gmail.com.`;
  } finally {
    button.disabled = false;
  }
});

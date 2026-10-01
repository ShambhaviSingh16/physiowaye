const contactForm = document.getElementById("contactForm");

contactForm?.addEventListener("submit", event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const fields = new FormData(contactForm);
  const subject = `PhysioWaye website enquiry from ${fields.get("name")}`;
  const body = [
    `Name: ${fields.get("name")}`,
    `Email: ${fields.get("email")}`,
    "",
    fields.get("message")
  ].join("\n");

  window.location.href = `mailto:physiowaye@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

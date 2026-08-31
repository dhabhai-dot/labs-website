const glow = document.querySelector(".cursor-glow");

if (glow) {
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });
}

const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (header && menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
    });
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const modules = Array.from(document.querySelectorAll(".module"));
let activeIndex = 0;

if (modules.length > 0) {
  setInterval(() => {
    modules[activeIndex].classList.remove("active");
    activeIndex = (activeIndex + 1) % modules.length;
    modules[activeIndex].classList.add("active");
  }, 1800);
}

const contactDetails = {
  call: "8769166018",
  whatsapp: "8955189535",
  additional: "9521461494",
  whatsappUrl: "https://wa.me/918955189535"
};

const footer = document.querySelector(".site-footer");

if (footer && !footer.querySelector(".footer-contact-info")) {
  const contactInfo = document.createElement("div");
  contactInfo.className = "footer-contact-info";
  contactInfo.setAttribute("aria-label", "Contact information");
  contactInfo.innerHTML = `<strong>Contact information</strong><a href="tel:${contactDetails.call}">Call: ${contactDetails.call}</a><a href="${contactDetails.whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp: ${contactDetails.whatsapp}</a><a href="tel:${contactDetails.additional}">Additional Contact: ${contactDetails.additional}</a>`;
  footer.appendChild(contactInfo);
}

if (!document.querySelector(".contact-actions")) {
  const actions = document.createElement("nav");
  actions.className = "contact-actions";
  actions.setAttribute("aria-label", "Quick contact options");
  actions.innerHTML = `<a class="contact-action contact-action-call" href="tel:${contactDetails.call}" aria-label="Call L.A.B.S. at ${contactDetails.call}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.5 3 3.7 5.2 6.7 6.7l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.8 22 2 13.2 2 2.6c0-.6.4-1 1-1h4.4c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.1 2.3Z"/></svg><span>Call</span></a><a class="contact-action contact-action-whatsapp" href="${contactDetails.whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Chat with L.A.B.S. on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.5 5.9L.2 23.5 6.2 22a11.8 11.8 0 0 0 5.9 1.5h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.1-1.2-6.1-3.5-8.2Zm-8.4 18a9.9 9.9 0 0 1-5.1-1.4l-.4-.2-3.6.9 1-3.5-.2-.4a9.8 9.8 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.8-9.8 2.6 0 5.1 1 7 2.9a9.8 9.8 0 0 1-7 16.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-1.8-.9-3-1.6-4.2-3.7-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5 0 1.5 1.1 3 1.3 3.2.2.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.8.6.8.3 1.5.2 2.1.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.1-1.4-.1-.1-.3-.2-.6-.3Z"/></svg><span>WhatsApp</span></a>`;
  document.body.appendChild(actions);
}

const contactForm = document.querySelector(".contact-form");
const requiredMessages = {
  fullName: "Full name is required.",
  phone: "Valid mobile number is required.",
  email: "Valid email address is required.",
  companyName: "Company name is required.",
  serviceRequired: "Select the service required.",
  message: "Project description must be at least 10 characters.",
  budget: "Budget is required.",
  timeline: "Timeline is required."
};

let recaptchaSiteKey = "";
let recaptchaReadyPromise = null;

if (contactForm) {
  const submitButton = contactForm.querySelector("button");
  const formStatus = document.createElement("p");
  formStatus.className = "form-status";
  formStatus.setAttribute("role", "status");
  contactForm.appendChild(formStatus);

  loadPublicConfig();

  contactForm.addEventListener("input", (event) => {
    const field = event.target;
    if (field.name) clearFieldError(field);
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(contactForm);
    formStatus.textContent = "";
    formStatus.classList.remove("error", "success");

    const clientErrors = validateContactForm(contactForm);
    if (Object.keys(clientErrors).length > 0) {
      showFieldErrors(contactForm, clientErrors);
      formStatus.textContent = "Please check the highlighted fields.";
      formStatus.classList.add("error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (recaptchaSiteKey) payload.recaptchaToken = await getRecaptchaToken();

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({ ok: false, error: "Unable to read server response." }));

      if (!response.ok || !result.ok) {
        showFieldErrors(contactForm, result.fields || {});
        throw new Error(result.error || "Something went wrong. Please try again.");
      }

      contactForm.reset();
      formStatus.textContent = result.message || "Thanks. Your project request has been received.";
      formStatus.classList.add("success");
    } catch (error) {
      formStatus.textContent = error.message || "Unable to send right now. Please try again.";
      formStatus.classList.add("error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send";
    }
  });
}

async function loadPublicConfig() {
  try {
    const response = await fetch("/api/config", { credentials: "same-origin" });
    const result = await response.json();
    recaptchaSiteKey = result?.recaptchaSiteKey || "";
    if (recaptchaSiteKey) recaptchaReadyPromise = loadRecaptcha(recaptchaSiteKey);
  } catch {
    recaptchaSiteKey = "";
  }
}

function loadRecaptcha(siteKey) {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.execute) return resolve();
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => window.grecaptcha.ready(resolve);
    script.onerror = () => reject(new Error("Unable to load form verification. Please try again."));
    document.head.appendChild(script);
  });
}

async function getRecaptchaToken() {
  if (!recaptchaReadyPromise) recaptchaReadyPromise = loadRecaptcha(recaptchaSiteKey);
  await recaptchaReadyPromise;
  return window.grecaptcha.execute(recaptchaSiteKey, { action: "lead_submit" });
}

function validateContactForm(form) {
  const errors = {};
  Array.from(form.elements).forEach((field) => {
    if (!field.name || field.name === "companyWebsite") return;
    if (!field.checkValidity()) errors[field.name] = requiredMessages[field.name] || field.validationMessage;
  });
  return errors;
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => element.remove());
  form.querySelectorAll(".has-error").forEach((element) => element.classList.remove("has-error"));
}

function clearFieldError(field) {
  const label = field.closest("label");
  if (!label) return;
  label.classList.remove("has-error");
  label.querySelectorAll(".field-error").forEach((element) => element.remove());
}

function showFieldErrors(form, fields) {
  Object.entries(fields).forEach(([name, message]) => {
    const field = form.elements.namedItem(name);
    if (!field || name === "companyWebsite") return;

    const label = field.closest("label");
    if (!label) return;

    label.classList.add("has-error");
    const error = document.createElement("small");
    error.className = "field-error";
    error.textContent = message;
    label.appendChild(error);
  });
}

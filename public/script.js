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

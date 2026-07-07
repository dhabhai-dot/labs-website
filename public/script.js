const glow = document.querySelector(".cursor-glow");

if (glow) {
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
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

if (contactForm) {
  const submitButton = contactForm.querySelector("button");
  const formStatus = document.createElement("p");
  formStatus.className = "form-status";
  formStatus.setAttribute("role", "status");
  contactForm.appendChild(formStatus);

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(contactForm);
    formStatus.textContent = "";
    formStatus.classList.remove("error", "success");
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

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

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => element.remove());
  form.querySelectorAll(".has-error").forEach((element) => element.classList.remove("has-error"));
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

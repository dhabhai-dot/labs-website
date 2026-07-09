const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+()\d\s-]{7,24}$/;
const allowedStatuses = new Set(["new", "contacted", "closed"]);

export function validateLeadPayload(payload) {
  const fields = {};
  const value = {
    fullName: cleanString(payload?.fullName ?? payload?.name, 120),
    companyName: cleanString(payload?.companyName, 160),
    email: cleanString(payload?.email, 254).toLowerCase(),
    phone: cleanString(payload?.phone, 32),
    serviceRequired: cleanString(payload?.serviceRequired, 160),
    budget: cleanString(payload?.budget, 120),
    timeline: cleanString(payload?.timeline, 120),
    message: cleanString(payload?.message ?? payload?.project, 4000),
    country: cleanString(payload?.country, 120),
    recaptchaToken: cleanString(payload?.recaptchaToken, 4000),
    companyWebsite: cleanString(payload?.companyWebsite, 200)
  };

  if (value.companyWebsite) fields.companyWebsite = "Spam detected.";
  if (value.fullName.length < 2) fields.fullName = "Full name is required.";
  if (value.companyName.length < 2) fields.companyName = "Company name is required.";
  if (!emailPattern.test(value.email)) fields.email = "Valid email address is required.";
  if (!phonePattern.test(value.phone)) fields.phone = "Valid phone number is required.";
  if (value.serviceRequired.length < 2) fields.serviceRequired = "Select the service required.";
  if (value.budget.length < 2) fields.budget = "Budget is required.";
  if (value.timeline.length < 2) fields.timeline = "Timeline is required.";
  if (value.message.length < 10) fields.message = "Message must be at least 10 characters.";

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value };
}

export function validateStatus(status) {
  const clean = cleanString(status, 24).toLowerCase();
  return allowedStatuses.has(clean) ? clean : null;
}

export function cleanString(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

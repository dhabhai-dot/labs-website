export async function verifyRecaptcha(config, token, ip) {
  const body = new URLSearchParams({ secret: config.recaptchaSecretKey, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const error = new Error("reCAPTCHA verification service unavailable.");
    error.statusCode = 502;
    throw error;
  }

  const result = await response.json();
  const score = Number(result.score || 0);
  const actionOk = !result.action || result.action === "lead_submit";

  if (!result.success || !actionOk || score < config.recaptchaMinScore) {
    const error = new Error("reCAPTCHA verification failed.");
    error.statusCode = 400;
    error.fields = { recaptchaToken: "Please retry the form verification." };
    throw error;
  }

  return score;
}

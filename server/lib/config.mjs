export const configGroups = {
  database: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  admin: ["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "JWT_SECRET"],
  recaptcha: ["RECAPTCHA_SECRET_KEY"],
  email: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "BUSINESS_EMAIL_TO", "BUSINESS_EMAIL_FROM"],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TO_NUMBER"]
};

export function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    siteUrl: process.env.SITE_URL || "http://localhost:3000",
    corsOrigins: splitList(process.env.CORS_ORIGINS || process.env.SITE_URL || "http://localhost:3000"),
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    adminUsername: process.env.ADMIN_USERNAME || "",
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
    jwtSecret: process.env.JWT_SECRET || "",
    jwtCookieName: "labs_admin_session",
    recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || "",
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || "",
    recaptchaMinScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.5),
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || ""
    },
    businessEmailTo: process.env.BUSINESS_EMAIL_TO || "",
    businessEmailFrom: process.env.BUSINESS_EMAIL_FROM || "",
    whatsapp: {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      toNumber: process.env.WHATSAPP_TO_NUMBER || "",
      apiVersion: process.env.WHATSAPP_API_VERSION || "v20.0"
    },
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 20),
    adminRateLimitMax: Number(process.env.ADMIN_RATE_LIMIT_MAX || 60),
    maxBodyBytes: Number(process.env.MAX_REQUEST_BODY_BYTES || 256 * 1024)
  };
}

export function requireConfig(groups) {
  const missing = groups.flatMap((group) => configGroups[group] || []).filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const error = new Error(`Server configuration incomplete: ${missing.join(", ")}`);
    error.statusCode = 503;
    throw error;
  }
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

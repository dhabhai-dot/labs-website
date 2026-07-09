import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getConfig, hasConfig, requireConfig } from "./lib/config.mjs";
import { validateLeadPayload, validateStatus, cleanString } from "./lib/validation.mjs";
import { verifyRecaptcha } from "./lib/recaptcha.mjs";
import { createLead, deleteLead, getLeadStats, listAllLeads, listLeads, updateLeadStatus } from "./lib/supabase.mjs";
import { sendLeadEmail } from "./lib/email.mjs";
import { sendWhatsAppLead } from "./lib/whatsapp.mjs";
import { clearSessionCookie, createSessionToken, requireAdmin, setSessionCookie, verifyAdminCredentials } from "./lib/auth.mjs";
import { leadsToCsv, leadsToExcelBuffer } from "./lib/exports.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

export function createApp() {
  const config = getConfig();
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
        frameSrc: ["https://www.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  const corsOptions = {
    origin(origin, callback) {
      return callback(null, isAllowedOrigin(config, origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions), (request, response) => response.sendStatus(204));

  app.use(express.json({ limit: config.maxBodyBytes }));
  app.use(cookieParser());

  const contactLimiter = rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax, standardHeaders: true, legacyHeaders: false });
  const adminLimiter = rateLimit({ windowMs: config.rateLimitWindowMs, max: config.adminRateLimitMax, standardHeaders: true, legacyHeaders: false });
  const adminOnly = requireAdmin(config);

  app.get("/api/health", (request, response) => {
    response.json({ ok: true, service: "labs-lead-management", timestamp: new Date().toISOString() });
  });

  app.get("/api/config", (request, response) => {
    response.json({ ok: true, recaptchaSiteKey: config.recaptchaSiteKey });
  });

  app.post("/api/contact", contactLimiter, asyncHandler(async (request, response) => {
    if (!request.body.country && request.headers["x-vercel-ip-country"]) request.body.country = request.headers["x-vercel-ip-country"];
    const validation = validateLeadPayload(request.body);
    if (!validation.ok) return response.status(400).json({ ok: false, error: "Please check the form and try again.", fields: validation.fields });

    requireConfig(["database"]);

    const visitorIp = getClientIp(request);
    const browser = cleanString(request.headers["user-agent"], 500);
    let recaptchaScore = null;
    if (hasConfig(config, "recaptcha")) {
      if (!validation.value.recaptchaToken) {
        return response.status(400).json({ ok: false, error: "Please retry the form verification.", fields: { recaptchaToken: "reCAPTCHA verification is required." } });
      }
      recaptchaScore = await verifyRecaptcha(config, validation.value.recaptchaToken, visitorIp);
    }

    const lead = await createLead(config, {
      ...validation.value,
      submittedAt: new Date().toISOString(),
      visitorIp,
      browser,
      recaptchaScore
    });

    const notifications = [sendLeadEmail(config, lead)];
    if (hasConfig(config, "whatsapp")) notifications.push(sendWhatsAppLead(config, lead));
    const notificationResults = await Promise.allSettled(notifications);
    for (const result of notificationResults) {
      if (result.status === "rejected") console.error("Lead notification failed", result.reason);
    }

    response.status(200).json({ ok: true, message: "Thanks. Your project request has been received.", id: lead.id });
  }));

  app.use("/api/admin", (request, response, next) => {
    requireConfig(["database", "admin"]);
    next();
  });

  app.post("/api/admin/login", adminLimiter, asyncHandler(async (request, response) => {
    const username = cleanString(request.body?.username, 120);
    const password = String(request.body?.password || "");
    const valid = await verifyAdminCredentials(config, username, password);
    if (!valid) return response.status(401).json({ ok: false, error: "Invalid login." });

    const token = createSessionToken(config);
    setSessionCookie(config, response, token);
    response.json({ ok: true, user: { username } });
  }));

  app.post("/api/admin/logout", adminLimiter, (request, response) => {
    clearSessionCookie(config, response);
    response.json({ ok: true });
  });

  app.get("/api/admin/session", adminLimiter, adminOnly, (request, response) => {
    response.json({ ok: true, user: { username: request.admin.sub } });
  });

  app.get("/api/admin/stats", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    response.json({ ok: true, stats: await getLeadStats(config) });
  }));

  app.get("/api/admin/leads", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    const status = request.query.status ? validateStatus(request.query.status) : null;
    if (request.query.status && !status) return response.status(400).json({ ok: false, error: "Invalid status." });
    const result = await listLeads(config, {
      search: cleanString(request.query.search, 120),
      fromDate: cleanDate(request.query.from),
      toDate: cleanDate(request.query.to),
      status,
      isRead: cleanBoolean(request.query.read),
      page: request.query.page,
      pageSize: request.query.pageSize
    });
    response.json({ ok: true, ...result });
  }));

  app.patch("/api/admin/leads/:id", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    const status = request.body?.status === undefined ? undefined : validateStatus(request.body?.status);
    const isRead = request.body?.isRead === undefined ? undefined : Boolean(request.body.isRead);
    if (request.body?.status !== undefined && !status) return response.status(400).json({ ok: false, error: "Invalid status." });
    if (status === undefined && isRead === undefined) return response.status(400).json({ ok: false, error: "No lead update provided." });
    response.json({ ok: true, lead: await updateLeadStatus(config, request.params.id, { status, isRead }) });
  }));

  app.delete("/api/admin/leads/:id", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    await deleteLead(config, request.params.id);
    response.json({ ok: true });
  }));

  app.get("/api/admin/export.csv", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    const leads = await listAllLeads(config, exportFilters(request));
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="labs-leads.csv"');
    response.send(leadsToCsv(leads));
  }));

  app.get("/api/admin/export.xlsx", adminLimiter, adminOnly, asyncHandler(async (request, response) => {
    const leads = await listAllLeads(config, exportFilters(request));
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", 'attachment; filename="labs-leads.xlsx"');
    response.send(leadsToExcelBuffer(leads));
  }));

  app.use(express.static(publicDir, { extensions: ["html"], maxAge: "1y", immutable: true }));
  app.get("*", (request, response) => response.sendFile(join(publicDir, "index.html")));

  app.use((error, request, response, next) => {
    const statusCode = error.statusCode || 500;
    const payload = { ok: false, error: statusCode === 500 ? "Internal server error." : error.message };
    if (error.fields) payload.fields = error.fields;
    if (statusCode === 500) console.error(error);
    response.status(statusCode).json(payload);
  });

  return app;
}

function isAllowedOrigin(config, origin) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    const protocol = url.protocol;

    if (protocol === "https:" && (hostname === "labs.in" || hostname === "www.labs.in")) return true;
    if (protocol === "https:" && hostname.endsWith(".vercel.app")) return true;
    if (protocol === "http:" && hostname === "localhost" && ["3000", "5173", "4173"].includes(url.port)) return true;
    if (config.corsOrigins.includes(origin)) return true;
  } catch {
    return false;
  }

  return false;
}

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) return forwardedFor.split(",")[0].trim();
  return request.ip || request.socket.remoteAddress || "unknown";
}

function cleanDate(value) {
  const text = cleanString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanBoolean(value) {
  const text = cleanString(value, 12).toLowerCase();
  if (["true", "1", "read"].includes(text)) return true;
  if (["false", "0", "unread"].includes(text)) return false;
  return null;
}

function exportFilters(request) {
  const status = request.query.status ? validateStatus(request.query.status) : null;
  return { fromDate: cleanDate(request.query.from), toDate: cleanDate(request.query.to), status, isRead: cleanBoolean(request.query.read) };
}

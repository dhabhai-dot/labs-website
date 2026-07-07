import { createServer } from "node:http";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { createReadStream, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");
const publicDir = join(rootDir, "public");
const dataDir = join(rootDir, "data");
const submissionsPath = join(dataDir, "contact-submissions.jsonl");

loadEnvFile(join(rootDir, ".env"));

const config = {
  nodeEnv: process.env.NODE_ENV || "production",
  port: Number(process.env.PORT || 3000),
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  adminToken: process.env.ADMIN_TOKEN || "",
  maxBodyBytes: Number(process.env.MAX_REQUEST_BODY_BYTES || 1024 * 1024),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 20)
};

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".webp", "image/webp"]
]);

const rateLimitStore = new Map();

await mkdir(dataDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    applySecurityHeaders(response);
    const url = new URL(request.url || "/", config.siteUrl);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return sendJson(response, 200, {
        ok: true,
        service: "labs-company-website",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContact(request, response);
    }

    if (url.pathname === "/api/submissions" && request.method === "GET") {
      return handleListSubmissions(request, response, url);
    }

    if (url.pathname === "/api/submissions.csv" && request.method === "GET") {
      return handleExportSubmissions(request, response);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(response, 404, { ok: false, error: "API route not found." });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return sendText(response, 405, "Method not allowed");
    }

    return serveStatic(url.pathname, request, response);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? "Internal server error." : error.message;
    if (statusCode === 500) console.error(error);
    return sendJson(response, statusCode, { ok: false, error: message });
  }
});

server.listen(config.port, () => {
  console.log(`L.A.B.S. website running on http://localhost:${config.port}`);
});

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const equalsIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim().replace(/^[\'"]|[\'"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional in production hosts that inject environment variables.
  }
}

async function handleContact(request, response) {
  const clientIp = getClientIp(request);

  if (isRateLimited(clientIp)) {
    return sendJson(response, 429, {
      ok: false,
      error: "Too many requests. Please try again later."
    });
  }

  const body = await readJsonBody(request, config.maxBodyBytes);
  const validation = validateContactPayload(body);

  if (!validation.ok) {
    return sendJson(response, 400, {
      ok: false,
      error: "Please check the form and try again.",
      fields: validation.fields
    });
  }

  const submission = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ip: clientIp,
    userAgent: request.headers["user-agent"] || "",
    ...validation.value
  };

  await appendFile(submissionsPath, `${JSON.stringify(submission)}\n`, "utf8");

  return sendJson(response, 201, {
    ok: true,
    message: "Thanks. Your project request has been received.",
    id: submission.id
  });
}

async function handleListSubmissions(request, response, url) {
  if (!isAuthorizedAdmin(request)) {
    return sendJson(response, 401, { ok: false, error: "Unauthorized." });
  }

  const limit = clampInteger(url.searchParams.get("limit"), 1, 200, 50);
  const submissions = await readSubmissions();

  return sendJson(response, 200, {
    ok: true,
    total: submissions.length,
    submissions: submissions.slice(-limit).reverse()
  });
}

async function handleExportSubmissions(request, response) {
  if (!isAuthorizedAdmin(request)) {
    return sendJson(response, 401, { ok: false, error: "Unauthorized." });
  }

  const submissions = await readSubmissions();
  const headers = ["createdAt", "name", "email", "budget", "timeline", "project", "id"];
  const rows = submissions.map((submission) => headers.map((key) => csvCell(submission[key])).join(","));

  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="labs-contact-submissions.csv"',
    "Cache-Control": "no-store"
  });
  response.end(`${headers.join(",")}\n${rows.join("\n")}`);
}

function validateContactPayload(payload) {
  const fields = {};
  const value = {
    name: cleanString(payload?.name, 120),
    email: cleanString(payload?.email, 254).toLowerCase(),
    project: cleanString(payload?.project, 4000),
    budget: cleanString(payload?.budget, 120),
    timeline: cleanString(payload?.timeline, 120)
  };

  if (cleanString(payload?.companyWebsite, 200)) fields.companyWebsite = "Spam detected.";
  if (value.name.length < 2) fields.name = "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) fields.email = "Valid email is required.";
  if (value.project.length < 10) fields.project = "Please describe the project in at least 10 characters.";

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value };
}

function cleanString(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function readJsonBody(request, maxBytes) {
  const contentType = request.headers["content-type"] || "";
  if (!String(contentType).toLowerCase().includes("application/json")) {
    const error = new Error("Content-Type must be application/json.");
    error.statusCode = 415;
    throw error;
  }

  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

async function readSubmissions() {
  try {
    const content = await readFile(submissionsPath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function serveStatic(pathname, request, response) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = resolve(publicDir, `.${requestedPath}`);

  if (!filePath.startsWith(publicDir)) {
    return sendText(response, 403, "Forbidden");
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return serveIndex(response);

    const extension = extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Content-Length": fileStat.size,
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
    });

    if (request.method === "HEAD") return response.end();
    return createReadStream(filePath).pipe(response);
  } catch {
    return serveIndex(response);
  }
}

async function serveIndex(response) {
  const html = await readFile(join(publicDir, "index.html"), "utf8");
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  response.end(html);
}

function isRateLimited(clientIp) {
  const now = Date.now();
  const bucket = rateLimitStore.get(clientIp) || { resetAt: now + config.rateLimitWindowMs, count: 0 };

  if (bucket.resetAt <= now) {
    bucket.resetAt = now + config.rateLimitWindowMs;
    bucket.count = 0;
  }

  bucket.count += 1;
  rateLimitStore.set(clientIp, bucket);
  return bucket.count > config.rateLimitMax;
}

function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function isAuthorizedAdmin(request) {
  if (!config.adminToken) return false;
  const authorization = request.headers.authorization || "";
  return authorization === `Bearer ${config.adminToken}`;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(text);
}


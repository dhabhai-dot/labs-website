import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const maxAgeSeconds = 60 * 60 * 8;

export async function verifyAdminCredentials(config, username, password) {
  if (!config.adminUsername || !config.adminPasswordHash) return false;
  if (String(username || "") !== config.adminUsername) return false;
  return bcrypt.compare(String(password || ""), config.adminPasswordHash);
}

export function createSessionToken(config) {
  return jwt.sign({ role: "admin", sub: config.adminUsername }, config.jwtSecret, { expiresIn: maxAgeSeconds });
}

export function setSessionCookie(config, response, token) {
  response.cookie(config.jwtCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds * 1000
  });
}

export function clearSessionCookie(config, response) {
  response.clearCookie(config.jwtCookieName, { path: "/" });
}

export function requireAdmin(config) {
  return (request, response, next) => {
    const token = request.cookies?.[config.jwtCookieName] || getBearerToken(request);
    if (!token) return response.status(401).json({ ok: false, error: "Unauthorized." });

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload.role !== "admin") return response.status(403).json({ ok: false, error: "Forbidden." });
      request.admin = payload;
      next();
    } catch {
      return response.status(401).json({ ok: false, error: "Session expired." });
    }
  };
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

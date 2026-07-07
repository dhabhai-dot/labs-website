import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function loadEnvFile(fileUrl) {
  const filePath = fileUrl instanceof URL ? fileURLToPath(fileUrl) : fileUrl;
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
    // Vercel and most production hosts inject environment variables directly.
  }
}

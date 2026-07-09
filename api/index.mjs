import { createApp } from "../server/app.mjs";
import { loadEnvFile } from "../server/lib/env.mjs";

loadEnvFile(new URL("../.env", import.meta.url));

const app = createApp();

export default function handler(request, response) {
  return app(request, response);
}
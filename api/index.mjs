import { createApp } from "../server/app.mjs";

const app = createApp();

export default function handler(request, response) {
  return app(request, response);
}

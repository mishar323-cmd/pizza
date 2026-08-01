// Cloudflare Worker: proxy the Telegram Bot API from a Russian VPS where
// api.telegram.org is blocked by RKN. The backend calls this Worker's URL
// (TG_API_BASE) instead of api.telegram.org; the Worker forwards to Telegram.
//
// Deploy:
//   1. cloudflare.com → Workers & Pages → Create → Create Worker
//   2. Name it e.g. "tg-relay", replace the code with this file, Deploy
//   3. Copy the URL (https://tg-relay.<your-subdomain>.workers.dev)
//   4. Tell Claude the URL — it sets TG_API_BASE + TG_RELAY_SECRET on the server
//
// Security: only requests carrying the matching X-Relay-Secret are forwarded,
// so this is not an open Telegram proxy.

const RELAY_SECRET = "ab1fc6100174f47c0559cf80f52e9e1f";

export default {
  async fetch(request) {
    if (request.headers.get("X-Relay-Secret") !== RELAY_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    const target = "https://api.telegram.org" + url.pathname + url.search;
    const upstream = await fetch(target, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("Content-Type") || "application/json" },
      body: (request.method === "GET" || request.method === "HEAD") ? undefined : await request.arrayBuffer(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};

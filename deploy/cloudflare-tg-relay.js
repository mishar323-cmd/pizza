// Cloudflare Worker: proxy Telegram from a Russian VPS where Telegram hosts are
// blocked by RKN. The backend calls this Worker instead of Telegram directly.
//
// Routes:
//   /bot<token>/<method>  → https://api.telegram.org       (order notifications)
//   /gw/<method>          → https://gatewayapi.telegram.org (login codes via
//                           Telegram Gateway; Authorization header passed on)
//
// Deploy:
//   1. cloudflare.com → Workers & Pages → open the existing "tg-relay" worker
//   2. Replace the code with this file, Deploy
//   3. The URL stays the same — nothing to change on the server
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

    const target = url.pathname.startsWith("/gw/")
      ? "https://gatewayapi.telegram.org/" + url.pathname.slice(4) + url.search
      : "https://api.telegram.org" + url.pathname + url.search;

    const headers = { "Content-Type": request.headers.get("Content-Type") || "application/json" };
    const auth = request.headers.get("Authorization");
    if (auth) headers["Authorization"] = auth;

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: (request.method === "GET" || request.method === "HEAD") ? undefined : await request.arrayBuffer(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};

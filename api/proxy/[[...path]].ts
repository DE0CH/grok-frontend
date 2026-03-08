/**
 * Vercel serverless function: single proxy for (1) media from xAI CDNs and (2) xAI API (t2i, i2i, i2v).
 * Avoids CORS: browser talks to same origin; proxy fetches media or forwards API requests with auth.
 */
const PROXY_PREFIX = "/api/proxy";

// Media: only allow fetching from these CDN origins
const CDN_ORIGINS = ["https://imgen.x.ai/", "https://vidgen.x.ai/"];
function isAllowedCdnUrl(url: string): boolean {
  return CDN_ORIGINS.some((origin) => url.startsWith(origin));
}

// API: only allow these paths to api.x.ai
const XAI_ORIGIN = "https://api.x.ai";
const API_ALLOWED_PATHS = [
  "/v1/images/generations", // t2i
  "/v1/images/edits", // i2i
  "/v1/videos/generations", // i2v start
];
function isAllowedApiPath(pathname: string): boolean {
  if (API_ALLOWED_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/v1/videos/") && /^\/v1\/videos\/[^/]+$/.test(pathname)) return true; // i2v poll
  return false;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathAfterPrefix = url.pathname.replace(new RegExp(`^${PROXY_PREFIX}`), "") || "";

    // 1) Media proxy: GET /api/proxy?url=<cdn-url>
    if (request.method === "GET" && url.searchParams.has("url")) {
      const targetUrl = url.searchParams.get("url")!;
      if (!isAllowedCdnUrl(targetUrl)) {
        return new Response("Bad request", { status: 400 });
      }
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) return new Response("Upstream error", { status: res.status });
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        return new Response(await res.arrayBuffer(), {
          status: 200,
          headers: { "Content-Type": contentType },
        });
      } catch {
        return new Response("Proxy error", { status: 502 });
      }
    }

    // 2) API proxy: /api/proxy/v1/... — forward to api.x.ai with auth + body
    const apiPath = pathAfterPrefix.startsWith("/") ? pathAfterPrefix : `/${pathAfterPrefix}`;
    if (isAllowedApiPath(apiPath)) {
      const targetUrl = `${XAI_ORIGIN}${apiPath}${url.search}`;
      const headers: Record<string, string> = {};
      for (const k of ["authorization", "content-type"]) {
        const v = request.headers.get(k);
        if (v) headers[k] = v;
      }
      const body =
        request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;
      try {
        const res = await fetch(targetUrl, { method: request.method, headers, body });
        const contentType = res.headers.get("content-type");
        const resHeaders: Record<string, string> = {};
        if (contentType) resHeaders["Content-Type"] = contentType;
        return new Response(await res.arrayBuffer(), { status: res.status, headers: resHeaders });
      } catch {
        return new Response("Proxy error", { status: 502 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

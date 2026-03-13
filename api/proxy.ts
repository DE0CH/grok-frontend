/**
 * Proxy for (1) media from xAI CDNs and (2) xAI API (t2i, i2i, i2v).
 * Client sends ?url=<encoded-full-url>; server decodes, checks allowlist, then proxies.
 * Vercel serverless: /api/proxy. Dev: vite middleware uses same handler.
 */
// Media: only allow these CDN origins
const CDN_ORIGINS = ["https://imgen.x.ai/", "https://vidgen.x.ai/"];
function isAllowedCdnUrl(url: string): boolean {
  return CDN_ORIGINS.some((origin) => url.startsWith(origin));
}

// API: only allow these paths on api.x.ai
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

function isAllowedUrl(targetUrl: string): "cdn" | "api" | false {
  try {
    const u = new URL(targetUrl);
    if (isAllowedCdnUrl(targetUrl)) return "cdn";
    if (u.origin === XAI_ORIGIN && isAllowedApiPath(u.pathname)) return "api";
  } catch {
    // invalid URL
  }
  return false;
}

export async function proxyFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const encoded = url.searchParams.get("url");
  if (!encoded) return new Response("Not Found", { status: 404 });

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(encoded);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const allowed = isAllowedUrl(targetUrl);

  if (allowed === "cdn") {
    if (request.method !== "GET") return new Response("Bad request", { status: 400 });
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

  // allowed === "api": forward method, auth, content-type, body
  if (allowed === "api") {
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

  return new Response("Bad request", { status: 400 });
}

export default { fetch: proxyFetch };

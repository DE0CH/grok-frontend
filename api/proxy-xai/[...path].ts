/**
 * Vercel serverless function: proxies t2i, i2i, and i2v requests to xAI API.
 * Used so the browser never hits api.x.ai directly (avoids CORS when xAI omits Allow-Origin).
 */
const XAI_ORIGIN = "https://api.x.ai";
const ALLOWED_PATHS = [
  "/v1/images/generations", // t2i
  "/v1/images/edits", // i2i
  "/v1/videos/generations", // i2v start
];

function isAllowedPath(pathname: string): boolean {
  if (ALLOWED_PATHS.includes(pathname)) return true;
  // i2v poll: /v1/videos/:id
  if (pathname.startsWith("/v1/videos/") && /^\/v1\/videos\/[^/]+$/.test(pathname)) return true;
  return false;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Path is everything after /api/proxy-xai
    const pathname = url.pathname.replace(/^\/api\/proxy-xai/, "") || "/";
    if (!isAllowedPath(pathname)) {
      return new Response("Not Found", { status: 404 });
    }
    const targetUrl = `${XAI_ORIGIN}${pathname}${url.search}`;
    const headers: Record<string, string> = {};
    for (const k of ["authorization", "content-type"]) {
      const v = request.headers.get(k);
      if (v) headers[k] = v;
    }
    const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;
    try {
      const res = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
      });
      const contentType = res.headers.get("content-type");
      const resHeaders: Record<string, string> = {};
      if (contentType) resHeaders["Content-Type"] = contentType;
      return new Response(await res.arrayBuffer(), {
        status: res.status,
        headers: resHeaders,
      });
    } catch {
      return new Response("Proxy error", { status: 502 });
    }
  },
};

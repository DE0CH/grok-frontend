/**
 * Vercel serverless function: fetches media (image/video) from xAI CDNs and returns it.
 * Used so the browser never hits imgen.x.ai or vidgen.x.ai directly (avoids CORS).
 */
const ALLOWED_ORIGINS = ["https://imgen.x.ai/", "https://vidgen.x.ai/"];

function isAllowed(url: string): boolean {
  return ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");
    if (!url || !isAllowed(url)) {
      return new Response("Bad request", { status: 400 });
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return new Response("Upstream error", { status: res.status });
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const body = await res.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("Proxy error", { status: 502 });
    }
  },
};

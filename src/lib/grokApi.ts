let userApiKey: string | null = null;

/** Set the API key from the UI input (overrides env). Pass null to clear. */
export function setGrokApiKey(key: string | null): void {
  userApiKey = key?.trim() || null;
}

function getApiKey(): string {
  if (!userApiKey) throw new Error("Grok API key is not set. Please log in.");
  return userApiKey;
}

const getBaseUrl = () =>
  import.meta.env.VITE_GROK_API_URL ?? "https://api.x.ai/v1";

/** Base URL for t2i/i2i/i2v API calls via dev proxy (avoids CORS when xAI omits Allow-Origin). */
const getProxiedApiBase = () => "/api/proxy-xai";

const XAI_CDN_PREFIXES = ["https://imgen.x.ai/", "https://vidgen.x.ai/"];

function useProxy(url: string): boolean {
  return XAI_CDN_PREFIXES.some((p) => url.startsWith(p));
}

/** Custom fetch so requests to imgen.x.ai and vidgen.x.ai go via our proxy (avoids CORS). */
function grokFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (useProxy(url)) {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    return fetch(proxyUrl, init);
  }
  return fetch(input, init);
}

/** Extract a user-facing message from API errors (e.g. content moderation, rate limits, credits). */
function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "responseBody" in err) {
    const body = (err as { responseBody?: string }).responseBody;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { error?: string | { message?: string }; code?: string };
        if (typeof parsed.error === "string") return parsed.error;
        if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string")
          return parsed.error.message;
      } catch {
        // not JSON
      }
    }
  }
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string | { message?: string } } }).data;
    if (data && typeof data.error === "string") return data.error;
    if (data?.error && typeof data.error === "object" && typeof data.error.message === "string")
      return data.error.message;
  }
  if (err instanceof Error && err.message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(err.message) as { error?: string | { message?: string } };
      if (typeof parsed.error === "string") return parsed.error;
      if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string")
        return parsed.error.message;
    } catch {
      // not JSON
    }
  }
  if (err instanceof Error) {
    if ("cause" in err && err.cause !== undefined) {
      const fromCause = getErrorMessage(err.cause);
      if (fromCause && fromCause !== "Request failed") return fromCause;
    }
    return err.message;
  }
  return "Request failed";
}

const PROXIED_API_PATHS = ["/images/generations", "/images/edits"];

async function xaiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const useProxyApi = PROXIED_API_PATHS.includes(path);
  const baseUrl = useProxyApi ? getProxiedApiBase() : getBaseUrl().replace(/\/$/, "");
  const fullPath = useProxyApi ? `/v1${path}` : path;
  const res = await grokFetch(`${baseUrl}${fullPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const parsed = JSON.parse(text) as { error?: string | { message?: string } };
      if (typeof parsed.error === "string") throw new Error(parsed.error);
      if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string")
        throw new Error(parsed.error.message);
    } catch (e) {
      if (e instanceof Error && e.message !== "Request failed") throw e;
    }
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Text-to-image: POST /v1/images/generations, returns image as data URL.
 */
export async function textToImage(prompt: string): Promise<string> {
  try {
    const data = await xaiPost<{ data?: Array<{ b64_json?: string }> }>(
      "/images/generations",
      {
        model: "grok-imagine-image",
        prompt: prompt.trim(),
        response_format: "b64_json",
      }
    );

    const first = data.data?.[0]?.b64_json;
    if (!first) throw new Error("No image in response");
    return `data:image/png;base64,${first}`;
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
}

/**
 * Image edit: POST /v1/images/edits with image (data URI or URL) + prompt, returns image as data URL.
 */
export async function imageEdit(
  prompt: string,
  imageDataUri: string
): Promise<string> {
  try {
    const data = await xaiPost<{ data?: Array<{ b64_json?: string }> }>(
      "/images/edits",
      {
        model: "grok-imagine-image",
        prompt: prompt.trim(),
        image: {
          url: imageDataUri,
          type: "image_url",
        },
        response_format: "b64_json",
      }
    );

    const first = data.data?.[0]?.b64_json;
    if (!first) throw new Error("No image in response");
    return `data:image/png;base64,${first}`;
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 600_000; // 10 min

/**
 * Image-to-video: HTTP POST to xAI /videos/generations, then poll until done.
 * Image can be a public URL or a base64 data URI. Aspect ratio is omitted (uses input image).
 * Returns a URL the frontend can use (proxy URL for vidgen.x.ai to avoid CORS).
 */
export async function imageToVideo(
  prompt: string,
  imageDataUri: string,
  options?: { duration?: number; resolution?: string }
): Promise<string> {
  const apiKey = getApiKey();
  const baseUrl = getProxiedApiBase();

  const body: Record<string, unknown> = {
    model: "grok-imagine-video",
    prompt: prompt.trim(),
    image: { url: imageDataUri },
    duration: options?.duration ?? 5,
    resolution: options?.resolution === "720p" ? "720p" : "480p",
  };

  const startRes = await fetch(`${baseUrl}/v1/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    try {
      const parsed = JSON.parse(text) as { error?: string | { message?: string } };
      if (typeof parsed.error === "string") throw new Error(parsed.error);
      if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string")
        throw new Error(parsed.error.message);
    } catch (e) {
      if (e instanceof Error && e.message !== "Request failed") throw e;
    }
    throw new Error(text || `Request failed: ${startRes.status}`);
  }

  const startData = (await startRes.json()) as { request_id?: string };
  const requestId = startData.request_id;
  if (!requestId) throw new Error("No request_id in response");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pollRes = await fetch(`${baseUrl}/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(errText || `Poll failed: ${pollRes.status}`);
    }
    const pollData = (await pollRes.json()) as {
      status?: string;
      video?: { url?: string };
    };
    if (pollData.status === "expired") throw new Error("Video request expired");
    // Done when we have video.url (API may omit "status" when complete)
    if (pollData.video?.url) {
      const videoUrl = pollData.video.url;
      return useProxy(videoUrl)
        ? `/api/proxy-image?url=${encodeURIComponent(videoUrl)}`
        : videoUrl;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Video generation timed out");
}

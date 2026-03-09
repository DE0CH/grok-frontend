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

const PROXY_BASE = "/api/proxy";

/** Build proxy URL: ?url=<encoded-full-target-url> */
function proxyUrl(fullTargetUrl: string): string {
  return `${PROXY_BASE}?url=${encodeURIComponent(fullTargetUrl)}`;
}

const XAI_CDN_PREFIXES = ["https://imgen.x.ai/", "https://vidgen.x.ai/"];

function useProxy(url: string): boolean {
  return XAI_CDN_PREFIXES.some((p) => url.startsWith(p));
}

/** Custom fetch so requests to imgen.x.ai and vidgen.x.ai go via our proxy (avoids CORS). */
function grokFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (useProxy(url)) return fetch(proxyUrl(url), init);
  return fetch(input, init);
}

/** User-facing error with optional full API body for display. */
export interface GrokApiError extends Error {
  status?: number;
  responseBody?: string;
  responseJson?: unknown;
}

function statusMessage(status: number): string {
  switch (status) {
    case 401:
      return "Unauthorized — check your API key.";
    case 403:
      return "Forbidden — access denied.";
    case 429:
      return "Rate limited — try again later.";
    case 502:
      return "Proxy or network error.";
    case 500:
    case 503:
      return "Server error — try again later.";
    default:
      return `Request failed (${status}).`;
  }
}

/** Extract a user-facing message from API errors; prefers full JSON when available. */
function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "responseBody" in err && "status" in err) {
    const status = (err as { status?: number }).status;
    const body = (err as { responseBody?: string }).responseBody;
    const statusHint = status != null ? statusMessage(status) : "";
    if (typeof body === "string" && body.trim()) {
      try {
        const parsed = JSON.parse(body) as { error?: string | { message?: string }; code?: string };
        const extracted =
          typeof parsed.error === "string"
            ? parsed.error
            : parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string"
              ? parsed.error.message
              : null;
        const full = body.length > 500 ? body.slice(0, 500) + "…" : body;
        if (extracted) return `${statusHint}\n${extracted}\n\nFull response:\n${full}`;
        return `${statusHint}\n\nFull response:\n${body}`;
      } catch {
        return `${statusHint}\n\nRaw response:\n${body}`;
      }
    }
    return statusHint || "Request failed.";
  }
  if (err && typeof err === "object" && "responseBody" in err) {
    const body = (err as { responseBody?: string }).responseBody;
    if (typeof body === "string" && body.trim()) {
      try {
        const parsed = JSON.parse(body) as { error?: string | { message?: string } };
        if (typeof parsed.error === "string") return parsed.error;
        if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string")
          return parsed.error.message;
        return `API error:\n${body}`;
      } catch {
        return body;
      }
    }
  }
  if (err && typeof err === "object" && "responseJson" in err) {
    const json = (err as { responseJson?: unknown }).responseJson;
    if (json !== undefined && json !== null) {
      try {
        const str = JSON.stringify(json, null, 2);
        const obj = json as { error?: string | { message?: string } };
        if (typeof obj.error === "string") return `${obj.error}\n\nFull response:\n${str}`;
        if (obj.error && typeof obj.error === "object" && typeof obj.error.message === "string")
          return `${obj.error.message}\n\nFull response:\n${str}`;
        return `API error:\n${str}`;
      } catch {
        return String(json);
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
      return `API error:\n${err.message}`;
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
  const target = useProxyApi
    ? proxyUrl(`https://api.x.ai/v1${path}`)
    : `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const res = await grokFetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const apiErr: GrokApiError = new Error(`Request failed: ${res.status}`) as GrokApiError;
    apiErr.status = res.status;
    apiErr.responseBody = text || undefined;
    try {
      apiErr.responseJson = JSON.parse(text) as unknown;
    } catch {
      // leave responseJson undefined; getErrorMessage will use responseBody
    }
    throw apiErr;
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

  const body: Record<string, unknown> = {
    model: "grok-imagine-video",
    prompt: prompt.trim(),
    image: { url: imageDataUri },
    duration: options?.duration ?? 5,
    resolution: options?.resolution === "720p" ? "720p" : "480p",
  };

  const startRes = await fetch(proxyUrl("https://api.x.ai/v1/videos/generations"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    const apiErr: GrokApiError = new Error(`Request failed: ${startRes.status}`) as GrokApiError;
    apiErr.status = startRes.status;
    apiErr.responseBody = text || undefined;
    try {
      apiErr.responseJson = JSON.parse(text) as unknown;
    } catch {
      // non-JSON body
    }
    throw apiErr;
  }

  const startData = (await startRes.json()) as { request_id?: string };
  const requestId = startData.request_id;
  if (!requestId) throw new Error("No request_id in response");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pollRes = await fetch(proxyUrl(`https://api.x.ai/v1/videos/${requestId}`), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) {
      const errText = await pollRes.text();
      const apiErr: GrokApiError = new Error(`Poll failed: ${pollRes.status}`) as GrokApiError;
      apiErr.status = pollRes.status;
      apiErr.responseBody = errText || undefined;
      try {
        apiErr.responseJson = JSON.parse(errText) as unknown;
      } catch {
        // non-JSON body
      }
      throw apiErr;
    }
    const pollData = (await pollRes.json()) as {
      status?: string;
      video?: { url?: string };
    };
    if (pollData.status === "expired") throw new Error("Video request expired");
    // Done when we have video.url (API may omit "status" when complete)
    if (pollData.video?.url) {
      const videoUrl = pollData.video.url;
      return useProxy(videoUrl) ? proxyUrl(videoUrl) : videoUrl;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Video generation timed out");
}

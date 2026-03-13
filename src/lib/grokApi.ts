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

/** Low-level POST helper for image endpoints that returns raw response text and surfaces API errors. */
async function xaiPostRaw(path: string, body: Record<string, unknown>): Promise<string> {
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

  return text;
}

type ImageGenOutcome =
  | { kind: "success"; dataUri: string }
  | { kind: "unknown_error"; message: string };

/** Process raw image generation/edit response into success or unknown_error, surfacing raw body on unknown. */
function processImageGenerationResponse(rawText: string): ImageGenOutcome {
  let parsed: unknown;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = undefined;
    }
  }

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    const data = parsed as { data?: Array<{ b64_json?: string }> };
    const first = data.data?.[0]?.b64_json;
    if (first && typeof first === "string") {
      return { kind: "success", dataUri: `data:image/png;base64,${first}` };
    }
  }

  // If the shape isn't what we expect, surface the raw response body so callers can see what went wrong.
  return {
    kind: "unknown_error",
    message: rawText || "Unexpected image response format",
  };
}

/**
 * Text-to-image: POST /v1/images/generations, returns image as data URL.
 */
export async function textToImage(prompt: string): Promise<string> {
  try {
    const text = await xaiPostRaw("/images/generations", {
      model: "grok-imagine-image",
      prompt: prompt.trim(),
      response_format: "b64_json",
    });

    const outcome = processImageGenerationResponse(text);
    if (outcome.kind === "success") return outcome.dataUri;
    throw new Error(outcome.message);
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
    const text = await xaiPostRaw("/images/edits", {
      model: "grok-imagine-image",
      prompt: prompt.trim(),
      image: {
        url: imageDataUri,
        type: "image_url",
      },
      response_format: "b64_json",
    });

    const outcome = processImageGenerationResponse(text);
    if (outcome.kind === "success") return outcome.dataUri;
    throw new Error(outcome.message);
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
}

const POLL_INTERVAL_MS = 3000;

type VideoPollOutcome =
  | { kind: "pending" }
  | { kind: "success"; videoUrl: string }
  | { kind: "known_error"; message: string }
  | { kind: "unknown_error"; message: string };

/** Process raw video poll response text into one of: pending, success, known_error, unknown_error. */
function processVideoPollResponse(rawText: string): VideoPollOutcome {
  let parsed: unknown;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = undefined;
    }
  }

  const pollData = parsed;

  // Helper to build a safe fallback message that prefers raw text
  const fallback = (prefix: string): string => {
    if (rawText) return `${prefix}: ${rawText}`;
    try {
      return `${prefix}: ${JSON.stringify(pollData)}`;
    } catch {
      return prefix;
    }
  };

  // Completely unexpected type (e.g. non-JSON response)
  if (pollData === null || typeof pollData !== "object") {
    return {
      kind: "unknown_error",
      message: rawText || fallback("Unexpected video response format"),
    };
  }

  const data = pollData as {
    status?: string;
    video?: { url?: string };
    error?: { code?: string; message?: string } | string;
  };

  // In-progress states
  if (data.status === "pending" || data.status === "processing" || data.status === "queued") {
    return { kind: "pending" };
  }

  // Successful completion with URL
  if (data.video?.url) {
    return { kind: "success", videoUrl: data.video.url };
  }

  // Known failure states with structured error
  if (data.status === "failed" || data.status === "expired" || data.error) {
    let message: string | undefined;

    if (typeof data.error === "string") {
      message = data.error;
    } else if (data.error && typeof data.error === "object" && typeof data.error.message === "string") {
      message = data.error.message;
    } else if (data.status === "expired") {
      message = "Video request expired";
    } else if (data.status === "failed") {
      message = "Video generation failed";
    }

    return {
      kind: "known_error",
      message: message ?? fallback("Video generation error"),
    };
  }

  // Anything else is an unknown error shape
  return {
    kind: "unknown_error",
    message: rawText || fallback("Unexpected video response format"),
  };
}

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

  // Poll indefinitely until we get a terminal outcome (success or error).
  // Timeout behavior is controlled by the caller (e.g. abort signal), not here.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pollRes = await fetch(proxyUrl(`https://api.x.ai/v1/videos/${requestId}`), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await pollRes.text();
    if (!pollRes.ok) {
      const apiErr: GrokApiError = new Error(`Poll failed: ${pollRes.status}`) as GrokApiError;
      apiErr.status = pollRes.status;
      apiErr.responseBody = text || undefined;
      try {
        apiErr.responseJson = JSON.parse(text) as unknown;
      } catch {
        // non-JSON body
      }
      throw apiErr;
    }

    const outcome = processVideoPollResponse(text);

    if (outcome.kind === "pending") {
      // keep polling
    } else if (outcome.kind === "success") {
      const videoUrl = outcome.videoUrl;
      return useProxy(videoUrl) ? proxyUrl(videoUrl) : videoUrl;
    } else {
      // known_error or unknown_error
      throw new Error(outcome.message);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

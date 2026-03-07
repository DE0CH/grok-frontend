import { createXai } from "@ai-sdk/xai";
import { generateImage } from "ai";

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

function getXai() {
  return createXai({
    apiKey: getApiKey(),
    baseURL: getBaseUrl(),
    fetch: grokFetch,
  });
}

function dataUriToUint8Array(dataUri: string): Uint8Array {
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1]! : dataUri;
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

/** Extract a user-facing message from API errors (e.g. content moderation, rate limits, credits). */
function getErrorMessage(err: unknown): string {
  // SDK RetryError: "Failed after 3 attempts. Last error: ..." — use the last underlying error
  if (err && typeof err === "object" && "errors" in err && Array.isArray((err as { errors: unknown[] }).errors)) {
    const errors = (err as { errors: unknown[]; message?: string }).errors;
    const last = errors[errors.length - 1];
    if (last !== undefined) {
      const inner = getErrorMessage(last);
      if (inner && inner !== "Request failed") return inner;
    }
    const msg = (err as { message?: string }).message;
    if (typeof msg === "string" && msg.includes("Last error:")) {
      const after = msg.split("Last error:")[1]?.trim();
      if (after) return after;
    }
  }

  let body: string | null = null;
  if (
    err &&
    typeof err === "object" &&
    "responseBody" in err &&
    typeof (err as { responseBody?: string }).responseBody === "string"
  ) {
    body = (err as { responseBody: string }).responseBody;
  } else if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string | { message?: string } } }).data;
    if (data && typeof data.error === "string") return data.error;
    if (data?.error && typeof data.error === "object" && typeof data.error.message === "string")
      return data.error.message;
  } else if (err instanceof Error && err.message.trim().startsWith("{")) {
    body = err.message;
  }
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: string | { message?: string }; code?: string };
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

/**
 * Text-to-image: send prompt only, returns image as data URL.
 * Uses Grok SDK (generateImage with grok-imagine-image).
 */
export async function textToImage(prompt: string): Promise<string> {
  try {
    const { images } = await generateImage({
      model: getXai().image("grok-imagine-image"),
      prompt: prompt.trim(),
    });

    const first = images?.[0];
    if (!first) throw new Error("No image in response");
    return `data:${first.mediaType};base64,${first.base64}`;
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
}

/**
 * Image edit: send image (data URI or URL) + prompt, returns image as data URL.
 * Uses Grok SDK (generateImage with grok-imagine-image).
 */
export async function imageEdit(
  prompt: string,
  imageDataUri: string
): Promise<string> {
  try {
    const imageInput = imageDataUri.startsWith("http")
      ? new Uint8Array(await (await fetch(imageDataUri)).arrayBuffer())
      : dataUriToUint8Array(imageDataUri);

    const { images } = await generateImage({
      model: getXai().image("grok-imagine-image"),
      prompt: {
        text: prompt,
        images: [imageInput],
      },
    });

    const first = images?.[0];
    if (!first) throw new Error("No image in response");
    return `data:${first.mediaType};base64,${first.base64}`;
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
  const baseUrl = getBaseUrl().replace(/\/$/, "");

  const body: Record<string, unknown> = {
    model: "grok-imagine-video",
    prompt: prompt.trim(),
    image: { url: imageDataUri },
    duration: options?.duration ?? 5,
    resolution: options?.resolution === "720p" ? "720p" : "480p",
  };

  const startRes = await fetch(`${baseUrl}/videos/generations`, {
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
    const pollRes = await fetch(`${baseUrl}/videos/${requestId}`, {
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

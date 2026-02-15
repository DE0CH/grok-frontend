import { createXai } from "@ai-sdk/xai";
import { generateImage } from "ai";
import { experimental_generateVideo as generateVideo } from "ai";

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

/** Custom download for generateVideo: fetches video URLs via our proxy to avoid CORS. */
async function proxyDownload(options: {
  url: URL;
  abortSignal?: AbortSignal;
}): Promise<{ data: Uint8Array; mediaType: string | undefined }> {
  const href = options.url.href;
  const url = useProxy(href)
    ? `/api/proxy-image?url=${encodeURIComponent(href)}`
    : href;
  const res = await fetch(url, { signal: options.abortSignal });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return {
    data: new Uint8Array(buf),
    mediaType: res.headers.get("content-type") ?? undefined,
  };
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

/** Extract a user-facing message from API errors (e.g. content moderation). */
function getErrorMessage(err: unknown): string {
  let body: string | null = null;
  if (
    err &&
    typeof err === "object" &&
    "responseBody" in err &&
    typeof (err as { responseBody?: string }).responseBody === "string"
  ) {
    body = (err as { responseBody: string }).responseBody;
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
  if (err instanceof Error) return err.message;
  return "Request failed";
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

/**
 * Image-to-video: send image (data URI) + prompt, returns video as data URL.
 * Uses Grok SDK (experimental_generateVideo with grok-imagine-video). Polling is handled by the SDK.
 */
export async function imageToVideo(
  prompt: string,
  imageDataUri: string,
  options?: { duration?: number; aspectRatio?: string; resolution?: string }
): Promise<string> {
  try {
    const imageInput = imageDataUri.startsWith("http")
      ? imageDataUri
      : dataUriToUint8Array(imageDataUri);

    const { videos } = await generateVideo({
      model: getXai().video("grok-imagine-video"),
      prompt: {
        image: imageInput,
        text: prompt,
      },
      duration: options?.duration ?? 5,
      // Omit aspectRatio so the API uses the input image's aspect ratio (xAI default for image-to-video).
      ...(options?.aspectRatio != null && {
        aspectRatio: options.aspectRatio as "16:9" | "1:1" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3",
      }),
      resolution:
        options?.resolution === "720p"
          ? "1280x720"
          : "854x480",
      providerOptions: {
        xai: {
          pollTimeoutMs: 600_000, // 10 min
        },
      },
      // SDK downloads the video URL with its own fetch (CORS). Use our proxy for vidgen.x.ai.
      download: proxyDownload,
    });

    const first = videos?.[0];
    if (!first) throw new Error("No video in response");
    return `data:${first.mediaType};base64,${first.base64}`;
  } catch (err) {
    throw new Error(getErrorMessage(err));
  }
}

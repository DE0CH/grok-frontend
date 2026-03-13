/** Map MIME subtype to common file extension (jpeg → jpg). */
const MIME_TO_EXT: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

/**
 * Derive a download filename with correct extension from a result URL.
 * - Data URI (e.g. data:image/png;base64,...) uses the MIME type.
 * - Remote URLs use the path extension if present.
 * - Falls back to .png when unknown.
 */
export function getDownloadFilename(
  url: string,
  defaultName = "grok-image"
): string {
  const dataMatch = url.match(/^data:image\/(\w+);/);
  if (dataMatch) {
    const subtype = dataMatch[1].toLowerCase();
    const ext = MIME_TO_EXT[subtype] ?? subtype;
    return `${defaultName}.${ext}`;
  }
  try {
    const u = new URL(url);
    const segment = u.pathname.split("/").pop() ?? "";
    const dot = segment.lastIndexOf(".");
    if (dot > 0) {
      const ext = segment.slice(dot + 1).toLowerCase();
      if (/^[a-z0-9]+$/.test(ext)) return `${defaultName}.${ext}`;
    }
  } catch {
    // ignore
  }
  return `${defaultName}.png`;
}

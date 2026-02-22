const API_KEY_COOKIE = "grok-api-key";
const BASE_URL_COOKIE = "grok-base-url";
const COOKIE_DAYS = 365;

export function getApiKeyFromCookie(): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + encodeURIComponent(API_KEY_COOKIE) + "=([^;]*)"));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

export function setApiKeyCookie(key: string): void {
  const encoded = encodeURIComponent(key.trim());
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${API_KEY_COOKIE}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearApiKeyCookie(): void {
  document.cookie = `${API_KEY_COOKIE}=; path=/; max-age=0`;
}

export function getBaseUrlFromCookie(): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + encodeURIComponent(BASE_URL_COOKIE) + "=([^;]*)"));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

export function setBaseUrlCookie(url: string): void {
  const encoded = encodeURIComponent(url.trim());
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${BASE_URL_COOKIE}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearBaseUrlCookie(): void {
  document.cookie = `${BASE_URL_COOKIE}=; path=/; max-age=0`;
}

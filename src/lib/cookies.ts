const API_KEY_COOKIE = "grok-api-key";
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

// Lightweight single-owner auth: a signed (HMAC-SHA256) session cookie.
// Implemented with Web Crypto so it runs in both the Edge middleware and
// Node server actions.

export const SESSION_COOKIE = "voltra_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  return process.env.AUTH_SECRET || "voltra-dev-secret-change-me-please";
}

function getPassword(): string {
  return process.env.AUTH_PASSWORD || "voltra-admin";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  let v = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = v.length % 4 ? 4 - (v.length % 4) : 0;
  v += "=".repeat(pad);
  const binary = atob(v);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "owner", iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(payloadB64);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;

  const expected = await hmac(payloadB64);
  if (expected !== signature) return false;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadB64)));
    if (typeof payload.exp !== "number") return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

export function verifyPassword(input: string): boolean {
  return input === getPassword();
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
  secure: process.env.NODE_ENV === "production",
};

// Multi-user auth primitives. Edge-safe (no DB, no bcrypt) so the proxy can
// import it. Sessions are signed (HMAC-SHA256) cookies via Web Crypto.

export const SESSION_COOKIE = "voltra_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionRole = "admin" | "employee";
export type SessionPayload = {
  uid: string; // "admin" or employee id
  role: SessionRole;
  name: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string {
  return process.env.AUTH_SECRET || "voltra-dev-secret-change-me-please";
}

export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const adminPass = process.env.AUTH_PASSWORD || "voltra-admin";
  return username === getAdminUsername() && password === adminPass;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

export async function createSessionToken(data: {
  uid: string;
  role: SessionRole;
  name: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...data,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(payloadB64);
  return `${payloadB64}.${signature}`;
}

export async function readSessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = await hmac(payloadB64);
  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(
      decoder.decode(base64UrlToBytes(payloadB64)),
    ) as SessionPayload;
    if (typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "admin" && payload.role !== "employee") return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
  secure: process.env.NODE_ENV === "production",
};

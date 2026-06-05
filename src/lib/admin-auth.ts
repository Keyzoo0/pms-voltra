// Admin (owner) password handling. Node-only (uses bcrypt + DB), so this must
// NOT be imported from edge code like `proxy.ts` — keep that on `auth.ts`.
//
// The admin password lives in AppSettings.adminPasswordHash once changed in-app.
// Until then we fall back to the AUTH_PASSWORD env var so first login still works.
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getAdminUsername } from "@/lib/auth";

function envPassword(): string {
  return process.env.AUTH_PASSWORD || "voltra-admin";
}

async function storedHash(): Promise<string | null> {
  const s = await db.appSettings.findUnique({
    where: { id: "singleton" },
    select: { adminPasswordHash: true },
  });
  return s?.adminPasswordHash ?? null;
}

/** Verify just the admin password (DB hash if set, else env fallback). */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hash = await storedHash();
  if (hash) return bcrypt.compare(password, hash);
  return password === envPassword();
}

/** Verify a full admin login (username from env + password). */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  if (username !== getAdminUsername()) return false;
  return verifyAdminPassword(password);
}

/** Persist a new admin password (hashed) into AppSettings. */
export async function setAdminPassword(newPassword: string): Promise<void> {
  const adminPasswordHash = await bcrypt.hash(newPassword, 10);
  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", adminPasswordHash },
    update: { adminPasswordHash },
  });
}

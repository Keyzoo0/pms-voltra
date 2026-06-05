import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, readSessionToken, type SessionPayload } from "@/lib/auth";

export type { SessionPayload };

/** Read & verify the current session (or null). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Require any authenticated user, else redirect to login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Require the admin/owner, else send employees to their area. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/projects");
  return session;
}

export type ProjectAccess = "admin" | "manager" | "member" | null;

/**
 * What access does the current user have on a project?
 * - admin   → full
 * - manager → assigned as project manager (operational edit)
 * - member  → assigned (progress & BOM only)
 * - null    → no access
 */
export async function getProjectAccess(
  projectId: string,
  session?: SessionPayload | null,
): Promise<ProjectAccess> {
  const s = session ?? (await getSession());
  if (!s) return null;
  if (s.role === "admin") return "admin";

  const assignment = await db.projectAssignment.findFirst({
    where: { projectId, employeeId: s.uid },
    select: { isManager: true },
    orderBy: { isManager: "desc" },
  });
  if (!assignment) return null;
  return assignment.isManager ? "manager" : "member";
}

export const canManageProject = (a: ProjectAccess) =>
  a === "admin" || a === "manager";
export const canEditBasics = (a: ProjectAccess) =>
  a === "admin" || a === "manager" || a === "member";
export const isAdminAccess = (a: ProjectAccess) => a === "admin";

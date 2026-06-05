"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  checkAdminCredentials,
  createSessionToken,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Username & password wajib diisi." };

  const store = await cookies();
  const from = String(formData.get("from") ?? "");

  // Admin (owner) — credentials from env.
  if (checkAdminCredentials(username, password)) {
    const token = await createSessionToken({
      uid: "admin",
      role: "admin",
      name: "Administrator",
    });
    store.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    redirect(from && from.startsWith("/") ? from : "/");
  }

  // Employee — username + hashed password from DB.
  const employee = await db.employee.findUnique({ where: { username } });
  if (employee?.passwordHash && employee.status === "active") {
    const ok = await bcrypt.compare(password, employee.passwordHash);
    if (ok) {
      const token = await createSessionToken({
        uid: employee.id,
        role: "employee",
        name: employee.name,
      });
      store.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
      redirect("/projects");
    }
  }

  return { error: "Username atau password salah." };
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-slate-950">
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(60rem 60rem at 50% -20%, rgba(99,102,241,0.18), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(40rem_40rem_at_50%_0%,#000,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(100,116,139,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.12) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-slate-900/5 ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Voltra Techno"
              className="h-16 w-auto object-contain"
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Sistem Manajemen Proyek · SDM · Keuangan
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xl shadow-slate-900/5 sm:p-7">
          <LoginForm from={from} />
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Akses khusus owner · sesi aman terenkripsi
        </p>
      </div>
    </main>
  );
}

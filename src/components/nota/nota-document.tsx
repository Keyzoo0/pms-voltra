import * as React from "react";
import Link from "next/link";
import type { AppSettingsData } from "@/lib/settings";
import { PrintButton } from "./print-button";

export function NotaDocument({
  settings,
  docTitle,
  docNumber,
  docDate,
  recipient,
  backHref,
  children,
}: {
  settings: AppSettingsData;
  docTitle: string;
  docNumber: string;
  docDate: string;
  recipient?: React.ReactNode;
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Kembali ke proyek
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:shadow-none print:ring-0">
        <div className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3">
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt="Logo"
                  className="size-14 shrink-0 object-contain"
                />
              )}
              <div>
                <p className="text-lg font-bold">{settings.companyName}</p>
                {settings.address && (
                  <p className="whitespace-pre-line text-xs text-slate-500">
                    {settings.address}
                  </p>
                )}
                {(settings.phone || settings.email) && (
                  <p className="text-xs text-slate-500">
                    {[settings.phone, settings.email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tracking-tight uppercase">{docTitle}</p>
              <p className="mt-1 text-xs text-slate-500">No: {docNumber}</p>
              <p className="text-xs text-slate-500">Tanggal: {docDate}</p>
            </div>
          </div>

          {recipient && <div className="py-5 text-sm">{recipient}</div>}

          {children}
        </div>
      </div>
    </>
  );
}

export function NotaTable({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
          {head}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

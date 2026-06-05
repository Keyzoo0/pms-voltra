import { db } from "@/lib/db";

export type AppSettingsData = {
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  logoUrl: string | null;
};

const DEFAULTS: AppSettingsData = {
  companyName: "Voltra Techno",
  address: null,
  phone: null,
  email: null,
  bankName: null,
  bankAccount: null,
  bankHolder: null,
  logoUrl: null,
};

export async function getAppSettings(): Promise<AppSettingsData> {
  const s = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s) return DEFAULTS;
  return {
    companyName: s.companyName,
    address: s.address,
    phone: s.phone,
    email: s.email,
    bankName: s.bankName,
    bankAccount: s.bankAccount,
    bankHolder: s.bankHolder,
    logoUrl: s.logoUrl,
  };
}

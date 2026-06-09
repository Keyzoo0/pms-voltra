import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <AppShell role={session.role} name={session.name}>
      {children}
    </AppShell>
  );
}

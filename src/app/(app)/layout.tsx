import { requireSession } from "@/lib/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border lg:block">
        <AppSidebar role={session.role} name={session.name} />
      </aside>

      <div className="lg:pl-64">
        <Topbar role={session.role} name={session.name} />
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in-50 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

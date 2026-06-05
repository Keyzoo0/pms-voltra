import { requireAdmin } from "@/lib/session";

// Guards every admin-only page. Employees are redirected to their projects.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}

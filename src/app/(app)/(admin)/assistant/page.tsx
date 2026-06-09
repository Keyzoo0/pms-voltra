import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantChat } from "./assistant-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Analisa proyek, cari berdasarkan status, rekomendasi karyawan, dan buat proyek — ditenagai Gemini."
      />
      <AssistantChat />
    </div>
  );
}

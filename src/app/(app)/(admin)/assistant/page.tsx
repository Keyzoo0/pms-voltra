import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantWorkspace } from "./assistant-workspace";
import { listChats } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireAdmin();
  const chats = await listChats();
  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Analisa proyek, rekomendasi karyawan, buat proyek, dan analisa gambar/laporan — dengan riwayat percakapan."
      />
      <AssistantWorkspace initialChats={chats} />
    </div>
  );
}

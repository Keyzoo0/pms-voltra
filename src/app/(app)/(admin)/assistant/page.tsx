import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { AssistantWorkspace } from "./assistant-workspace";
import { listChats } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireAdmin();
  const chats = await listChats();
  return <AssistantWorkspace initialChats={chats} />;
}

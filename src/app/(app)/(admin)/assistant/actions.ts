"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export type ChatListItem = { id: string; title: string; updatedAt: string };
export type StoredMessage = {
  id: string;
  role: string;
  content: string;
  toolsUsed: string[];
  attachments: unknown;
};

export async function listChats(): Promise<ChatListItem[]> {
  const s = await requireAdmin();
  const chats = await db.assistantChat.findMany({
    where: { ownerId: s.uid },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: { id: true, title: true, updatedAt: true },
  });
  return chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
}

export async function getChatMessages(chatId: string): Promise<StoredMessage[]> {
  const s = await requireAdmin();
  const chat = await db.assistantChat.findUnique({
    where: { id: chatId },
    select: { ownerId: true },
  });
  if (!chat || chat.ownerId !== s.uid) return [];
  const msgs = await db.assistantMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    toolsUsed: m.toolsUsed,
    attachments: m.attachments ?? null,
  }));
}

export async function deleteChat(chatId: string): Promise<void> {
  const s = await requireAdmin();
  const chat = await db.assistantChat.findUnique({
    where: { id: chatId },
    select: { ownerId: true },
  });
  if (!chat || chat.ownerId !== s.uid) return;
  await db.assistantChat.delete({ where: { id: chatId } });
}

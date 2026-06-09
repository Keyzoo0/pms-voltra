import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { extractDocumentText } from "@/lib/assistant/parse";
import type { Attachment } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOC_EXT = [".pdf", ".xlsx", ".csv", ".txt", ".md", ".json", ".tsv"];

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload tidak valid." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File tidak ada." }, { status: 400 });
  }

  const name = file.name || "file";
  const lower = name.toLowerCase();
  const isImage = file.type.startsWith("image/");
  const isDoc = DOC_EXT.some((e) => lower.endsWith(e)) || file.type.includes("pdf") || file.type.includes("sheet");

  try {
    if (isImage) {
      if (file.size > 10 * 1024 * 1024)
        return NextResponse.json({ error: "Gambar maksimal 10MB." }, { status: 400 });
      const blob = await put(`assistant/${Date.now()}-${safeName(name)}`, file, {
        access: "public",
        addRandomSuffix: true,
      });
      const att: Attachment = { kind: "image", name, url: blob.url, mime: file.type };
      return NextResponse.json({ attachment: att });
    }

    if (isDoc) {
      if (file.size > 15 * 1024 * 1024)
        return NextResponse.json({ error: "Dokumen maksimal 15MB." }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      const text = await extractDocumentText(buf, name, file.type);
      if (!text.trim())
        return NextResponse.json(
          { error: "Tidak ada teks yang bisa dibaca dari dokumen ini." },
          { status: 400 },
        );
      const att: Attachment = { kind: "document", name, text, mime: file.type };
      return NextResponse.json({ attachment: att });
    }

    return NextResponse.json(
      { error: "Jenis file tidak didukung. Pakai gambar, PDF, Excel (.xlsx), atau CSV/teks." },
      { status: 400 },
    );
  } catch (e) {
    console.error("[assistant/upload] error:", e);
    return NextResponse.json(
      { error: "Gagal memproses file. Coba file lain atau format berbeda." },
      { status: 500 },
    );
  }
}

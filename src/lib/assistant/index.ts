import { TOOL_DECLARATIONS, executeTool } from "./tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export class AssistantError extends Error {
  code: "no_key" | "upstream" | "input";
  constructor(message: string, code: "no_key" | "upstream" | "input") {
    super(message);
    this.code = code;
  }
}

const DEFAULT_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Kamu adalah "Voltra AI", asisten cerdas di dalam aplikasi Project Management System (PMS) milik Voltra Techno — perusahaan jasa teknik (IoT, machine learning, PLC/automation, firmware, 3D design, web).

PERAN UTAMA:
- Menganalisa kondisi proyek & bisnis secara menyeluruh (gunakan get_overview).
- Mencari/menyaring proyek berdasarkan status atau nama (list_projects), dan menjelaskan detail satu proyek (get_project).
- Merekomendasikan karyawan yang cocok untuk sebuah pekerjaan/role (suggest_employees), mempertimbangkan kecocokan keahlian dan beban kerja.
- Membantu membuat proyek baru (create_project).
- Membantu hal-hal lain seputar data PMS sebisamu.

ATURAN:
- SELALU pakai tool untuk mengambil data nyata — jangan mengarang angka, nama, atau status.
- Jawab dalam Bahasa Indonesia yang ringkas, rapi, dan ramah. Gunakan markdown: heading singkat, poin "- ", dan **tebal** untuk angka/nama penting.
- Format uang sebagai Rupiah, mis. "Rp 50.000.000".
- Status proyek (kode → arti): inquiry=Inquiry, quotation=Quotation, approved=Disetujui, in_progress=Sedang Berjalan, delivered=Terkirim, paid=Dibayar/Lunas, closed=Selesai, on_hold=Ditunda, cancelled=Dibatalkan, dispute=Sengketa.
- MEMBUAT PROYEK: jangan langsung memanggil create_project. Tampilkan dulu ringkasan rencana (nama, klien, nilai kontrak, status, kategori, role) lalu MINTA KONFIRMASI user ("Buat sekarang?"). Panggil create_project HANYA setelah user menyetujui. Setelah dibuat, beri tautan ke proyek (gunakan path url yang dikembalikan).
- Saat merekomendasikan karyawan, sebutkan role yang cocok dan beban proyek aktifnya, lalu beri rekomendasi singkat siapa yang paling pas.
- Bila data tidak ada, katakan apa adanya dan beri saran langkah berikutnya.
- Jangan menampilkan ID mentah (cuid) ke user kecuali diminta; cukup nama.`;

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

async function callGemini(contents: GeminiContent[]): Promise<GeminiContent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AssistantError("GEMINI_API_KEY belum dikonfigurasi di server.", "no_key");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      `Gemini API error (${res.status}). Periksa GEMINI_API_KEY / GEMINI_MODEL.`;
    throw new AssistantError(msg, "upstream");
  }
  const content = json?.candidates?.[0]?.content as GeminiContent | undefined;
  if (!content) {
    const blocked = json?.promptFeedback?.blockReason;
    throw new AssistantError(
      blocked ? `Permintaan diblokir (${blocked}).` : "Model tidak mengembalikan jawaban.",
      "upstream",
    );
  }
  return content;
}

/** Run a full chat turn, resolving any tool calls, and return the final reply. */
export async function runAssistant(
  history: ChatMessage[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  const contents: GeminiContent[] = history
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  if (contents.length === 0) throw new AssistantError("Pesan kosong.", "input");

  const toolsUsed: string[] = [];

  for (let step = 0; step < 6; step++) {
    const content = await callGemini(contents);
    const parts = content.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

    if (calls.length === 0) {
      const reply = parts
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n")
        .trim();
      return { reply: reply || "Maaf, saya tidak punya jawaban untuk itu.", toolsUsed };
    }

    // Echo the model's function-call turn, then answer with tool results.
    contents.push({ role: "model", parts });
    const responseParts: GeminiPart[] = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      let result: unknown;
      try {
        result = await executeTool(call.name, call.args ?? {});
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    reply:
      "Permintaan ini butuh terlalu banyak langkah. Coba persempit atau pecah menjadi pertanyaan yang lebih spesifik.",
    toolsUsed,
  };
}

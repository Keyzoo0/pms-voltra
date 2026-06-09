const MAX_CHARS = 12000;

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return String(v.result ?? "");
    if ("richText" in v && Array.isArray(v.richText))
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    if ("hyperlink" in v) return String(v.hyperlink ?? "");
    return "";
  }
  return String(value);
}

async function pdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  const out = await parser.getText();
  return out.text;
}

async function xlsxText(buf: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const parts: string[] = [];
  wb.eachSheet((ws) => {
    parts.push(`# Sheet: ${ws.name}`);
    ws.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1).map(cellToString);
      if (values.some((v) => v.length > 0)) parts.push(values.join(" | "));
    });
  });
  return parts.join("\n");
}

async function docxText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

/** Heuristic: is this buffer human-readable text (not a binary blob)? */
function isProbablyText(buf: Buffer): boolean {
  const sample = buf.subarray(0, 4000);
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false; // null byte → binary
    // allow tab(9), LF(10), CR(13); flag other control chars
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious++;
  }
  return suspicious / Math.max(1, sample.length) < 0.1;
}

/**
 * Extract plain text from an uploaded document. Handles PDF, Excel, Word
 * (.docx), and any text/code/CSV/JSON file; rejects unreadable binaries.
 */
export async function extractDocumentText(
  buf: Buffer,
  name: string,
  mime: string,
): Promise<string> {
  const lower = name.toLowerCase();
  let text = "";

  if (mime.includes("pdf") || lower.endsWith(".pdf")) {
    text = await pdfText(buf);
  } else if (lower.endsWith(".xlsx") || mime.includes("spreadsheetml") || mime.includes("ms-excel")) {
    text = await xlsxText(buf);
  } else if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    text = await docxText(buf);
  } else if (isProbablyText(buf)) {
    // csv, txt, md, json, tsv, html, and source code of any language
    text = buf.toString("utf-8");
  } else {
    throw new Error("unsupported-binary");
  }

  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > MAX_CHARS
    ? normalized.slice(0, MAX_CHARS) + "\n…[dokumen dipotong]"
    : normalized;
}

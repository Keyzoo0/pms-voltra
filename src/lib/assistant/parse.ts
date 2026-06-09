const MAX_CHARS = 8000;

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

/** Extract plain text from an uploaded document (PDF, Excel, CSV/TXT/etc.). */
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
  } else {
    // csv, txt, md, json, tsv, … — treat as UTF-8 text
    text = buf.toString("utf-8");
  }

  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > MAX_CHARS
    ? normalized.slice(0, MAX_CHARS) + "\n…[dokumen dipotong]"
    : normalized;
}

import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import pdfParse from "pdf-parse";

export class UnsupportedDocumentError extends Error {}
export class UnreadableDocumentError extends Error {}

export interface DocumentProcessor {
  supports(mimeType: string, fileName: string): boolean;
  process(filePath: string): Promise<string>;
}

class TextProcessor implements DocumentProcessor {
  supports(mimeType: string, fileName: string): boolean {
    return mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt");
  }
  async process(filePath: string): Promise<string> {
    return (await fs.readFile(filePath, "utf8")).trim();
  }
}

class CsvProcessor implements DocumentProcessor {
  supports(mimeType: string, fileName: string): boolean {
    return mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv");
  }
  async process(filePath: string): Promise<string> {
    const raw = await fs.readFile(filePath, "utf8");
    const rows = parse(raw, { bom: true, skip_empty_lines: true });
    return rows.map((row: string[]) => row.join(": ")).join("\n");
  }
}

class PdfProcessor implements DocumentProcessor {
  supports(mimeType: string, fileName: string): boolean {
    return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  }
  async process(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    const text = result.text.trim();
    if (!text) throw new UnreadableDocumentError("No selectable text found. Scanned PDFs need OCR.");
    return text;
  }
}

const processors: DocumentProcessor[] = [
  new TextProcessor(),
  new CsvProcessor(),
  new PdfProcessor()
];

export async function extractDocument(filePath: string, mimeType: string, fileName: string): Promise<string> {
  const processor = processors.find((item) => item.supports(mimeType, fileName));
  if (!processor) throw new UnsupportedDocumentError(`Unsupported format: ${fileName}`);
  const text = await processor.process(filePath);
  if (!text.trim()) throw new UnreadableDocumentError(`No text could be extracted from ${fileName}`);
  const maxChars = 100_000;
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[Content truncated at ${maxChars} characters]` : text;
}

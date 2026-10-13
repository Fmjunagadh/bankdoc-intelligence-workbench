import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { extractDocument, UnreadableDocumentError, UnsupportedDocumentError } from "./documentProcessor.js";
import { MockAnalysisProvider } from "./analysisProvider.js";
import type { DocumentInput } from "./types.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024;
const maxFiles = Number(process.env.MAX_FILES ?? 10);
const allowedExtensions = new Set([".pdf", ".txt", ".csv"]);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxFileSize, files: maxFiles },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) return cb(new Error(`Unsupported file extension: ${ext || "unknown"}`));
    cb(null, true);
  }
});

const provider = new MockAnalysisProvider();

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/documents", (_req, res) => {
  const rows = db.prepare("SELECT id, file_name AS fileName, mime_type AS mimeType, length(extracted_text) AS characterCount, created_at AS createdAt FROM documents ORDER BY created_at DESC").all();
  res.json({ documents: rows });
});

app.post("/api/documents/upload", upload.array("documents", maxFiles), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (files.length === 0) return res.status(400).json({ error: { code: "NO_FILES", message: "Choose at least one supported document." } });

  const documents: Array<{ id: string; fileName: string; mimeType: string; characterCount: number }> = [];
  const errors: Array<{ fileName: string; message: string }> = [];

  for (const file of files) {
    try {
      const extractedText = await extractDocument(file.path, file.mimetype, file.originalname);
      const id = randomUUID();
      db.prepare("INSERT INTO documents (id, file_name, mime_type, extracted_text) VALUES (?, ?, ?, ?)")
        .run(id, path.basename(file.originalname), file.mimetype, extractedText);
      documents.push({ id, fileName: path.basename(file.originalname), mimeType: file.mimetype, characterCount: extractedText.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document processing failed.";
      errors.push({ fileName: path.basename(file.originalname), message });
    } finally {
      fs.promises.unlink(file.path).catch(() => undefined);
    }
  }
  res.status(documents.length ? 201 : 422).json({ documents, errors });
});

app.post("/api/analyze", async (req, res) => {
  const body = req.body as { documentIds?: unknown; instruction?: unknown };
  if (!Array.isArray(body.documentIds) || body.documentIds.length === 0 || !body.documentIds.every((id) => typeof id === "string")) {
    return res.status(400).json({ error: { code: "INVALID_DOCUMENT_IDS", message: "Provide one or more uploaded document IDs." } });
  }
  if (typeof body.instruction !== "string" || !body.instruction.trim() || body.instruction.length > 4000) {
    return res.status(400).json({ error: { code: "INVALID_INSTRUCTION", message: "Instruction is required and must be at most 4,000 characters." } });
  }

  const placeholders = body.documentIds.map(() => "?").join(",");
  const rows = db.prepare(`SELECT id, file_name AS fileName, mime_type AS mimeType, extracted_text AS extractedText FROM documents WHERE id IN (${placeholders})`)
    .all(...body.documentIds) as DocumentInput[];
  if (rows.length !== new Set(body.documentIds).size) {
    return res.status(404).json({ error: { code: "DOCUMENT_NOT_FOUND", message: "One or more document IDs were not found." } });
  }

  try {
    const result = await provider.analyze(rows, body.instruction);
    const id = randomUUID();
    db.prepare("INSERT INTO analyses (id, instruction, document_ids_json, result_json) VALUES (?, ?, ?, ?)")
      .run(id, body.instruction, JSON.stringify(body.documentIds), JSON.stringify(result));
    res.json({ id, instruction: body.instruction, ...result });
  } catch (error) {
    res.status(500).json({ error: { code: "ANALYSIS_FAILED", message: error instanceof Error ? error.message : "Analysis failed." } });
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    const code = error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_LIMIT";
    return res.status(400).json({ error: { code, message: error.message } });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const code = message.startsWith("Unsupported file extension") ? "UNSUPPORTED_FILE_TYPE" : "REQUEST_FAILED";
  return res.status(400).json({ error: { code, message } });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

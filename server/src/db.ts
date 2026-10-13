import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const configuredPath = process.env.DATABASE_PATH ?? "./data/workbench.sqlite";
const dbPath = path.resolve(process.cwd(), configuredPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    instruction TEXT NOT NULL,
    document_ids_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

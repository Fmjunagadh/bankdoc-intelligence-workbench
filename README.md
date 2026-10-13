# BankDoc Intelligence — Multi-Document Intelligence Workbench

A time-boxed full-stack demo for reviewing **synthetic banking documents**. It extracts supported facts from each document independently, compares them, and preserves source evidence for every finding. It is a demo, not a credit-decision system.

## Architecture & Design Documentation

- [Data Architecture](docs/Architecture_Diagram.svg)
- [System Design](docs/System-Diagram.svg)
- [High-Level Design (HLD)](docs/HLD.svg)
- [Low-Level Design (LLD)](docs/LLD.svg)

- `client/`: React + TypeScript + Vite UI.
- `server/`: Node.js + Express + TypeScript API.
- SQLite stores document metadata, extracted text and analysis history.
- Modular parsers support text PDF, TXT and CSV.
- A deterministic mock analyzer extracts a small set of banking fields and returns structured findings with provenance. No external API key is required.

## Requirements
- Node.js 20+ and npm. Git recommended.

## Run locally (VS Code)
1. Extract this ZIP. In VS Code, choose **File → Open Folder** and select `multi-document-intelligence-workbench`.
2. Open a terminal in VS Code. Run the API in Terminal 1:
   ```bash
   cd server
   ```
   On Windows PowerShell, copy `.env.example` to `.env` using `Copy-Item .env.example .env`; on macOS/Linux use `cp .env.example .env`. Then run `npm install` and `npm run dev`.
3. Open a second terminal and run the UI:
   ```bash
   cd client
   npm install
   npm run dev
   ```
4. Open the local URL printed by Vite, normally `http://localhost:5173`.
5. Upload all three files from `sample-documents/`, keep or edit the prompt, and click **Analyze documents**.
6. Verify the income-versus-account-credits finding and its evidence. Click **Copy JSON** to test copying.

## API and tests
- Health check: `http://localhost:4000/api/health`
- API test: from the `server/` folder, run `npm test`.
- TypeScript build: from `server/`, run `npm run build`.

## Supported behavior
- Multi-file upload and per-file processing errors.
- PDF with selectable text, plain text, and CSV. Scanned PDFs are not OCR-processed and return an explanatory error.
- User-defined analysis instruction (up to 4,000 characters).
- Per-document facts, cross-document comparisons, missing-field warnings, evidence and source document names.
- Copy structured output as JSON.
- SQLite metadata and analysis history storage.

## Assumptions and limitations
- The analyzer is deterministic/mock, **not a real LLM**. It recognizes a limited set of field labels. State this during the demo.
- CSV transaction values are illustrative and synthetic. Do not use this demo for actual underwriting or credit decisions.
- Name differences such as `Asha Rao` and `Asha R. Rao` are possible variations, not proof of identity or fraud.
- A lower account-credit figure is only a review flag: credits may include partial periods, deductions or non-salary transfers.
- The parser truncates long text; this MVP does not implement OCR, semantic chunking, or token-aware processing.
- Authentication, role-based access, malware scanning and production retention controls are not implemented.

## Security considerations
- Use synthetic documents only.
- Server-side filename handling, extension allow-list, upload limits and temporary-file cleanup are implemented.
- `.env` is excluded from Git; do not commit secrets or real customer data.
- Production requires authentication/authorization, rate limits, malware scanning, encryption, retention controls, audit access controls, PII redaction, secure object storage and validated LLM outputs.

## Productionisation
Add OCR for scanned files, asynchronous processing queues, per-tenant authorization, a schema-validated real LLM provider, chunking for large files, explicit evidence offsets/page numbers, monitoring, and human approval for consequential decisions.

## Synthetic sample documents
- `sample-documents/loan-application.txt`
- `sample-documents/salary-certificate.txt`
- `sample-documents/account-statement.csv`

## AI Tools Disclosure & Development Methodology

During the development and engineering of this Bank Document Intelligence Workbench project, AI tools were utilized transparently as collaborative aids to accelerate understanding, design, and documentation:

1. **ChatGPT (Conceptual Understanding & Guidance):** 
   * Used during the initial research and planning phase to understand multi-document intelligence workflows, data normalization patterns, and structured AI risk-scoring strategies.
2. **Gemini (Architecture & System Design):** 
   * Used as a personal AI collaborator to design and format IT-standard system architecture specifications, including C4 Model diagrams, Container High-Level Architecture (HLD), Sequence Low-Level Design (LLD), and Entity-Relationship Data Models (ERDs) as production-grade SVGs.

### Personal Architectural & Implementation Decisions
While AI tools assisted with high-level conceptualization and visual blueprinting, the actual engineering, implementation, and architectural decisions were executed personally:
* **Modular Pipeline Architecture:** Personally designed the separation between `documentProcessor.ts` (handling file reading and format parsing) and `analysisProvider.ts` (handling rule-based and structured extraction logic) to maintain loose coupling.
* **Database & Provenance Design:** Implemented SQLite via `better-sqlite3` (`db.ts`) with strict relational mapping (`DOCUMENTS` and `PROCESSING_LOGS`) to ensure individual document boundaries and provenance are never merged or lost.
* **Robust TypeScript & Error Handling:** Handled input validation, secure file handling, and fallback error states across the Express backend and React frontend.

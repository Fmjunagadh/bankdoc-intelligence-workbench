# Monitored 60-minute session checklist

## Before the session
- Install Node.js 20+ and VS Code.
- Confirm you are allowed to use a prepared starter/AI-generated code under the evaluator's rules. If the repository must be created live, create it live and disclose use of this starter honestly.
- Prepare only synthetic documents.

## During the session
1. Share your screen and create the repository at the beginning, as instructed.
2. Add the project files and commit: `git add .` then `git commit -m "Initial banking document workbench"`.
3. Start API: `cd server`, copy `.env.example` to `.env`, `npm install`, `npm run dev`.
4. In a second terminal start UI: `cd client`, `npm install`, `npm run dev`.
5. Open the Vite URL. Upload all three files in `sample-documents/`.
6. Analyze using the default prompt. Show the income mismatch, source filenames and evidence.
7. Click Copy JSON.
8. Run `npm test` and `npm run build` in `server/`. If anything fails, explain and fix it transparently.
9. Commit changes: `git add .` then `git commit -m "Add banking comparison and provenance test"`.
10. Verify `.env` is not staged, then push to your repository.

## Demo recording (only if allowed/required)
- Ask the evaluator whether recording is permitted and whether they want a separate video. The monitored screen-share itself may be the required recording.
- If permitted on Windows, use Snipping Tool screen recording or Xbox Game Bar (`Win + Alt + R`) if supported; OBS Studio is another option.
- Record 4–6 minutes: (1) problem and architecture, (2) upload three synthetic documents, (3) analyze and show source evidence, (4) copy JSON, (5) explain limitations/mock provider and test.
- Do not record passwords, API keys, private messages or real customer data.

## Suggested explanation
"I used React and TypeScript for the UI, Express and TypeScript for the API, SQLite for persistence, and modular parsers for PDF/TXT/CSV. Each document is extracted separately and retains its own ID and filename. The deterministic analyzer compares a bounded set of banking fields and returns structured findings with evidence. The income difference is a review flag, not a fraud conclusion. The main limitations are no OCR for scanned PDFs and no real LLM provider."

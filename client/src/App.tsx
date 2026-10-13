import { useState } from "react";

const API = "http://localhost:4000/api";

type UploadedDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  characterCount: number;
};

type Finding = {
  category: string;
  finding: string;
  documents: string[];
  evidence: string[];
  confidence: number;
  type: "FACT" | "AI_INTERPRETATION";
};

type AnalysisResponse = {
  instruction: string;
  documentFacts: Array<{ documentId: string; fileName: string; facts: Record<string, string> }>;
  findings: Finding[];
};

export default function App() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [instruction, setInstruction] = useState("Review this synthetic loan file. Compare applicant names, declared monthly income, account credits and obligations. Identify discrepancies and missing information, and cite each source document.");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function uploadDocuments() {
    if (!files?.length) {
      setError("Choose at least one PDF, TXT, or CSV file.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("documents", file));
    try {
      const response = await fetch(`${API}/documents/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok && !data.documents?.length) throw new Error(data.error?.message ?? "Upload failed.");
      setDocuments((previous) => [...previous, ...(data.documents ?? [])]);
      if (data.errors?.length) setMessage(data.errors.map((item: { fileName: string; message: string }) => `${item.fileName}: ${item.message}`).join(" | "));
      else setMessage(`Uploaded ${data.documents.length} document(s).`);
      setFiles(null);
      const input = document.getElementById("file-input") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!documents.length) {
      setError("Upload documents before analyzing.");
      return;
    }
    if (!instruction.trim()) {
      setError("Enter an analysis instruction.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: documents.map((document) => document.id), instruction })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "Analysis failed.");
      setResult(data);
      setMessage("Analysis completed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyResults() {
    if (!result) return;
    const text = JSON.stringify(result, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Structured results copied to clipboard.");
    } catch {
      setError("Clipboard access failed. Select and copy the result JSON manually.");
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="eyebrow">BANKING DOCUMENT REVIEW</div>
        <h1>BankDoc Intelligence</h1>
        <p>Upload multiple files, compare evidence, and trace each finding back to its source.</p>
        <span className="provider">Deterministic mock analysis · no API key required · not a credit decision</span>
      </header>

      <section className="panel">
        <div className="section-heading"><span className="step">01</span><div><h2>Upload documents</h2><p>PDF, TXT, or CSV · synthetic banking documents only · maximum 10 files · 10 MB each</p></div></div>
        <div className="upload-row">
          <input id="file-input" type="file" multiple accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv" onChange={(event) => setFiles(event.target.files)} />
          <button onClick={uploadDocuments} disabled={busy}>{busy ? "Working…" : "Upload files"}</button>
        </div>
        {documents.length > 0 && <div className="document-list">
          {documents.map((document) => <div className="document" key={document.id}>
            <span className="file-icon">FILE</span>
            <div className="document-meta"><strong>{document.fileName}</strong><small>{document.mimeType} · {document.characterCount.toLocaleString()} extracted characters</small></div>
            <span className="check">Ready</span>
          </div>)}
        </div>}
      </section>

      <section className="panel">
        <div className="section-heading"><span className="step">02</span><div><h2>Analysis instruction</h2><p>Tell the workbench what to compare or extract.</p></div></div>
        <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={4000} rows={4} placeholder="Compare financial values and identify missing information…" />
        <div className="action-row"><small>{instruction.length}/4000 characters</small><button onClick={analyze} disabled={busy || !documents.length}>{busy ? "Analyzing…" : "Analyze documents"}</button></div>
      </section>

      {(message || error) && <div className={error ? "notice error" : "notice"}>{error || message}</div>}

      {result && <section className="panel results">
        <div className="section-heading"><span className="step">03</span><div><h2>Analysis results</h2><p>{result.findings.length} findings · evidence retained for each finding</p></div></div>
        <div className="action-row result-actions"><span className="legend"><i className="dot fact" /> Fact <i className="dot interpretation" /> Interpretation</span><button className="secondary" onClick={copyResults}>Copy JSON</button></div>
        <div className="findings">
          {result.findings.map((finding, index) => <article className="finding" key={`${finding.category}-${index}`}>
            <div className="finding-top"><span className="category">{finding.category}</span><span className={`type ${finding.type === "FACT" ? "fact-label" : "interpretation-label"}`}>{finding.type === "FACT" ? "FACT" : "AI INTERPRETATION"}</span></div>
            <h3>{finding.finding}</h3>
            <div className="evidence-title">Evidence</div>
            <ul>{finding.evidence.map((item, evidenceIndex) => <li key={evidenceIndex}>{item}</li>)}</ul>
            <div className="source-row"><strong>Sources:</strong> {finding.documents.join(" · ")}</div>
            <div className="confidence">Rule confidence: {Math.round(finding.confidence * 100)}% <span>(heuristic, not a calibrated probability)</span></div>
          </article>)}
        </div>
        <details className="facts">
          <summary>View extracted facts per document</summary>
          {result.documentFacts.map((document) => <div key={document.documentId} className="fact-document"><strong>{document.fileName}</strong><pre>{JSON.stringify(document.facts, null, 2)}</pre></div>)}
        </details>
      </section>}

      <footer>Demo uses synthetic data. Verify every finding against the original document before relying on it.</footer>
    </main>
  );
}

export type FindingType = "FACT" | "AI_INTERPRETATION";

export interface DocumentInput {
  id: string;
  fileName: string;
  mimeType: string;
  extractedText: string;
}

export interface Finding {
  category: string;
  finding: string;
  documents: string[];
  evidence: string[];
  confidence: number;
  type: FindingType;
}

export interface AnalysisResult {
  documentFacts: Array<{
    documentId: string;
    fileName: string;
    facts: Record<string, string>;
  }>;
  findings: Finding[];
}

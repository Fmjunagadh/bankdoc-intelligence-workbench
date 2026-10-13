import { describe, expect, it } from "vitest";
import { MockAnalysisProvider } from "./analysisProvider.js";
import type { DocumentInput } from "./types.js";

describe("MockAnalysisProvider", () => {
  it("flags an income difference and preserves evidence provenance", async () => {
    const documents: DocumentInput[] = [
      { id: "1", fileName: "loan-application.txt", mimeType: "text/plain", extractedText: "Applicant Name: Asha Rao\nDeclared Monthly Income: INR 75,000\nRequested Loan: INR 500,000\nExisting Monthly Obligations: INR 12,000" },
      { id: "2", fileName: "account-summary.txt", mimeType: "text/plain", extractedText: "Account Holder: Asha Rao\nAverage Monthly Credits: INR 62,000" },
      { id: "3", fileName: "salary-certificate.txt", mimeType: "text/plain", extractedText: "Applicant: Asha R. Rao\nMonthly Salary: INR 75,000\nEmployment Start Date: 1 March 2024" }
    ];
    const result = await new MockAnalysisProvider().analyze(documents, "Compare declared income with supporting evidence");
    const income = result.findings.find((finding) => finding.category === "Income vs account credits");
    expect(income).toBeDefined();
    expect(income?.documents).toEqual(["loan-application.txt", "account-summary.txt"]);
    expect(income?.evidence).toContain("loan-application.txt: monthly income 75,000");
    expect(income?.finding).toContain("does not establish misrepresentation");
  });
});

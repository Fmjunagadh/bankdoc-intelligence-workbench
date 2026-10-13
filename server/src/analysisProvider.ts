import type { AnalysisResult, DocumentInput, Finding } from "./types.js";

export interface AnalysisProvider {
  analyze(documents: DocumentInput[], instruction: string): Promise<AnalysisResult>;
}

function extractFacts(text: string): Record<string, string> {
  const facts: Record<string, string> = {};
  const patterns: Array<[string, RegExp]> = [
    ["applicantName", /^(?:Applicant(?: Name)?|Customer Name|Account Holder)\s*:\s*(.+)$/im],
    ["monthlyIncome", /^(?:Declared Monthly Income|Monthly Salary|Monthly Income|Net Monthly Salary)\s*:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/im],
    ["monthlyObligations", /^(?:Existing Monthly Obligations|Monthly Obligations|EMI Obligations)\s*:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/im],
    ["loanAmount", /^(?:Requested Loan|Loan Amount|Requested Loan Amount)\s*:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/im],
    ["averageMonthlyCredits", /^(?:Average Monthly Credits|Monthly Average Credits|Average Credits)\s*:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/im],
    ["employmentStartDate", /^(?:Employment Start Date|Date of Joining|Joining Date)\s*:\s*(.+)$/im],
    ["issueDate", /^(?:Issue Date|Certificate Date|Statement Period)\s*:\s*(.+)$/im]
  ];
  for (const [key, regex] of patterns) {
    const match = text.match(regex);
    if (match?.[1]) facts[key] = match[1].trim();
  }
  // Also ingest CSV rows represented as "column: value" by the CSV processor.
  for (const line of text.split(/\r?\n/)) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase().replace(/[^a-z]/g, "");
    const value = rest.join(":").trim().replace(/^(?:INR|Rs\.?|₹)\s*/i, "");
    const aliases: Record<string, string> = {
      applicant: "applicantName", applicantname: "applicantName", customername: "applicantName", accountholder: "applicantName",
      declaredmonthlyincome: "monthlyIncome", monthlyincome: "monthlyIncome", monthlysalary: "monthlyIncome", netmonthlysalary: "monthlyIncome",
      existingmonthlyobligations: "monthlyObligations", monthlyobligations: "monthlyObligations", emiobligations: "monthlyObligations",
      requestedloan: "loanAmount", loanamount: "loanAmount", requestedloanamount: "loanAmount",
      averagemonthlycredits: "averageMonthlyCredits", monthlyaveragecredits: "averageMonthlyCredits", averagecredits: "averageMonthlyCredits",
      employmentstartdate: "employmentStartDate", dateofjoining: "employmentStartDate", joiningdate: "employmentStartDate",
      issuedate: "issueDate", certificatedate: "issueDate", statementperiod: "issueDate"
    };
    const factKey = aliases[key];
    if (factKey && !facts[factKey]) facts[factKey] = value;
  }
  // If CSV contains transaction rows, calculate the average credit amount from a Credit column.
  const lines = text.split(/\r?\n/);
  if (!facts.averageMonthlyCredits && lines.length > 1) {
    const header = lines[0].split(":").map((x) => x.trim().toLowerCase());
    const creditIndex = header.findIndex((x) => x === "credit" || x === "creditamount" || x === "creditinr");
    const monthIndex = header.findIndex((x) => x === "month" || x === "statementmonth");
    if (creditIndex >= 0) {
      const amounts = lines.slice(1).map((line) => line.split(":")[creditIndex]?.replace(/[,₹\s]/g, "")).map(Number).filter((n) => Number.isFinite(n) && n > 0);
      const periods = monthIndex >= 0 ? new Set(lines.slice(1).map((line) => line.split(":")[monthIndex]).filter(Boolean)).size : amounts.length;
      if (amounts.length && periods) facts.averageMonthlyCredits = String(Math.round(amounts.reduce((a, b) => a + b, 0) / periods));
    }
  }
  return facts;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\b(mr|mrs|ms|dr)\b/g, "").replace(/[^a-z0-9]/g, "");
}
function numberValue(value: string): number | null {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export class MockAnalysisProvider implements AnalysisProvider {
  async analyze(documents: DocumentInput[], instruction: string): Promise<AnalysisResult> {
    if (!instruction.trim()) throw new Error("An analysis instruction is required.");
    const documentFacts = documents.map((doc) => ({ documentId: doc.id, fileName: doc.fileName, facts: extractFacts(doc.extractedText) }));
    const findings: Finding[] = [];
    const fields: Array<{ label: string; key: string; normalize?: (v: string) => string }> = [
      { label: "Applicant name", key: "applicantName", normalize: normalizeName },
      { label: "Monthly income / salary", key: "monthlyIncome", normalize: (v) => String(numberValue(v)) },
      { label: "Monthly financial credits", key: "averageMonthlyCredits", normalize: (v) => String(numberValue(v)) },
      { label: "Existing monthly obligations", key: "monthlyObligations", normalize: (v) => String(numberValue(v)) },
      { label: "Requested loan amount", key: "loanAmount", normalize: (v) => String(numberValue(v)) },
      { label: "Employment start date", key: "employmentStartDate" }
    ];
    for (const field of fields) {
      const present = documentFacts.filter((doc) => Boolean(doc.facts[field.key])).map((doc) => ({ fileName: doc.fileName, value: doc.facts[field.key] as string }));
      if (present.length < 2) continue;
      const distinct = new Set(present.map((item) => (field.normalize ?? ((v: string) => v.trim().toLowerCase()))(item.value)));
      const differs = distinct.size > 1;
      findings.push({
        category: field.label,
        finding: differs ? `${field.label} differs across the supplied documents. Review the source records before making a decision.` : `${field.label} appears consistent across the documents containing this field.`,
        documents: present.map((item) => item.fileName),
        evidence: present.map((item) => `${item.fileName}: ${item.value}`),
        confidence: differs ? 0.9 : 0.85,
        type: differs ? "AI_INTERPRETATION" : "FACT"
      });
    }
    const income = documentFacts.find((d) => d.facts.monthlyIncome)?.facts.monthlyIncome;
    const credits = documentFacts.find((d) => d.facts.averageMonthlyCredits)?.facts.averageMonthlyCredits;
    if (income && credits && numberValue(income) !== null && numberValue(credits) !== null && numberValue(income)! > numberValue(credits)!) {
      const incomeDoc = documentFacts.find((d) => d.facts.monthlyIncome)!;
      const creditsDoc = documentFacts.find((d) => d.facts.averageMonthlyCredits)!;
      findings.push({
        category: "Income vs account credits",
        finding: `Declared monthly income (${income}) is higher than the extracted average monthly account credits (${credits}). This is a review flag only; account credits may include partial periods, deductions, or non-salary transactions. It does not establish misrepresentation.`,
        documents: [incomeDoc.fileName, creditsDoc.fileName],
        evidence: [`${incomeDoc.fileName}: monthly income ${income}`, `${creditsDoc.fileName}: average monthly credits ${credits}`],
        confidence: 0.9,
        type: "AI_INTERPRETATION"
      });
    }
    for (const doc of documentFacts) {
      for (const [key, label] of [["applicantName", "applicant name"], ["monthlyIncome", "monthly income or salary"], ["monthlyObligations", "existing monthly obligations"], ["loanAmount", "requested loan amount"]] as const) {
        if (!doc.facts[key]) findings.push({ category: "Missing information", finding: `${label} was not extracted from ${doc.fileName}. This does not prove the source document lacks the information.`, documents: [doc.fileName], evidence: [`The current parser did not extract a supported ${label} field from ${doc.fileName}.`], confidence: 0.75, type: "AI_INTERPRETATION" });
      }
    }
    if (findings.length === 0) findings.push({ category: "General", finding: `No supported comparison was generated for: "${instruction}". The deterministic mock analyzer recognizes a limited set of banking fields.`, documents: documents.map((doc) => doc.fileName), evidence: documents.map((doc) => `${doc.fileName}: ${doc.extractedText.slice(0, 160)}`), confidence: 0.5, type: "AI_INTERPRETATION" });
    return { documentFacts, findings };
  }
}

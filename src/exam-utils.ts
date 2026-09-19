export function getExamCategory(exam?: string | null): string {
  const normalized = (exam ?? "").trim();
  if (!normalized) return "Other";

  const upper = normalized.toUpperCase();
  if (upper.includes("CIVIL SERVICES") || upper.includes("CSE") || upper.includes("UPSC")) return "UPSC CSE";
  if (upper.includes("NDA")) return "NDA";
  if (upper.includes("CDS")) return "CDS";
  if (upper.includes("CAPF")) return "CAPF";
  if (upper.includes("BPSC")) return "BPSC";
  if (upper.includes("CISF")) return "CISF";
  if (upper.includes("EPFO EO/AO")) return "EPFO EO/AO";
  if (upper.includes("STATE PCS") || /\bPCS\b/.test(upper)) return "State PCS";

  return normalized
    .replace(/\s*[-–]?\s*(?:19|20)\d{2}\s*$/u, "")
    .replace(/\s+\([12]\)\s*$/u, "")
    .trim();
}

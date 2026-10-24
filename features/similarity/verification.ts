import { z } from "zod";

const text = z.string().trim().min(1);
const checkNames = ["question", "answer", "explanation", "master_classification", "concepts"] as const;
const check = z.object({
  status: z.enum(["not_checked", "passed", "pending_review"]),
  reason: text.nullable().default(null),
  evidence: z.array(text),
});
const issue = z.object({
  code: text.regex(/^[A-Z][A-Z0-9_]*$/),
  check: z.enum(checkNames),
  reason: text,
  requiredAction: text,
  evidence: z.array(text),
});
export const sourceQualityWarningSchema = issue.extend({
  code: z.enum(["SOURCE_ROUTE_ROUNDING_REVIEW_FLAG", "CLASS_SIZE_NONINTEGER_REVIEW_FLAG"]),
  check: z.enum(["question", "answer", "explanation"]),
  evidence: z.array(text).min(1),
  acknowledgedBy: text,
  acknowledgedAt: z.string().datetime(),
  authorizationEvidence: z.array(text).min(1),
});

export const questionVerificationSchema = z.object({
  status: z.enum(["unverified", "verified", "pending_review"]),
  reason: text.nullable().default(null),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractionContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  updatedAt: z.string().datetime(),
  reviewedBy: text.nullable(),
  masterClassification: z.object({
    subjectId: text.regex(/^S\d+$/),
    topicId: text.regex(/^S\d+-T\d+$/),
  }).optional(),
  checks: z.object({
    question: check, answer: check, explanation: check, master_classification: check, concepts: check,
  }),
  issues: z.array(issue),
  warnings: z.array(sourceQualityWarningSchema).optional(),
  corrections: z.array(z.object({
    field: z.enum(["question", "options", "answer", "explanation", "subject", "topic"]),
    reason: text,
    auditReference: text,
  })),
}).superRefine((value, context) => {
  if (value.warnings?.length && (!value.reviewedBy || value.status === "verified")) {
    context.addIssue({ code: "custom", message: "Acknowledged source warnings require a reviewer and cannot be marked fully verified." });
  }
  if (value.warnings?.some(warning => value.issues.some(issue => issue.code === warning.code))) {
    context.addIssue({ code: "custom", message: "A source warning cannot also be an unresolved blocking issue." });
  }
  if (value.checks.master_classification.status === "passed" && !value.masterClassification) {
    context.addIssue({ code: "custom", message: "A passed subject/topic check requires master subject and topic IDs." });
  }
  if (value.status === "verified" &&
      (!value.reviewedBy || !value.masterClassification || !value.extractionContentHash || value.issues.length || checkNames.some(name =>
        value.checks[name].status !== "passed" || !value.checks[name].evidence.length))) {
    context.addIssue({
      code: "custom",
      message: "Verified questions require a reviewer, master IDs, a reviewed extraction hash, evidence for all five passed checks, and no unresolved issues.",
    });
  }
  if (value.status === "pending_review" && !value.issues.length) {
    context.addIssue({ code: "custom", message: "Pending review requires a specific issue and required follow-up." });
  }
  if (value.issues.length && value.status !== "pending_review") {
    context.addIssue({ code: "custom", message: "Unresolved issues require pending_review status." });
  }
  if (checkNames.some(name => value.checks[name].status === "pending_review") && value.status !== "pending_review") {
    context.addIssue({ code: "custom", message: "A blocked check requires pending_review status." });
  }
  for (const issue of value.issues) {
    if (value.checks[issue.check].status !== "pending_review") {
      context.addIssue({ code: "custom", message: `Issue ${issue.code} must block its ${issue.check} check.` });
    }
  }
  for (const name of checkNames) {
    if (value.checks[name].status === "passed" && !value.checks[name].evidence.length) {
      context.addIssue({ code: "custom", message: `A passed ${name} check requires evidence.` });
    }
    if (value.checks[name].status === "pending_review" && !value.issues.some(issue => issue.check === name)) {
      context.addIssue({ code: "custom", message: `A blocked ${name} check requires a specific reason.` });
    }
  }
}).transform(value => {
  const withReason = (name: typeof checkNames[number]) => ({
    ...value.checks[name],
    reason: value.checks[name].status === "pending_review"
      ? value.issues.filter(issue => issue.check === name).map(issue => issue.reason).join(" ")
      : value.checks[name].reason ?? (value.checks[name].status === "not_checked"
        ? "Not checked yet." : "Check passed; see recorded evidence."),
  });
  return {
    ...value,
    reason: value.status === "pending_review" ? value.issues.map(issue => issue.reason).join(" ")
      : value.status === "unverified" ? "Full verification has not been completed." : null,
    checks: {
      question: withReason("question"), answer: withReason("answer"), explanation: withReason("explanation"),
      master_classification: withReason("master_classification"), concepts: withReason("concepts"),
    },
  };
});

export type QuestionVerification = z.infer<typeof questionVerificationSchema>;
export type VerificationIssue = QuestionVerification["issues"][number];

export class QuestionVerificationConflictError extends Error {}

export function hasAcknowledgedSourceWarning(
  verification: QuestionVerification | undefined, issue: VerificationIssue,
): boolean {
  return !!verification?.reviewedBy && !!verification.warnings?.some(warning =>
    warning.code === issue.code && warning.check === issue.check);
}

export function validateVerificationBinding(
  verification: QuestionVerification | undefined,
  sourceContentHash: string,
  extractionContentHash: string,
): void {
  if (verification && (verification.sourceContentHash !== sourceContentHash ||
      (verification.status === "verified" && verification.extractionContentHash !== extractionContentHash))) {
    throw new Error("Verification refers to a different source or extraction; submit a new source-bound review.");
  }
}

export function unverifiedQuestion(sourceContentHash: string): QuestionVerification {
  return questionVerificationSchema.parse({
    status: "unverified", sourceContentHash, updatedAt: new Date().toISOString(), reviewedBy: null,
    checks: Object.fromEntries(checkNames.map(name => [name, { status: "not_checked", evidence: [] }])),
    issues: [], corrections: [],
  });
}

export function flagQuestionForReview(
  verification: QuestionVerification,
  issue: VerificationIssue,
): QuestionVerification {
  return questionVerificationSchema.parse({
    ...verification,
    status: "pending_review",
    updatedAt: new Date().toISOString(),
    checks: { ...verification.checks, [issue.check]: { status: "pending_review", evidence: issue.evidence } },
    ...(verification.warnings && { warnings: verification.warnings.filter(warning => warning.code !== issue.code) }),
    issues: [...verification.issues.filter(previous => previous.code !== issue.code || previous.check !== issue.check), issue],
  });
}

export function reviewFlag(issue: VerificationIssue): string {
  return `REVIEW_FLAG[${issue.code}]: ${issue.reason}`;
}

export function verificationForSource(
  previous: QuestionVerification | undefined,
  sourceContentHash: string,
  unchangedExtraction: boolean,
): QuestionVerification {
  if (previous?.sourceContentHash === sourceContentHash &&
      (unchangedExtraction || previous.status === "pending_review")) return previous;
  if (previous?.sourceContentHash === sourceContentHash) {
    return questionVerificationSchema.parse({
      ...previous,
      status: "unverified",
      extractionContentHash: undefined,
      updatedAt: new Date().toISOString(),
      checks: {
        ...previous.checks,
        concepts: { status: "not_checked", reason: "Concept extraction changed; review the new assignments.", evidence: [] },
      },
    });
  }
  let current = unverifiedQuestion(sourceContentHash);
  current.corrections = previous?.corrections ?? [];
  if (previous?.status === "pending_review") {
    for (const issue of previous.issues) current = flagQuestionForReview(current, issue);
  }
  for (const warning of previous?.warnings ?? []) {
    current = flagQuestionForReview(current, warning);
  }
  return current;
}

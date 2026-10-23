import type { SourceQuestion } from "../../features/similarity/schema";
import type { QuestionSourceContainer } from "../../features/similarity/types";

export type ContentReviewIssue = {
  code: string;
  check: "answer" | "explanation";
  reason: string;
  requiredAction?: string;
};

export type ContentVerification = {
  checks?: Partial<Record<"answer" | "explanation", { status: string; reason?: string | null }>>;
  issues?: { code: string; check: string; reason: string; requiredAction?: string }[];
};

export function pendingContentIssues(verification?: ContentVerification): ContentReviewIssue[] {
  return (["answer", "explanation"] as const).flatMap(check => {
    if (verification?.checks?.[check]?.status !== "pending_review") return [];
    const issues = (verification.issues ?? []).filter(issue => issue.check === check);
    return issues.length ? issues.map(issue => ({ ...issue, check })) : [{
      check, code: `${check.toUpperCase()}_REVIEW_REQUIRED`,
      reason: verification.checks[check].reason || `The ${check} needs review.`,
    }];
  });
}

export type CorrectionVersion = {
  revision: number;
  sourceContentHash: string;
  answer: string;
  explanation: string;
  comment: string;
  savedAt: string;
  reviewedAt?: string;
};

export type CorrectionDraft = CorrectionVersion & { status: "draft"; history: CorrectionVersion[] };

export type ReviewSearchQuestion = { question: string; exam?: string | null; year?: string | number | null };

export type QuestionReviewDetails = {
  sourceContentHash: string;
  issues: ContentReviewIssue[];
  original: ReviewSearchQuestion & { answer: string; explanation: string; options: string[] };
  draft: CorrectionDraft | null;
  staleDraft: boolean;
};

export type ReviewQuestion = {
  sourceContainer: QuestionSourceContainer;
  questionId: string;
  question: SourceQuestion;
  sourceContentHash: string;
  issues: ContentReviewIssue[];
  uiReview?: UiReviewStatus;
};

export type ReviewFilter = "either" | "answer" | "explanation";
export type ReviewProgressFilter = "all" | "not_reviewed" | "reviewed";
export type UiReviewStatus = { status: "not_reviewed" } | { status: "reviewed"; reviewedAt: string; revision: number };

export function reviewStateForDraft(
  draft: Pick<CorrectionDraft, "sourceContentHash" | "revision" | "reviewedAt"> | null | undefined,
  sourceContentHash: string,
): UiReviewStatus {
  return draft?.reviewedAt && draft.sourceContentHash === sourceContentHash
    ? { status: "reviewed", reviewedAt: draft.reviewedAt, revision: draft.revision }
    : { status: "not_reviewed" };
}

export function reviewIssueSummary(issue: ContentReviewIssue): string {
  const reason = issue.reason
    .replace(/^REVIEW_FLAG\[[^\]]+\]:\s*/i, "")
    .replace(/^The stored extraction records an unresolved answer\/explanation source conflict\.\s*/i, "")
    .replace(/^Bounded first-pass finding:\s*/i, "")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (issue.code === "OFFICIAL_KEY_PRIMARY_MEMBERSHIP_CONFLICT" && /Hume\/B/i.test(reason) && /nominal.*member/i.test(reason)) {
    return "The official key selects Hume (B), but the cited 1884 letter says he remained a nominal Society member. The answer needs clarification.";
  }
  if (issue.code === "ARCHIVED_UPSC_KEY_ANSWER_MISMATCH" && /has now been corrected|already corrected/i.test(reason)) {
    return "The answer has been corrected, but its explanation and supporting review still need validation.";
  }
  const summary = reason.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") ||
    `The ${issue.check} needs checking against the original source.`;
  return summary.length <= 280 ? summary : `${summary.slice(0, 277).replace(/\s+\S*$/, "")}...`;
}

export function filterReviewQuestions(
  reviews: ReviewQuestion[], search: string, check: ReviewFilter, progress: ReviewProgressFilter = "all",
): ReviewQuestion[] {
  const query = search.trim().toLowerCase();
  return reviews.filter(review => {
    if (progress !== "all" && (review.uiReview?.status ?? "not_reviewed") !== progress) return false;
    if (!review.issues.some(issue => check === "either" || issue.check === check)) return false;
    const source = review.question;
    return !query || [review.sourceContainer, review.questionId, source.question, ...source.options,
      source.answer, source.explanation, source.exam, source.year, source.subject, source.topic,
      ...review.issues.flatMap(issue => [issue.code, issue.reason, issue.requiredAction])]
      .filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

export function reviewSearchUrl(question: ReviewSearchQuestion, issue: ContentReviewIssue): string {
  const plain = (text: string) => text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|nbsp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (original, entity: string) => {
      const named: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
      if (!entity.startsWith("#")) return named[entity.toLowerCase()];
      const code = entity.toLowerCase().startsWith("#x") ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
    }).replace(/\s+/g, " ").trim();
  const query = [question.question, question.exam, question.year, reviewIssueSummary(issue)]
    .filter(value => value != null && value !== "").map(value => plain(String(value))).join(" ").trim();
  return `https://www.google.com/search?${new URLSearchParams({ q: query })}`;
}

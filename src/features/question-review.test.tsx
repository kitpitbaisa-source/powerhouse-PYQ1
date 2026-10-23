import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionReviewPanel } from "./QuestionReviewPanel";
import { QuestionReviewQueue } from "./QuestionReviewQueue";
import { filterReviewQuestions, pendingContentIssues, reviewSearchUrl, reviewStateForDraft, type ReviewQuestion } from "./question-review";
import { sourceQuestionSchema } from "../../features/similarity/schema";

const verification = { checks: { answer: { status: "pending_review" }, concepts: { status: "pending_review" } },
  issues: [{ code: "ANSWER_EXPLANATION_CONFLICT", check: "answer",
    reason: "The stored answer and explanation disagree.", requiredAction: "Check the supplied source." }] };

test("temporary correction controls are admin-only and limited to pending answer/explanation checks", () => {
  const props = { sourceContainer: "questions" as const, questionId: 42, verification };
  assert.equal(renderToStaticMarkup(<QuestionReviewPanel {...props} />), "");
  assert.equal(renderToStaticMarkup(<QuestionReviewPanel {...props} access={{ key: "test", issues: [] }} />), "");
  const markup = renderToStaticMarkup(<QuestionReviewPanel {...props} access={{ key: "" }} />);
  assert.match(markup, /ANSWER_EXPLANATION_CONFLICT/);
  assert.match(markup, /The stored answer and explanation disagree/);
  assert.match(markup, /Unlock the admin portal/);
  assert.doesNotMatch(markup, /<form|Save draft online/);
  const unflagged = { checks: { concepts: { status: "pending_review" }, answer: { status: "not_checked" } } };
  assert.equal(renderToStaticMarkup(<QuestionReviewPanel {...props} verification={unflagged} access={{ key: "test" }} />), "");
});

test("short review summaries preserve full reasons and do not render source HTML", () => {
  const reason = `An ambiguous answer needs checking. ${"Additional original evidence. ".repeat(20)}<img src=x onerror=alert(1)>`;
  const markup = renderToStaticMarkup(<QuestionReviewPanel sourceContainer="state_pcs" questionId={42}
    access={{ key: "test", issues: [{ code: "ANSWER_REVIEW", check: "answer", reason }] }} />);
  assert.match(markup, /Review \/ edit correction draft/);
  assert.match(markup, /\.\.\./);
  assert.doesNotMatch(markup, /<img|value="test"|Bearer test/);
  assert.match(markup, /&lt;img/);
  assert.deepEqual(pendingContentIssues({ checks: { explanation: { status: "pending_review", reason: "Missing explanation evidence." } } }),
    [{ check: "explanation", code: "EXPLANATION_REVIEW_REQUIRED", reason: "Missing explanation evidence." }]);
});

const reviews: ReviewQuestion[] = [
  { sourceContainer: "questions", questionId: "42", sourceContentHash: "source-a",
    question: sourceQuestionSchema.parse({ id: "42", question: "Which planet is nearest?", options: ["Mercury", "Venus"],
      exam: "Prelims", year: "2026", subject: "Science", topic: "Astronomy" }),
    issues: [{ check: "answer", code: "ANSWER_CONFLICT", reason: "Answer contradicts the source." }] },
  { sourceContainer: "state_pcs", questionId: "42", sourceContentHash: "source-b",
    question: sourceQuestionSchema.parse({ id: "42", question: "Describe a river system.", explanation: "Original river explanation." }),
    issues: [{ check: "explanation", code: "EXPLANATION_REVIEW", reason: "Missing supporting evidence." }] },
  { sourceContainer: "english-questions", questionId: "43", sourceContentHash: "source-c",
    question: sourceQuestionSchema.parse({ id: "43", question: "Choose the correct tense." }),
    issues: [{ check: "answer", code: "ANSWER_CONFLICT", reason: "Two options match." },
      { check: "explanation", code: "EXPLANATION_CONFLICT", reason: "Explanation names a different option." }] },
];

test("flagged search covers all banks, IDs, question text, options, metadata and issue reasons", () => {
  assert.equal(filterReviewQuestions(reviews, "", "either").length, 3);
  assert.deepEqual(filterReviewQuestions(reviews, "42", "either").map(review => review.sourceContainer), ["questions", "state_pcs"]);
  for (const query of [" MeRCuRy ", "2026", "astronomy", "contradicts", "answer_conflict"]) {
    assert.equal(filterReviewQuestions(reviews, query, "answer")[0].questionId, "42");
  }
  assert.equal(filterReviewQuestions(reviews, "original river explanation", "either")[0].sourceContainer, "state_pcs");
  assert.equal(filterReviewQuestions(reviews, "state_pcs", "explanation").length, 1);
  assert.equal(filterReviewQuestions(reviews, "river", "answer").length, 0);
  assert.equal(filterReviewQuestions(reviews, "", "answer").length, 2);
  assert.equal(filterReviewQuestions(reviews, "", "explanation").length, 2);
  assert.equal(filterReviewQuestions(reviews, "no matching question", "either").length, 0);
});

test("the main-app review queue shows cross-bank results without exposing locked data", () => {
  const props = { reviews, adminKey: "offline-test", loading: false, error: "", onReload: () => {}, onUnlock: () => {} };
  const markup = renderToStaticMarkup(<QuestionReviewQueue {...props} />);
  assert.match(markup, /Search all flagged questions/);
  assert.match(markup, /3 matching flagged questions of 3/);
  assert.match(markup, /Which planet is nearest/);
  assert.match(markup, /Describe a river system/);
  assert.match(markup, /english-questions/);
  const locked = renderToStaticMarkup(<QuestionReviewQueue {...props} adminKey="" />);
  assert.match(locked, /Unlock admin portal/);
  assert.doesNotMatch(locked, /Which planet|Describe a river|<article/);
  const failed = renderToStaticMarkup(<QuestionReviewQueue {...props} error="Could not load review flags." />);
  assert.match(failed, /role="alert"/);
  assert.doesNotMatch(failed, /<article/);
});

test("UI review progress is source-bound and filters independently of check type and search", () => {
  const saved = { sourceContentHash: "source-a", reviewedAt: "2026-10-23T08:00:00.000Z", revision: 1 };
  assert.equal(reviewStateForDraft(saved, "source-a").status, "reviewed");
  assert.equal(reviewStateForDraft(saved, "changed-source").status, "not_reviewed");
  assert.equal(reviewStateForDraft({ ...saved, reviewedAt: undefined }, "source-a").status, "not_reviewed");
  const progress = reviews.map((review, index) => ({ ...review,
    uiReview: reviewStateForDraft(index === 0 ? saved : null, review.sourceContentHash) }));
  assert.deepEqual(filterReviewQuestions(progress, "", "either", "reviewed").map(review => review.sourceContainer), ["questions"]);
  assert.deepEqual(filterReviewQuestions(progress, "42", "either", "not_reviewed").map(review => review.sourceContainer), ["state_pcs"]);
  assert.equal(filterReviewQuestions(progress, "", "explanation", "reviewed").length, 0);
});

test("Google searches combine plain question text, exam/year and the selected reason, without internal metadata", () => {
  const question = { question: "<b>Which planet &amp; moon?</b><script>hiddenCode()</script>", exam: "UPSC CSE", year: 2026,
    questionId: "internal-question-reference", adminKey: "offline-admin-key" };
  const issue = { check: "answer" as const, code: "INTERNAL_AUDIT_CODE", reason: "The key contradicts the source." };
  const url = new URL(reviewSearchUrl(question, issue));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("q"), "Which planet & moon? UPSC CSE 2026 The key contradicts the source.");
  assert.doesNotMatch(url.search, /hiddenCode|internal-question-reference|offline-admin-key|INTERNAL_AUDIT_CODE/);
  const markup = renderToStaticMarkup(<QuestionReviewPanel sourceContainer="questions" questionId={42}
    access={{ key: "offline-admin-key", issues: [issue], searchQuestion: question }} />);
  assert.match(markup, /Google: question \+ exam \+ reason/);
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.match(markup, /referrerPolicy="no-referrer"/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createSimilarityLoader, toDisplayQuestion } from "./client";
import { highlightSimilarityTerms, similarityHighlightPhrases } from "./highlights";
import type { HighlightEvidence, QuestionReference, SimilarityResponse } from "./types";

const source: QuestionReference = { sourceContainer: "questions", questionId: "418" };
function response(): SimilarityResponse {
  return {
    status: "ready", source, rankingVersion: "test",
    matches: [60, 90].map((score, index) => ({
      sourceContainer: "questions", questionId: String(index + 1), profileId: `questions:${index + 1}`,
      score, relation: "same_concept", reasons: ["Shared concept."], sharedConcepts: [],
      question: {
        kind: "objective", id: String(index + 1), sourceContainer: "questions", questionId: String(index + 1),
        question: "Current source content.", exam: "Test", year: "2026", subject: "History", topic: null,
        options: ["A", "B"], answer: "A", explanation: "Current explanation.",
      },
    })),
  };
}

test("one popup loader deduplicates repeated effects and sorts server results by score", async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async url => {
    requests.push(String(url));
    const questionId = new URL(String(url), "http://localhost").searchParams.get("questionId");
    return Response.json({ ...response(), source: { ...source, questionId } });
  };
  const load = createSimilarityLoader(fetcher);
  const first = load(source, "TEST@gmail.com");
  const repeatedEffect = load(source, "test@gmail.com");
  assert.equal(first, repeatedEffect);
  const result = await first;
  assert.deepEqual(result.matches.map(match => match.score), [90, 60]);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /sourceContainer=questions&questionId=418&email=test%40gmail.com/);
  assert.equal(load(source, "test@gmail.com"), first);
  await load({ ...source, questionId: "2" });
  await createSimilarityLoader(fetcher)(source);
  assert.equal(requests.length, 3);
});

test("missing profiles remain empty and HTTP or malformed response failures are explicit", async () => {
  const loadEmpty = createSimilarityLoader(async () => Response.json({
    status: "pending", source, matches: [], message: "No ready profile.",
  }));
  assert.deepEqual((await loadEmpty(source)).matches, []);
  const loadError = createSimilarityLoader(async () => new Response("Denied", { status: 503 }));
  await assert.rejects(loadError(source), /HTTP 503/);
  const malformed = createSimilarityLoader(async () => Response.json({ ...response(), matches: [{ score: 98 }] }));
  await assert.rejects(malformed(source));
  const mismatched = createSimilarityLoader(async () => Response.json({
    ...response(), source: { ...source, questionId: "other" },
  }));
  await assert.rejects(mismatched(source), /does not match/);
});

test("public question payloads retain source provenance and reject lossy objective IDs", () => {
  const question = response().matches[0].question;
  const display = toDisplayQuestion(question);
  assert.equal(display.id, 1);
  assert.equal(display.sourceContainer, "questions");
  assert.equal(display.question, "Current source content.");
  assert.throws(() => toDisplayQuestion({ ...question, id: "9007199254740993" }), /unsupported question ID/);
  const descriptive = toDisplayQuestion({
    kind: "descriptive", id: "mains-1", sourceContainer: "mains-questions", questionId: "mains-1",
    question: "Discuss.", exam: "UPSC", year: "2026", subject: "History", topic: null,
    paper: "GS I", modelAnswer: "Model answer.",
  });
  assert.equal("modelAnswer" in descriptive && descriptive.modelAnswer, "Model answer.");
  assert.equal(descriptive.id, "mains-1");
});

test("popup responses retain reference and candidate exact-text evidence", async () => {
  const payload = response();
  if (payload.status !== "ready") throw new Error("Expected a ready fixture.");
  payload.sourceHighlights = [{ concept_id: "constitution_making", field: "question", exact_text: "Constituent Assembly" }];
  payload.matches[0].highlights = [
    { concept_id: "constitution_making", field: "option", option_index: 1, exact_text: "Provincial Legislative Assemblies" },
  ];
  const result = await createSimilarityLoader(async () => Response.json(payload))(source);
  if (result.status !== "ready") throw new Error("Expected ready similarity results.");
  assert.deepEqual(result.sourceHighlights, payload.sourceHighlights);
  assert.deepEqual(result.matches.find(match => match.questionId === "1").highlights, payload.matches[0].highlights);
  payload.matches[0].highlights[0].option_index = -1;
  await assert.rejects(createSimilarityLoader(async () => Response.json(payload))(source));
});

test("important exact phrases are selected by field and option index independently of shared concepts", () => {
  const concepts = [{ conceptId: "constitution_making", canonicalName: "Constituent Assembly composition" }];
  const evidence: HighlightEvidence[] = [
    { concept_id: "constitution_making", field: "question", exact_text: "indirect election" },
    { concept_id: "constitution_making", field: "option", option_index: 0, exact_text: "Provincial Legislative Assemblies" },
    { concept_id: "constitution_making", field: "explanation", exact_text: "proportional representation" },
    { concept_id: "other_concept", field: "question", exact_text: "Princely States" },
  ];
  const phrases = similarityHighlightPhrases(evidence, concepts, "question");
  assert.deepEqual(phrases, ["indirect election", "Princely States"]);
  assert.deepEqual(similarityHighlightPhrases(evidence, concepts, "option", 0), ["Provincial Legislative Assemblies"]);
  assert.deepEqual(similarityHighlightPhrases(evidence, concepts, "option", 1), []);
  assert.deepEqual(similarityHighlightPhrases(evidence, concepts, "explanation"), ["proportional representation"]);
  assert.deepEqual(similarityHighlightPhrases(evidence, [], "question"), phrases);
  assert.deepEqual(similarityHighlightPhrases(evidence, [], "option", 0), ["Provincial Legislative Assemblies"]);
  assert.deepEqual(similarityHighlightPhrases([], concepts, "question"), []);
  assert.deepEqual(similarityHighlightPhrases(undefined, concepts, "question"), ["Constituent Assembly composition"]);
  const html = highlightSimilarityTerms("Chosen by indirect election, with Princely States represented.", new Set(), "violet", phrases);
  assert.match(html, />indirect election<\/mark>/);
  assert.match(html, />Princely States<\/mark>/);
});

test("concept highlights keep multiword phrases together and prefer the longer shared concept", () => {
  const html = highlightSimilarityTerms(
    "Discuss MONETARY policy transmission and monetary policy.",
    new Set(["policy"]), "blue", ["monetary policy", "monetary policy transmission"],
  );
  assert.equal((html.match(/<mark /g) || []).length, 2);
  assert.match(html, />MONETARY policy transmission<\/mark>/);
  assert.match(html, />monetary policy<\/mark>/);
  assert.doesNotMatch(html, /<mark[^>]*>[^<]*<mark/);
});

test("concept-only highlighting leaves other matching words and unprofiled questions untouched", () => {
  const text = "Monetary policy transmission affects bank lending. Interest rates influence borrowing.";
  const html = highlightSimilarityTerms(text, new Set(), "violet", [
    "Monetary policy transmission", "Bank lending",
  ]);
  assert.equal((html.match(/<mark /g) || []).length, 2);
  assert.match(html, />Monetary policy transmission<\/mark> affects /);
  assert.match(html, />bank lending<\/mark>\. Interest rates influence borrowing\.$/);
  assert.equal(highlightSimilarityTerms(text, new Set(), "violet", []), text);
});

test("concept highlights preserve markup and entities and do not match inside other words", () => {
  const html = highlightSimilarityTerms(
    '<a title="tax" href="/tax">taxation &amp; tax</a> and fiscal&nbsp;policy.',
    new Set(["tax"]), "indigo", ["fiscal policy"],
  );
  assert.match(html, /^<a title="tax" href="\/tax">taxation &amp; /);
  assert.match(html, />tax<\/mark><\/a>/);
  assert.match(html, />fiscal&nbsp;policy<\/mark>/);
  assert.equal((html.match(/<mark /g) || []).length, 2);
});

test("concept names with punctuation are literal and word-only fallback still handles plurals", () => {
  const html = highlightSimilarityTerms(
    "Article 32 (rights), rights and banking.",
    new Set(["right"]), "blue", ["Article 32 (rights)", ".*"],
  );
  assert.match(html, />Article 32 \(rights\)<\/mark>/);
  assert.match(html, />rights<\/mark> and banking\.$/);
  assert.equal((html.match(/<mark /g) || []).length, 2);
  assert.equal(highlightSimilarityTerms("No overlap.", new Set(), "blue"), "No overlap.");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mergeQuestionsById, QuestionSimilarityActions, SimilarityQuestionSummary } from "../../App";
import { createSimilarityLoader, toDisplayQuestion } from "./client";
import { highlightSimilarityTerms, similarityHighlightPhrases } from "./highlights";
import type { Question } from "../../types";
import type { HighlightEvidence, QuestionReference, SimilarityResponse } from "./types";

test("question-card similarity actions open the explorer without demo statistics", () => {
  let opened = false;
  const actions = QuestionSimilarityActions({ onExplore: () => { opened = true; } });
  assert.ok(React.isValidElement<{ children: React.ReactElement<{ onClick: () => void }> }>(actions));
  const html = renderToStaticMarkup(actions);
  assert.match(html, /> Similar questions<\/button>/);
  assert.doesNotMatch(html, /PYQs|4 years|Demo/);
  actions.props.children.props.onClick();
  assert.equal(opened, true);
});

test("similarity card subjects use approved master names and retain unresolved questions honestly", () => {
  const source = {
    kind: "objective" as const, sourceContainer: "questions" as const,
    questionId: "1", id: "1", question: "Question wording.", exam: "Test", year: "2026",
    subject: "Polity", topic: null, options: ["A", "B"], answer: "A", explanation: "Explanation.",
  };
  for (const [subjectClassification, label] of [
    [{ subjectId: "S04", subject: "Polity & Constitution" }, "Polity &amp; Constitution"],
    [{ subjectId: "S22", subject: "General Awareness" }, "General Awareness"],
    [null, "Needs classification"],
  ] as const) {
    const display = toDisplayQuestion({ ...source, subjectClassification });
    assert.equal(display.originalSubject, "Polity");
    const html = renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
      question: display, sharedConcepts: [], highlightsEnabled: false, isExpanded: false,
      onAttemptOption: () => {}, onToggleAnswer: () => {},
    }));
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, />Polity</);
    assert.ok(html.includes("Question wording."));
  }
});

test("matching reference questions render both lists as labelled table rows", () => {
  const cases = [
    ["Writer", "Book", ["Trivikram Bhatta", "Somdev", "Jaidev", "Kshemendra"], ["Gita Govinda", "Brihatkathamanjari", "Nal Champu", "Katha Sarit Sagar"]],
    ["Text", "Author", ["Ragamala", "Rasa Kaumudi", "Raga Vibodh", "Chaturdandi Prakashika"], ["Somanath", "Venkatraman", "Pundrik Vitthal", "Sri Kantha"]],
    ["Ruler", "Dynasty", ["Mahendraverman First", "Kadungon", "Amoghavarsha First", "Rajaraja First"], ["Rashtrakuta", "Pallava", "Chola", "Pandya"]],
    ["Essayist", "Treatise", ["Devana Bhatta", "Hemadri", "Madhvacharya", "Ballal Sen"], ["Dan Sagar", "Parashar Madhav", "Chaturvarga Chintamani", "Smriti Chandrika"]],
  ] as const;
  for (const [leftHeader, rightHeader, left, right] of cases) {
    for (const separator of ["\n", "<br/>"]) {
      const intro = "Match List - I with List - II and select the correct answer using the code given below the lists:";
      const text = [
        intro,
        `List - I (${leftHeader}): ${left.map((item, index) => `${String.fromCharCode(65 + index)}. ${item}`).join(", ")}`,
        `List - II (${rightHeader}): ${right.map((item, index) => `${index + 1}. ${item}`).join(", ")}`,
        "Choose the correct code.",
      ].join(separator);
      const html = renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
        question: { id: 1, year: "2025", subject: "History", exam: "Prelims", question: text, options: ["A-3, B-4, C-1, D-2"], answer: "", explanation: "" },
        highlights: [], sharedConcepts: [], isExpanded: false, highlightsEnabled: true,
        onAttemptOption: () => {}, onToggleAnswer: () => {},
      }));
      assert.match(html, /<table /);
      assert.equal((html.match(/<td /g) || []).length, 8);
      assert.ok(html.includes(`>${leftHeader}</th>`));
      assert.ok(html.includes(`>${rightHeader}</th>`));
      left.forEach((item, index) => assert.ok(html.includes(`${String.fromCharCode(65 + index)}. ${item}`)));
      right.forEach((item, index) => assert.ok(html.includes(`${index + 1}. ${item}`)));
      assert.ok(html.includes(intro));
      assert.ok(html.includes("Choose the correct code."));
      assert.ok(html.includes("A-3, B-4, C-1, D-2"));
    }
  }
});

test("matching tables preserve concept highlights and respect the highlight toggle", () => {
  const text = "Match the following:\nList-I (Writer): A. Trivikram Bhatta, B. Somdev\nList-II (Book): 1. Nal Champu, 2. Katha Sarit Sagar\nSelect the correct answer.";
  const render = (highlightsEnabled: boolean) => renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
    question: { id: 1, year: "2025", subject: "History", exam: "Prelims", question: text, options: [], answer: "", explanation: "" },
    highlights: ["Trivikram Bhatta", "Nal Champu", "Select the correct answer."].map(exact_text => ({
      concept_id: "nal-champu", field: "question" as const, exact_text,
    })),
    sharedConcepts: [], isExpanded: false, highlightsEnabled,
    onAttemptOption: () => {}, onToggleAnswer: () => {},
  }));
  const highlighted = render(true);
  assert.equal((highlighted.match(/<mark /g) || []).length, 3);
  assert.match(highlighted, />Trivikram Bhatta<\/mark>/);
  assert.match(highlighted, />Nal Champu<\/mark>/);
  assert.doesNotMatch(render(false), /<mark /);
  assert.match(render(false), /<table /);
});

test("ordinary numbered statements retain their list layout rather than becoming a matching table", () => {
  const html = renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
    question: {
      id: 1, year: "2025", subject: "History", exam: "Prelims",
      question: "Consider the following statements:\n1. The first statement.\n2. The second statement.\nWhich of the above statements is correct?",
      options: [], answer: "", explanation: "",
    },
    highlights: [], sharedConcepts: [], isExpanded: false, highlightsEnabled: false,
    onAttemptOption: () => {}, onToggleAnswer: () => {},
  }));
  assert.match(html, /<ol /);
  assert.equal((html.match(/<li /g) || []).length, 2);
  assert.doesNotMatch(html, /<table /);
});

test("reference answer expansion gates option highlights and the global toggle gates every text field", () => {
  const question = {
    id: 418, year: "2026", subject: "Polity", exam: "Prelims",
    question: "Members were chosen by indirect election.",
    options: ["Provincial Legislative Assemblies", "Direct election"],
    answer: "Provincial Legislative Assemblies",
    explanation: "They used proportional representation.",
  };
  const highlights: HighlightEvidence[] = [
    { concept_id: "elections", field: "question", exact_text: "indirect election" },
    { concept_id: "elections", field: "option", option_index: 0, exact_text: "Provincial Legislative Assemblies" },
    { concept_id: "elections", field: "explanation", exact_text: "proportional representation" },
  ];
  const render = (isExpanded: boolean, highlightsEnabled: boolean, attemptedOption?: string) => renderToStaticMarkup(
    React.createElement(SimilarityQuestionSummary, {
      question, highlights, sharedConcepts: [], isExpanded, highlightsEnabled, attemptedOption,
      onAttemptOption: () => {}, onToggleAnswer: () => {},
    }),
  );
  const collapsed = render(false, true);
  assert.equal((collapsed.match(/<mark /g) || []).length, 1);
  assert.doesNotMatch(collapsed, /Correct answer|They used proportional representation/);
  assert.match(collapsed, /aria-expanded="false"/);
  assert.equal((collapsed.match(/aria-pressed="false"/g) || []).length, question.options.length);
  assert.doesNotMatch(collapsed, /disabled=""/);

  const expanded = render(true, true);
  assert.equal((expanded.match(/<mark /g) || []).length, 3);
  assert.match(expanded, /aria-label="Correct answer"/);
  assert.match(expanded, /aria-expanded="true"/);
  assert.match(expanded, />proportional representation<\/mark>/);

  const disabled = render(true, false);
  assert.doesNotMatch(disabled, /<mark /);
  assert.match(disabled, /aria-label="Correct answer"/);
  assert.match(disabled, /They used proportional representation/);
  assert.doesNotMatch(render(false, false), /<mark |Correct answer/);

  const incorrectAttempt = render(true, true, "Direct election");
  assert.match(incorrectAttempt, /aria-pressed="true"/);
  assert.match(incorrectAttempt, /aria-label="Incorrect answer"/);
  assert.match(incorrectAttempt, /aria-label="Correct answer"/);
  assert.equal((incorrectAttempt.match(/disabled=""/g) || []).length, question.options.length);
});

test("expanded mains reference cards show their model answer and obey the highlight toggle", () => {
  const render = (highlightsEnabled: boolean) => renderToStaticMarkup(
    React.createElement(SimilarityQuestionSummary, {
      question: {
        id: "mains-1", year: "2026", subject: "Polity", exam: "Mains",
        question: "Discuss elections.", modelAnswer: "Explain proportional representation.",
      },
      highlights: [{ concept_id: "elections", field: "explanation", exact_text: "proportional representation" }],
      sharedConcepts: [], isExpanded: true, highlightsEnabled,
      onAttemptOption: () => {}, onToggleAnswer: () => {},
    }),
  );
  assert.match(render(true), />proportional representation<\/mark>/);
  assert.match(render(false), /Explain proportional representation/);
  assert.doesNotMatch(render(false), /<mark /);
});

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

test("source-quality notices survive loading and render on the reference question without hiding its answer", async () => {
  const payload = response();
  if (payload.status !== "ready") throw new Error("Expected a ready fixture.");
  const warnings = [{ code: "CLASS_SIZE_NONINTEGER_REVIEW_FLAG", reason: "Original count is inconsistent; the intended ratio remains 5:7." }];
  payload.sourceWarnings = warnings;
  payload.matches[0].question.reviewWarnings = warnings;
  const result = await createSimilarityLoader(async () => Response.json(payload))(source);
  if (result.status !== "ready") throw new Error("Expected ready similarity.");
  assert.deepEqual(result.sourceWarnings, warnings);
  const content = result.matches.find(match => match.questionId === "1").question;
  const question = toDisplayQuestion(content);
  assert.deepEqual(question.reviewWarnings, warnings);
  const html = renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
    question, sharedConcepts: [], highlightsEnabled: false, isExpanded: true,
    onAttemptOption: () => {}, onToggleAnswer: () => {},
  }));
  assert.match(html, /aria-label="Source-quality warnings"/);
  assert.match(html, /Known source issue/);
  assert.match(html, /Original count is inconsistent/);
  assert.match(html, /Current explanation/);
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

test("subtopics survive API parsing and display conversion for objective and descriptive questions", async () => {
  const payload = response();
  if (payload.status !== "ready") throw new Error("Expected a ready fixture.");
  payload.sourceSubtopics = ["Reference subtopic"];
  payload.matches[0].question.subtopics = ["Land borders", "Neighbouring countries"];
  const result = await createSimilarityLoader(async () => Response.json(payload))(source);
  if (result.status !== "ready") throw new Error("Expected ready similarity results.");
  assert.deepEqual(result.sourceSubtopics, ["Reference subtopic"]);
  const question = result.matches.find(match => match.questionId === "1").question;
  assert.deepEqual(toDisplayQuestion(question).subtopics, ["Land borders", "Neighbouring countries"]);
  assert.deepEqual(toDisplayQuestion({
    kind: "descriptive", id: "mains-1", questionId: "mains-1", sourceContainer: "mains-questions",
    question: "Discuss borders.", exam: "UPSC", year: "2026", subject: "Geography", topic: "Borders",
    subtopics: ["Land borders"], paper: "GS I", modelAnswer: "Model answer.",
  }).subtopics, ["Land borders"]);
});

test("refreshed question feeds update existing card subtopics without reordering or duplicating cards", () => {
  const question: Question = {
    id: 12021730, year: "2026", exam: "CDS (2) 2026", subject: "Science", topic: "Physics",
    question: "Why remove metallic objects for X-ray imaging?", options: [], answer: "", explanation: "",
  };
  const refreshed = { ...question, subtopics: ["Optics"] };
  const previous = [question, { ...question, id: 2 }];
  const merged = mergeQuestionsById(previous, [{ ...question, id: 3 }, refreshed, refreshed]);
  assert.deepEqual(merged.map(item => item.id), [12021730, 2, 3]);
  assert.deepEqual(merged[0].subtopics, ["Optics"]);
  assert.equal("subtopics" in previous[0], false);
  const html = renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
    question: merged[0], highlights: [], sharedConcepts: [], isExpanded: false, highlightsEnabled: false,
    onAttemptOption: () => {}, onToggleAnswer: () => {},
  }));
  assert.doesNotMatch(html, /Show subtopics:/);
});

test("question cards show available subtopics once and omit missing or empty subtopics", () => {
  const render = (subtopics?: string[]) => renderToStaticMarkup(React.createElement(SimilarityQuestionSummary, {
    question: {
      id: 1, year: "2026", exam: "Prelims", subject: "Geography", topic: "Borders",
      question: "Identify a land border.", options: [], answer: "", explanation: "", subtopics,
    },
    highlights: [], sharedConcepts: [], isExpanded: false, highlightsEnabled: false,
    onAttemptOption: () => {}, onToggleAnswer: () => {},
  }));
  const html = render([" Land borders ", "Neighbouring countries", "Land borders", "  "]);
  assert.doesNotMatch(html, /Show subtopics:/);
  for (const subtopics of [undefined, [], ["  "]]) {
    assert.doesNotMatch(render(subtopics), /Show subtopics:/);
  }
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

test("overlapping display excerpts form one complete highlight without losing trailing words", () => {
  const html = highlightSimilarityTerms(
    "water maximum density near four Celsius", new Set(), "blue",
    ["water maximum density", "density near four Celsius", "water maximum density", "maximum density"],
  );
  assert.equal((html.match(/<mark /g) ?? []).length, 1);
  assert.match(html, />water maximum density near four Celsius<\/mark>$/);
  const repeated = highlightSimilarityTerms("a a a", new Set(), "blue", ["a a"]);
  assert.match(repeated, />a a a<\/mark>$/);
});

test("literal entity excerpts and mathematical symbols remain intact without highlighting entity internals", () => {
  const source = '<span title="NASA > ISRO &amp; partners">NASA &amp; ISRO</span>: &pi;r&#178;, 4°C and x < 5.';
  const html = highlightSimilarityTerms(source, new Set(["amp"]), "blue", [
    "NASA &amp; ISRO", "&pi;r&#178;", "4°C", "x < 5", "amp",
  ]);
  assert.match(html, /^<span title="NASA > ISRO &amp; partners"><mark[^>]*>NASA &amp; ISRO<\/mark><\/span>/);
  assert.match(html, />&pi;r&#178;<\/mark>/);
  assert.match(html, />4°C<\/mark>/);
  assert.match(html, />x < 5<\/mark>/);
  assert.equal((html.match(/<mark /g) ?? []).length, 4);
  assert.equal(html.replace(/<\/?mark\b[^>]*>/g, ""), source);
  assert.match(highlightSimilarityTerms("fiscal&#160;policy", new Set(), "blue", ["fiscal policy"]), />fiscal&#160;policy<\/mark>/);
});

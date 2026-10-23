import assert from "node:assert/strict";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import express from "express";
import { build } from "esbuild";
import type { Database } from "@azure/cosmos";
import { createQuestionReviewRouter } from "./question-review";
import { sourceContainers } from "./similarity/config";
import { sourceQuestionSchema } from "./similarity/schema";
import { hashContent } from "./similarity/content-hash";

const issue = { check: "answer", code: "SOURCE_ANSWER_EXPLANATION_CONFLICT",
  reason: "The stored answer and explanation disagree.", requiredAction: "Compare with the original source." };
const verification = { checks: { answer: { status: "pending_review" }, explanation: { status: "not_checked" } }, issues: [issue] };
const original = { id: "42", question: "Which option is correct?", options: ["A", "B"], answer: "A",
  explanation: "The explanation supports B.", exam: "UPSC CSE", year: "2026", verification, _etag: "source-1" };

async function fixture() {
  const records = new Map<string, Map<string, any>>([
    ...sourceContainers.map(container => [container, new Map()] as const),
    ["question_concept_profiles", new Map()], ["question-review-drafts", new Map()],
  ]);
  records.get("questions")!.set("42", structuredClone(original));
  const writes: string[] = [];
  let serial = 0;
  const notFound = () => Object.assign(new Error("Missing"), { code: 404 });
  const database = {
    containers: { createIfNotExists: async () => ({}) },
    container: (name: string) => ({
      items: {
        query: (input: string | { parameters: { name: string; value: string[] }[] }) => ({
          fetchAll: async () => {
            if (!records.has(name)) throw notFound();
            return { resources: [...records.get(name)!.values()].filter(record =>
              (name === "question-review-drafts" && !!record.reviewedAt) ||
              record.verification?.checks?.answer?.status === "pending_review" ||
              record.verification?.checks?.explanation?.status === "pending_review" ||
              (typeof input !== "string" && input.parameters[0].value.includes(record.id))).map(record => structuredClone(record)) };
          },
        }),
        create: async (document: any) => {
          assert.equal(name, "question-review-drafts", "Live question/profile writes are forbidden.");
          if (records.get(name)!.has(document.id)) throw Object.assign(new Error("Conflict"), { code: 409 });
          writes.push(name);
          records.get(name)!.set(document.id, { ...structuredClone(document), _etag: `draft-${++serial}` });
        },
      },
      item: (id: string) => ({
        read: async () => {
          const record = records.get(name)!.get(id);
          if (!record) throw notFound();
          return { resource: structuredClone(record) };
        },
        replace: async (document: any, options: any) => {
          assert.equal(name, "question-review-drafts", "Live question/profile writes are forbidden.");
          if (records.get(name)!.get(id)?._etag !== options.accessCondition.condition) {
            throw Object.assign(new Error("Conflict"), { code: 412 });
          }
          writes.push(name);
          records.get(name)!.set(id, { ...structuredClone(document), _etag: `draft-${++serial}` });
        },
      }),
    }),
  };
  const app = express();
  app.use(express.json());
  app.use("/api/admin/question-review", (req, res, next) => {
    if (req.headers.authorization !== "Bearer offline-admin-key") return res.sendStatus(401);
    next();
  }, createQuestionReviewRouter(database as unknown as Database));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/admin/question-review`;
  const get = (suffix = "/questions/42", authorized = true) => fetch(`${base}${suffix}`, {
    headers: authorized ? { Authorization: "Bearer offline-admin-key" } : {},
  });
  const save = (changes: Record<string, unknown> = {}) => fetch(`${base}/questions/42`, {
    method: "PUT", headers: { Authorization: "Bearer offline-admin-key", "Content-Type": "application/json" },
    body: JSON.stringify({ sourceContentHash: hashContent(sourceQuestionSchema.parse(original)), expectedRevision: 0,
      answer: "B", explanation: "Corrected explanation.", comment: "Supporting reference and reasoning.", ...changes }),
  });
  return { app, base, records, writes, get, save, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test("online correction drafts persist revisions and never alter the live answer, explanation or flags", async () => {
  const context = await fixture();
  try {
    assert.equal((await context.get("", false)).status, 401);
    assert.equal((await context.get("/questions/42", false)).status, 401);
    const before = await (await context.get()).json();
    assert.equal(before.draft, null);
    assert.deepEqual(before.issues, [issue]);
    assert.deepEqual(before.original.options, ["A", "B"]);
    assert.equal((await (await context.get("")).json()).reviews[0].uiReview.status, "not_reviewed");
    assert.equal((await context.save()).status, 200);
    const first = await (await context.get()).json();
    assert.equal(first.draft.revision, 1);
    assert.equal(first.draft.explanation, "Corrected explanation.");
    assert.equal(first.staleDraft, false);
    assert.equal(first.draft.reviewedAt, first.draft.savedAt);
    assert.deepEqual((await (await context.get("")).json()).reviews[0].uiReview,
      { status: "reviewed", reviewedAt: first.draft.reviewedAt, revision: 1 });
    assert.equal((await context.save({ expectedRevision: 1, explanation: "Second corrected explanation." })).status, 200);
    const loaded = await (await context.get()).json();
    assert.equal(loaded.draft.revision, 2);
    assert.deepEqual(loaded.draft.history.map((version: any) => version.explanation),
      ["Corrected explanation.", "Second corrected explanation."]);
    assert.deepEqual(context.records.get("questions")!.get("42"), original);
    assert.deepEqual(context.writes, ["question-review-drafts", "question-review-drafts"]);
  } finally { await context.close(); }
});

test("stale sources, stale revisions, missing reasons and unauthorized fields cannot overwrite drafts", async () => {
  const context = await fixture();
  try {
    assert.equal((await context.save({ explanation: " " })).status, 400);
    assert.equal((await context.save({ comment: "" })).status, 400);
    assert.equal((await context.save({ email: "spoofed-admin@example.com" })).status, 400);
    assert.equal((await context.save({ sourceContentHash: "a".repeat(64) })).status, 409);
    const concurrent = await Promise.all([context.save(), context.save()]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
    assert.equal((await context.save()).status, 409);
    context.records.get("questions")!.get("42").explanation = "Changed original source.";
    assert.equal((await (await context.get()).json()).staleDraft, true);
    assert.equal((await (await context.get("")).json()).reviews[0].uiReview.status, "not_reviewed");
    assert.equal((await context.save({ expectedRevision: 1 })).status, 409);
    assert.equal(context.writes.length, 1);
  } finally { await context.close(); }
});

test("legacy drafts and a missing draft container do not imply completed UI review", async () => {
  const context = await fixture();
  try {
    assert.equal((await context.save()).status, 200);
    delete context.records.get("question-review-drafts")!.get("questions:42").reviewedAt;
    assert.equal((await (await context.get("")).json()).reviews[0].uiReview.status, "not_reviewed");
    context.records.delete("question-review-drafts");
    const listing = await context.get("");
    assert.equal(listing.status, 200);
    assert.equal((await listing.json()).reviews[0].uiReview.status, "not_reviewed");
  } finally { await context.close(); }
});

test("review lists include source-bound profile holds across banks but exclude concept-only and stale holds", async () => {
  const context = await fixture();
  try {
    const csat = { ...original, id: "43", verification: undefined };
    context.records.get("csat-questions")!.set("43", csat);
    const explanationIssue = { ...issue, check: "explanation", code: "EXPLANATION_REVIEW_REQUIRED" };
    context.records.get("question_concept_profiles")!.set("csat-questions:43", {
      sourceContainer: "csat-questions", questionId: "43",
      processing: { sourceContentHash: hashContent(sourceQuestionSchema.parse(csat)) },
      verification: { checks: { explanation: { status: "pending_review" } }, issues: [explanationIssue] },
    });
    context.records.get("questions")!.set("44", { ...original, id: "44", verification: {
      checks: { concepts: { status: "pending_review" } }, issues: [{ ...issue, check: "concepts" }],
    } });
    context.records.get("questions")!.set("45", { ...original, id: "45", verification: undefined });
    context.records.get("question_concept_profiles")!.set("questions:45", {
      sourceContainer: "questions", questionId: "45", processing: { sourceContentHash: "old-source" },
      verification,
    });
    context.records.delete("state_pcs");
    const listing = await context.get("");
    assert.equal(listing.headers.get("cache-control"), "no-store");
    assert.deepEqual((await listing.json()).reviews.map((review: any) => `${review.sourceContainer}:${review.questionId}`).sort(),
      ["csat-questions:43", "questions:42"]);
    const queue = await (await context.get("")).json();
    assert.deepEqual(queue.reviews.find((review: any) => review.questionId === "42").question, sourceQuestionSchema.parse(original));
    context.records.get("questions")!.get("42").verification = context.records.get("questions")!.get("44").verification;
    assert.equal((await context.save()).status, 409);
    assert.equal(context.writes.length, 0);
  } finally { await context.close(); }
});

test("the production API mounts correction routes behind the real admin-key guard", async () => {
  const previous = { ADMIN_API_KEY: process.env.ADMIN_API_KEY, COSMOS_ENDPOINT: process.env.COSMOS_ENDPOINT,
    COSMOS_KEY: process.env.COSMOS_KEY };
  process.env.ADMIN_API_KEY = "offline-admin-key";
  process.env.COSMOS_ENDPOINT = "https://127.0.0.1:1/";
  process.env.COSMOS_KEY = Buffer.from("offline-test-only").toString("base64");
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    const { default: app } = await import("../api/index.js");
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api/admin/question-review`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/questions/42`, { method: "PUT" })).status, 401);
    assert.equal((await fetch(`${base}/invalid-bank/42`, {
      headers: { Authorization: "Bearer offline-admin-key" },
    })).status, 400);
    assert.equal((await fetch(`${base}/questions/42`, {
      method: "PUT", headers: { Authorization: "Bearer offline-admin-key", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com" }),
    })).status, 400);
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
test("browser searches the complete cross-bank queue and saves drafts without altering live content",
  { skip: !existsSync(chrome), timeout: 60000 }, async () => {
    const context = await fixture();
    const directory = await mkdtemp(join(tmpdir(), "pyq-correction-browser-"));
    try {
      for (let id = 100; id <= 150; id++) context.records.get("questions")!.set(String(id), {
        ...structuredClone(original), id: String(id), question: `Additional flagged question ${id}.`,
      });
      context.records.get("state_pcs")!.set("42", { ...structuredClone(original),
        question: "Which river needs explanation review?", verification: {
          checks: { explanation: { status: "pending_review" } },
          issues: [{ ...issue, check: "explanation", reason: "River explanation needs a source." }],
        } });
      const stateOriginal = structuredClone(context.records.get("state_pcs")!.get("42"));
      context.records.get("english-questions")!.set("legacy", { ...structuredClone(original), id: "legacy",
        question: "A legacy question with a non-option answer.", options: ["First option", "Second option"], answer: "Dropped by examiner" });
      context.records.get("mains-questions")!.set("written", { ...structuredClone(original), id: "written",
        question: "An open-ended question.", options: [], answer: "Existing written answer." });
      const bundle = await build({
        stdin: { loader: "tsx", resolveDir: fileURLToPath(new URL("..", import.meta.url)), contents: `
          import React from "react";
          import { createRoot } from "react-dom/client";
          import { QuestionReviewPanel } from "./src/features/QuestionReviewPanel";
          import { QuestionReviewQueue } from "./src/features/QuestionReviewQueue";
          import { reviewStateForDraft } from "./src/features/question-review";
          const root = createRoot(document.getElementById("root"));
          const render = (key, sourceContainer = "questions", questionId = "42") => root.render(<QuestionReviewPanel key={key} sourceContainer={sourceContainer} questionId={questionId}
            access={{ key: "offline-admin-key", issues: ${JSON.stringify([issue])} }} />);
          function QueueHarness({ initial }) {
            const [reviews, setReviews] = React.useState(initial);
            React.useEffect(() => setReviews(initial), [initial]);
            return <QuestionReviewQueue reviews={reviews} adminKey="offline-admin-key"
              loading={false} error="" onReload={() => {}} onUnlock={() => {}}
              onSaved={(container, id, draft) => setReviews(current => current.map(review =>
                review.sourceContainer === container && review.questionId === id
                  ? { ...review, uiReview: reviewStateForDraft(draft, review.sourceContentHash) } : review))} />;
          }
          const wait = async check => {
            for (let i = 0; i < 300; i++) {
              if (check()) return;
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            throw new Error("Timed out waiting for browser UI.");
          };
          const button = text => [...document.querySelectorAll("button")].find(node => node.textContent === text);
          const field = suffix => document.querySelector('[id$="-' + suffix + '"]');
          const change = (suffix, value) => {
            const node = field(suffix);
            const prototype = node.tagName === "INPUT" ? HTMLInputElement.prototype :
              node.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
            node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
          };
          const check = (condition, message) => { if (!condition) throw new Error(message); };
          (async () => {
            render("initial");
            await wait(() => button("Review / edit correction draft"));
            button("Review / edit correction draft").click();
            await wait(() => field("explanation"));
            check(field("answer").tagName === "SELECT", "Multiple-choice answers do not use a dropdown.");
            check([...field("answer").options].map(option => option.value).join(",") === ",A,B",
              "Dropdown values do not match the actual source options.");
            const searchLink = document.querySelector('a[href^="https://www.google.com/search?"]');
            check(searchLink && new URL(searchLink.href).searchParams.get("q") ===
              "Which option is correct? UPSC CSE 2026 The stored answer and explanation disagree.",
              "Google search does not combine the question, exam/year and issue reason.");
            check(searchLink.target === "_blank" && searchLink.rel.includes("noopener") &&
              searchLink.rel.includes("noreferrer") && searchLink.referrerPolicy === "no-referrer",
              "Google search link does not isolate the new tab.");
            change("answer", "B");
            change("explanation", "Browser correction.");
            change("comment", "Browser supporting reference.");
            await wait(() => !button("Save draft online").disabled);
            button("Save draft online").click();
            await wait(() => document.querySelector('[role="status"]')?.textContent.includes("revision 1 saved"));
            check(document.querySelector('[aria-label="Reviewed in this UI"]'), "Successful save did not mark UI reviewed.");
            render("reload");
            await wait(() => button("Review / edit correction draft"));
            button("Review / edit correction draft").click();
            await wait(() => field("explanation")?.value === "Browser correction.");
            check(field("answer").value === "B", "Saved answer was not restored.");
            check(document.querySelector('[aria-label="Reviewed in this UI"]'), "Reviewed status did not survive reload.");
            const current = await fetch("/api/admin/question-review/questions/42", {
              headers: { Authorization: "Bearer offline-admin-key" }
            }).then(response => response.json());
            const other = await fetch("/api/admin/question-review/questions/42", {
              method: "PUT", headers: { Authorization: "Bearer offline-admin-key", "Content-Type": "application/json" },
              body: JSON.stringify({ sourceContentHash: current.sourceContentHash, expectedRevision: 1,
                answer: "B", explanation: "Newer administrator draft.", comment: "Another administrator reviewed the source." })
            });
            check(other.ok, "Concurrent draft could not be saved.");
            change("explanation", "My unsaved correction.");
            await wait(() => field("explanation").value === "My unsaved correction.");
            button("Save draft online").click();
            await wait(() => document.querySelector('[role="alert"]')?.textContent.includes("newer draft"));
            check(field("explanation").value === "My unsaved correction.", "Conflict discarded unsaved edits.");
            check(!document.querySelector('[role="status"]'), "A failed save falsely reported success.");
            button("Reload saved draft").click();
            await wait(() => field("explanation")?.value === "Newer administrator draft.");
            check(document.body.textContent.includes("UI review completed"), "Saved review did not update the UI heading.");
            const listing = await fetch("/api/admin/question-review", {
              headers: { Authorization: "Bearer offline-admin-key" }
            }).then(response => response.json());
            root.render(<QueueHarness key="queue" initial={listing.reviews} />);
            await wait(() => document.querySelectorAll("article").length === 50);
            check(document.body.textContent.includes("55 matching flagged questions of 55"), "Incomplete cross-bank queue count.");
            change("search", "river");
            await wait(() => document.querySelectorAll("article").length === 1);
            check(document.querySelector("article").textContent.includes("state_pcs"),
              "Search did not find a different bank beyond the first 50 results.");
            const selectCheck = value => {
              field("check").value = value;
              field("check").dispatchEvent(new Event("change", { bubbles: true }));
            };
            selectCheck("answer");
            await wait(() => document.querySelectorAll("article").length === 0);
            change("search", "42");
            await wait(() => document.querySelectorAll("article").length === 2);
            check(document.querySelector("article").textContent.includes("Which option is correct"),
              "Answer-only filtering returned the wrong question.");
            selectCheck("either");
            await wait(() => document.querySelectorAll("article").length === 3);
            change("progress", "reviewed");
            await wait(() => document.querySelectorAll("article").length === 1);
            check(document.querySelector("article").textContent.includes("questions"), "Reviewed filter lost the saved draft.");
            change("progress", "not_reviewed");
            await wait(() => document.querySelectorAll("article").length === 2);
            change("search", "river");
            await wait(() => document.querySelectorAll("article").length === 1);
            check(!document.querySelector('[aria-label="Reviewed in this UI"]'), "A same-ID question in another bank was marked reviewed.");
            button("Review / edit correction draft").click();
            await wait(() => field("explanation"));
            change("answer", "B");
            change("explanation", "Reviewed river explanation.");
            change("comment", "Source for the river correction.");
            await wait(() => !button("Save draft online").disabled);
            button("Save draft online").click();
            await wait(() => document.querySelectorAll("article").length === 0);
            change("progress", "reviewed");
            await wait(() => document.querySelectorAll("article").length === 1);
            check(document.querySelector('[aria-label="Reviewed in this UI"]'), "Queue did not immediately show saved review status.");
            const restored = await fetch("/api/admin/question-review", {
              headers: { Authorization: "Bearer offline-admin-key" }
            }).then(response => response.json());
            check(restored.reviews.find(review => review.sourceContainer === "state_pcs" && review.questionId === "42")
              .uiReview.status === "reviewed", "Queue review status was not persisted.");
            button("Review / edit correction draft").click();
            await wait(() => field("explanation")?.value === "Reviewed river explanation.");
            change("progress", "all");
            const changedSource = restored.reviews.map(review => review.sourceContainer === "state_pcs"
              ? { ...review, sourceContentHash: "changed-source-version",
                  question: { ...review.question, question: "Updated river source question." }, uiReview: { status: "not_reviewed" } }
              : review);
            root.render(<QueueHarness key="queue" initial={changedSource} />);
            await wait(() => document.querySelector("article")?.textContent.includes("Updated river source question."));
            check(!document.querySelector('[aria-label="Reviewed in this UI"]') && !field("answer"),
              "A source change left stale Reviewed status or an old correction form visible.");
            render("legacy", "english-questions", "legacy");
            await wait(() => !document.querySelector('[aria-label="Flagged questions"]') && button("Review / edit correction draft"));
            button("Review / edit correction draft").click();
            await wait(() => field("answer"));
            check(field("answer").tagName === "SELECT" && field("answer").value === "Dropped by examiner",
              "A legacy non-option answer was silently replaced.");
            render("written", "mains-questions", "written");
            await wait(() => button("Review / edit correction draft"));
            button("Review / edit correction draft").click();
            await wait(() => field("answer"));
            check(field("answer").tagName === "TEXTAREA" && field("answer").value === "Existing written answer.",
              "An open-ended answer was forced into multiple-choice options.");
            document.body.dataset.reviewSmoke = "passed";
          })().catch(error => { document.body.dataset.reviewSmoke = "failed: " + error.message; });
        ` },
        bundle: true, write: false, format: "iife", platform: "browser",
      });
      context.app.get("/review.js", (_req, res) => res.type("js").send(bundle.outputFiles[0].text));
      context.app.get("/", (_req, res) => res.type("html").send('<!doctype html><div id="root"></div><script src="/review.js"></script>'));
      const result = await promisify(execFile)(chrome, ["--headless=new", "--disable-gpu",
        "--no-first-run", "--no-default-browser-check", `--user-data-dir=${directory}`,
        "--virtual-time-budget=15000", "--dump-dom", new URL("/", context.base).href],
      { timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
      assert.match(result.stdout, /data-review-smoke="passed"/, result.stdout);
      assert.deepEqual(context.records.get("questions")!.get("42"), original);
      assert.deepEqual(context.records.get("state_pcs")!.get("42"), stateOriginal);
      assert.equal(context.records.get("question-review-drafts")!.get("questions:42").revision, 2);
    } finally {
      await context.close();
      await rm(directory, { recursive: true, maxRetries: 5, retryDelay: 200 });
    }
  });

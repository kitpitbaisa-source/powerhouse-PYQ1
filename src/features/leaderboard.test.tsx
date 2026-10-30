import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentStreakBadge, LearnerExamBreakdown, LeaderboardPodiums, LeaderboardSkeleton, LeaderboardTable, LeaderboardTabs } from "./Leaderboard";
import { saveAttempt } from "./statistics-client";

const entry = { id: "opaque", alias: "Aakash <K>", avatarUrl: null, rank: 1, isYou: true,
  totalAttempts: 4, correctAttempts: 3, wrongAttempts: 1, accuracy: 75, currentStreak: 1, maxStreak: 2, accuracyQualified: false,
  examBreakdown: [{ exam: "NDA", attempts: 3 }, { exam: "CDS", attempts: 1 }] };

test("loading uses decorative skeleton cards and rows without visible status text or fake results", () => {
  const markup = renderToStaticMarkup(<LeaderboardSkeleton />);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-label="Loading leaderboard"/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.equal(markup.replace(/<[^>]*>/g, "").trim(), "");
});

test("the filter streak icon displays zero, the full current count and an unavailable state", () => {
  for (const count of [0, 7, 125]) {
    const markup = renderToStaticMarkup(<CurrentStreakBadge currentStreak={count} onClick={() => {}} />);
    assert.match(markup, new RegExp(`>${count}</span>`));
    assert.match(markup, new RegExp(`aria-label="Current streak: ${count} consecutive correct answers across all exams`));
  }
  const unavailable = renderToStaticMarkup(<CurrentStreakBadge currentStreak={null} onClick={() => {}} />);
  assert.match(unavailable, />-<\/span>/);
  assert.doesNotMatch(unavailable, />0<\/span>/);
});

test("signed-out learners see their local streak with a refresh-reset explanation", () => {
  for (const count of [0, 7, 125]) {
    const signedOut = renderToStaticMarkup(<CurrentStreakBadge currentStreak={count} signedIn={false} onClick={() => {}} />);
    assert.match(signedOut, new RegExp(`>${count}</span>`));
    assert.match(signedOut, /This visit only; resets on refresh/);
    assert.doesNotMatch(signedOut, /Sign in to see your current streak/);
  }
});

test("leaderboard shows aliases, accuracy and overall streaks but no exam streak columns", () => {
  const overall = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall />);
  assert.match(overall, /Aakash &lt;K&gt;/);
  assert.match(overall, /75\.0%/);
  assert.match(overall, />Wrong</);
  assert.match(overall, /Current streak/);
  assert.match(overall, /Best streak/);
  assert.match(overall, /\(You\)/);
  assert.match(overall, /Exam split/);
  assert.match(overall, /<th[^>]*>Exam split<\/th>/);
  assert.match(overall, /4 total/);
  assert.match(overall, /NDA/);
  assert.match(overall, /CDS/);
  const exam = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall={false} />);
  assert.doesNotMatch(exam, /Current streak|Best streak/);
});

test("exam breakdown shows every exam and count directly without a disclosure and escapes exam labels", () => {
  const markup = renderToStaticMarkup(<LearnerExamBreakdown breakdown={[{ exam: "NDA <test>", attempts: 120 }, { exam: "CDS", attempts: 30 }]} />);
  assert.doesNotMatch(markup, /<details|<summary|<button/);
  assert.match(markup, /150 total/);
  assert.match(markup, /All exams \/ Lifetime attempts/);
  assert.match(markup, /NDA &lt;test&gt;/);
  assert.match(markup, />120<\/strong>/);
  assert.match(markup, />30<\/strong>/);
  assert.equal(renderToStaticMarkup(<LearnerExamBreakdown breakdown={[]} />), "");
});

test("one continuous correct/wrong bar spans the statistics columns and handles no attempts", () => {
  const overall = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall />);
  assert.match(overall, /colSpan="6"/);
  assert.match(overall, /aria-label="4 attempts: 3 correct, 1 wrong"/);
  assert.match(overall, /style="width:75%"/);
  assert.match(overall, /style="width:25%"/);
  assert.equal((overall.match(/role="img"/g) || []).length, 1);
  const exam = renderToStaticMarkup(<LeaderboardTable entries={[{ ...entry, totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0 }]} overall={false} />);
  assert.match(exam, /colSpan="4"/);
  assert.match(exam, /aria-label="0 attempts: 0 correct, 0 wrong"/);
  assert.equal((exam.match(/style="width:0%"/g) || []).length, 2);
  assert.doesNotMatch(exam, /NaN|Infinity/);
});

test("network retries reuse one submission ID, while another answer receives a fresh ID", async () => {
  const bodies: string[] = [];
  const fetcher = (async (_url, init) => {
    bodies.push(init!.body as string);
    return new Response("{}", { status: bodies.length === 1 ? 503 : 200 });
  }) as typeof fetch;
  await saveAttempt({ questionId: 1 }, fetcher, async () => {});
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await saveAttempt({ questionId: 1 }, fetcher, async () => {});
  assert.notEqual(JSON.parse(bodies[0]).submissionId, JSON.parse(bodies[2]).submissionId);
});

test("the full ranking identifies the active descending metric for each category", () => {
  for (const metric of ["attempts", "accuracy", "maxStreak"] as const) {
    const markup = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall metric={metric} />);
    assert.equal((markup.match(/aria-sort="descending"/g) || []).length, 1);
    const sortedHeader = markup.match(/<th[^>]*aria-sort="descending"[^>]*>[\s\S]*?<\/th>/)?.[0];
    assert.match(sortedHeader!, new RegExp(metric === "attempts" ? "Attempts" : metric === "accuracy" ? "Accuracy" : "Best streak"));
    const color = metric === "attempts" ? "indigo" : metric === "accuracy" ? "emerald" : "orange";
    assert.match(sortedHeader!, new RegExp(`bg-${color}-100/70`));
    assert.equal((markup.match(new RegExp(`<(?:th|td)[^>]*bg-${color}-100/70`, "g")) || []).length, 2);
  }
});

test("ranking tabs expose exactly one selected category", () => {
  for (const value of ["attempts", "accuracy", "maxStreak"] as const) {
    const markup = renderToStaticMarkup(<LeaderboardTabs value={value} onChange={() => {}} />);
    assert.equal((markup.match(/aria-pressed="true"/g) || []).length, 1);
    assert.equal((markup.match(/aria-pressed="false"/g) || []).length, 2);
    assert.match(markup, /Attempts/);
    assert.match(markup, /Accuracy/);
    assert.match(markup, /Streak/);
    const selectedButton = markup.match(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.match(selectedButton!, new RegExp(value === "attempts" ? "Attempts" : value === "accuracy" ? "Accuracy" : "Streak"));
  }
});

test("each ranking category shows only its own podium and keeps streaks overall", () => {
  const highlights = {
    attempts: [{ ...entry, alias: "Attempts winner", totalAttempts: 345, avatarUrl: "/avatar.png" }],
    accuracy: [{ ...entry, alias: "Accuracy winner", accuracy: 98.5, totalAttempts: 200, accuracyQualified: true }],
    maxStreak: [{ ...entry, alias: "Streak winner", maxStreak: 42, currentStreak: 1 }],
  };
  const attempts = renderToStaticMarkup(<LeaderboardPodiums highlights={highlights} exam="NDA" metric="attempts" />);
  assert.match(attempts, /Most attempts/);
  assert.match(attempts, /Attempts winner/);
  assert.match(attempts, /345/);
  assert.match(attempts, /src="\/avatar\.png"/);
  assert.match(attempts, /You/);
  assert.doesNotMatch(attempts, /Accuracy winner|Streak winner/);
  const accuracy = renderToStaticMarkup(<LeaderboardPodiums highlights={highlights} exam="NDA" metric="accuracy" />);
  assert.match(accuracy, /Highest accuracy/);
  assert.match(accuracy, /Accuracy winner/);
  assert.match(accuracy, /98\.5%/);
  assert.match(accuracy, /100\+ attempts/);
  assert.doesNotMatch(accuracy, /Attempts winner|Streak winner/);
  const streak = renderToStaticMarkup(<LeaderboardPodiums highlights={highlights} exam="NDA" metric="maxStreak" />);
  assert.match(streak, /Best-ever streak/);
  assert.match(streak, /Streak winner/);
  assert.match(streak, />42</);
  assert.match(streak, /Overall \/ Across all exams/);
  assert.match(streak, /Overall \/ Across all exams<\/p><p[^>]*>Streak: number of consecutive correct answers\.<\/p>/);
  assert.doesNotMatch(streak, /Attempts winner|Accuracy winner/);
});

test("podiums handle empty rankings and fewer than three learners", () => {
  const empty = renderToStaticMarkup(<LeaderboardPodiums highlights={{ attempts: [], accuracy: [], maxStreak: [] }} exam="all" metric="attempts" />);
  assert.equal((empty.match(/No attempts recorded yet\./g) || []).length, 1);
  const partial = renderToStaticMarkup(<LeaderboardPodiums highlights={{ attempts: [entry, { ...entry, id: "second", rank: 2 }], accuracy: [], maxStreak: [] }} exam="all" metric="attempts" />);
  assert.equal((partial.match(/<li /g) || []).length, 2);
  assert.match(partial, /Aakash &lt;K&gt;/);
  const noQualified = renderToStaticMarkup(<LeaderboardPodiums highlights={{ attempts: [], accuracy: [], maxStreak: [] }} exam="all" metric="accuracy" />);
  assert.match(noQualified, /No learners have reached 100 attempts yet/);
});

test("accuracy rows identify learners below 100 attempts without flagging other rankings", () => {
  const accuracy = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall metric="accuracy" />);
  assert.match(accuracy, /Under 100 attempts/);
  const qualified = renderToStaticMarkup(<LeaderboardTable entries={[{ ...entry, totalAttempts: 100, accuracyQualified: true }]} overall metric="accuracy" />);
  assert.doesNotMatch(qualified, /Under 100 attempts/);
  const attempts = renderToStaticMarkup(<LeaderboardTable entries={[entry]} overall metric="attempts" />);
  assert.doesNotMatch(attempts, /Under 100 attempts/);
});

test("a saved answer awaiting statistics is not resubmitted and invalid requests are not retried", async () => {
  let calls = 0;
  await saveAttempt({}, (async () => { calls++; return new Response("{}", { status: 202 }); }) as typeof fetch);
  assert.equal(calls, 1);
  await assert.rejects(() => saveAttempt({}, (async () => { calls++; return new Response("{}", { status: 400 }); }) as typeof fetch), /rejected/);
  assert.equal(calls, 2);
});

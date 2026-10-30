import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import type { Database } from "@azure/cosmos";
import { addResult, applyEvents, emptyStatistics, eventId, type StatisticsEvent } from "./model";
import { StatisticsService, type AttemptInput } from "./service";
import { createLeaderboardRouter, getLeaderboardHighlights, rankLeaderboard } from "./router";
import { ALIAS_ADJECTIVES, ALIAS_NOUNS, getOrCreateAlias } from "./alias-names";
import { ensureLearnerProfile, ensureLoginProfile } from "./login-profile";

test("alias generation preserves an existing alias without renaming its owner", () => {
  assert.equal(getOrCreateAlias("  Existing Alias  ", ["existing alias"]), "  Existing Alias  ");
});

test("missing and blank aliases receive distinct suggested names from the word pool", () => {
  const taken = new Set<string>();
  const names = new Set(ALIAS_ADJECTIVES.flatMap(adjective => ALIAS_NOUNS.map(noun => `${adjective} ${noun}`)));
  for (const current of [undefined, null, "", "   "]) {
    const alias = getOrCreateAlias(current, taken);
    assert.ok(names.has(alias.replace(/ \d+$/, "")));
    assert.ok(!taken.has(alias.toLowerCase()));
    taken.add(alias.toLowerCase());
  }
});

test("alias collisions ignore case and surrounding spaces and skip occupied numbered variants", () => {
  const names = ALIAS_ADJECTIVES.flatMap(adjective => ALIAS_NOUNS.map(noun => `${adjective} ${noun}`));
  const taken = names.flatMap(name => [`  ${name.toUpperCase()}  `, ` ${name.toUpperCase()} 2 `]);
  const alias = getOrCreateAlias(undefined, taken);
  assert.match(alias, / 3$/);
  assert.ok(names.includes(alias.replace(/ 3$/, "")));
  assert.ok(!new Set(taken.map(name => name.trim().toLowerCase())).has(alias.toLowerCase()));
});

class MemoryContainer {
  records = new Map<string, any>();
  version = 0;
  failWrites = false;
  loseBatchResponse = false;
  key(id: string, user: string) { return `${user}|${id}`; }
  save(doc: any) {
    const stored = { ...structuredClone(doc), _etag: String(++this.version) };
    this.records.set(this.key(doc.id, doc.userId || doc.id), stored);
    return { resource: structuredClone(stored) };
  }
  item(id: string, user: string) {
    const key = this.key(id, user);
    return {
      read: async () => {
        const resource = this.records.get(key);
        if (!resource) throw { code: 404 };
        return { resource: structuredClone(resource) };
      },
      delete: async (options: any) => {
        if (this.records.get(key)?._etag !== options.accessCondition.condition) throw { code: 412 };
        this.records.delete(key);
        return {};
      },
      replace: async (doc: any, options: any) => {
        if (this.failWrites) throw Object.assign(new Error("Unavailable"), { code: 503 });
        if (this.records.get(key)?._etag !== options.accessCondition.condition) throw { code: 412 };
        return this.save(doc);
      },
      patch: async (operations: any[], options: any) => {
        if (this.failWrites) throw { code: 503 };
        const current = this.records.get(key);
        if (current?._etag !== options.accessCondition.condition) throw { code: 412 };
        const doc = structuredClone(current);
        for (const operation of operations) doc[operation.path.slice(1)] = operation.value;
        return this.save(doc);
      },
    };
  }
  items = {
    create: async (doc: any) => {
      if (this.failWrites) throw { code: 503 };
      if (this.records.has(this.key(doc.id, doc.userId || doc.id))) throw { code: 409 };
      return this.save(doc);
    },
    batch: async (operations: any[], user: string) => {
      if (this.failWrites) throw { code: 503 };
      for (const operation of operations) {
        const current = this.records.get(this.key(operation.id || operation.resourceBody.id, user));
        if (operation.operationType === "Create" && current) throw { code: 409 };
        if (operation.operationType === "Replace" && current?._etag !== operation.ifMatch) throw { code: 412 };
      }
      for (const operation of operations) this.save(operation.resourceBody);
      if (this.loseBatchResponse) {
        this.loseBatchResponse = false;
        throw { code: 503 };
      }
      return { code: 200, result: operations.map(() => ({ statusCode: 200 })) };
    },
    query: (input: any, options?: any) => ({
      fetchAll: async () => {
        const query = typeof input === "string" ? input : input.query;
        const parameters = Object.fromEntries((input.parameters || []).map((p: any) => [p.name, p.value]));
        let resources = [...this.records.values()].filter(doc => !options?.partitionKey || doc.userId === options.partitionKey);
        if (query.includes("IS_ARRAY")) resources = resources.filter(doc => doc.attempts?.length);
        else if (query.includes("statistics-event")) resources = resources.filter(doc => doc.type === "statistics-event" &&
          doc.sequence > parameters["@after"] && doc.sequence <= parameters["@head"]).sort((a, b) => a.sequence - b.sequence);
        else if (query.includes("statistics-sequence")) resources = resources.filter(doc => doc.type === "statistics-sequence" && doc.pending && doc.state === "active");
        else if (query.includes("user-statistics")) resources = resources.filter(doc => doc.type === "user-statistics");
        if (parameters["@limit"]) resources = resources.slice(0, parameters["@limit"]);
        return { resources: structuredClone(resources) };
      },
    }),
  };
}

function fixture() {
  const containers = new Map<string, MemoryContainer>();
  const container = (name: string) => {
    if (!containers.has(name)) containers.set(name, new MemoryContainer());
    return containers.get(name)!;
  };
  const db = { container, containers: { createIfNotExists: async () => ({}) } } as unknown as Database;
  const service = new StatisticsService(db);
  for (const id of ["1", "2", "3", "4", "5"]) {
    service.primeQuestion("prelims", id, { exam: Number(id) % 2 ? "NDA (2) 2026" : "CDS (1) 2025" });
  }
  let number = 0;
  const attempt = (correct: boolean, questionId = "1", userId = "learner@gmail.com"): AttemptInput => ({
    userId, questionType: "prelims", questionId,
    submissionId: `submission-${String(++number).padStart(16, "0")}`,
    attempt: { attemptId: "session-1", option: correct ? "A" : "B", isCorrect: correct, ts: `2026-10-30T00:00:${String(number).padStart(2, "0")}.000Z`, timeSpentMs: null },
    meta: { subject: "History", topic: "Congress", exam: null, year: null },
  });
  const stats = async (user = "learner@gmail.com") => (await container("user_statistics").item("overall", user).read()).resource;
  return { service, container, attempt, stats };
}

test("first sign-in creates a normalized unsubscribed profile with a word-list alias and no expiry", async () => {
  const f = fixture();
  const profile = await ensureLoginProfile(f.service.database, " New.Learner@GMAIL.COM ");
  assert.equal(profile.id, "new.learner@gmail.com");
  assert.equal(profile.email, profile.id);
  assert.equal(profile.status, "not_subscribed");
  assert.equal(profile.registrationSource, "login");
  assert.equal(profile.isActive, true);
  assert.ok(ALIAS_ADJECTIVES.some(adjective => profile.alias?.startsWith(`${adjective} `)));
  assert.ok(ALIAS_NOUNS.some(noun => profile.alias?.endsWith(` ${noun}`)));
  assert.equal("expiryDate" in profile, false);
  assert.equal(f.container("settings").records.size, 1);
});

test("historical profiles preserve non-Gmail emails without broadening the sign-in policy", async () => {
  const f = fixture();
  for (const email of ["historical@duck.com", "historical@gmail.con"]) {
    await assert.rejects(() => ensureLoginProfile(f.service.database, email), /Gmail/);
    const profile = await ensureLearnerProfile(f.service.database, email);
    assert.equal(profile.email, email);
    assert.equal(profile.id, email);
    assert.equal(profile.status, "not_subscribed");
    assert.ok(profile.alias);
    await assert.rejects(() => ensureLoginProfile(f.service.database, email), /Gmail/);
  }
});

test("sign-in leaves every existing role, alias, avatar and inactive flag unchanged", async () => {
  const f = fixture();
  for (const [index, status] of ["subscribed", "admin", "editor", "not_subscribed"].entries()) {
    const email = `existing${index}@gmail.com`;
    const saved = f.container("users").save({
      id: email, email, status, alias: "Existing Name", avatar: { sha256: "keep" },
      isActive: index !== 3, expiryDate: "2027-01-01", createdAt: "2025-01-01",
    }).resource;
    assert.deepEqual(await ensureLoginProfile(f.service.database, email), saved);
    assert.deepEqual((await f.container("users").item(email, email).read()).resource, saved);
  }
  assert.equal(f.container("settings").records.size, 0);
});

test("first-login aliases avoid the full existing directory, including inactive aliases and case variants", async () => {
  const f = fixture();
  let index = 0;
  for (const adjective of ALIAS_ADJECTIVES) {
    for (const noun of ALIAS_NOUNS) {
      const email = `reserved${index++}@gmail.com`;
      f.container("users").save({ id: email, email, alias: ` ${adjective.toUpperCase()} ${noun.toUpperCase()} `, isActive: false });
    }
  }
  const profile = await ensureLoginProfile(f.service.database, "new@gmail.com");
  assert.match(profile.alias!, / 2$/);
});

test("a concurrent alias reservation conflict retries without reusing the claimed name", async () => {
  const f = fixture();
  const settings = f.container("settings");
  const create = settings.items.create;
  let claimed: string | undefined;
  settings.items.create = async doc => {
    if (!claimed) {
      claimed = doc.alias;
      await create({ ...doc, email: "other@gmail.com" });
      throw { code: 409 };
    }
    return create(doc);
  };
  const profile = await ensureLoginProfile(f.service.database, "new@gmail.com");
  assert.notEqual(profile.alias?.toLowerCase(), claimed?.toLowerCase());
  assert.equal(settings.records.size, 2);
});

test("simultaneous logins keep one profile and clean up losing alias reservations", async () => {
  const f = fixture();
  const profiles = await Promise.all(Array.from({ length: 4 }, () => ensureLoginProfile(f.service.database, "new@gmail.com")));
  assert.equal(new Set(profiles.map(profile => profile.alias)).size, 1);
  assert.equal(f.container("users").records.size, 1);
  assert.equal(f.container("settings").records.size, 1);
});

test("a lost profile-create response recovers the saved profile rather than creating a second alias", async () => {
  const f = fixture();
  const users = f.container("users");
  const create = users.items.create;
  users.items.create = async doc => {
    await create(doc);
    throw { code: 503 };
  };
  const profile = await ensureLoginProfile(f.service.database, "new@gmail.com");
  assert.equal(profile.status, "not_subscribed");
  assert.equal(users.records.size, 1);
  assert.equal(f.container("settings").records.size, 1);
  assert.equal((await ensureLoginProfile(f.service.database, "new@gmail.com")).alias, profile.alias);
});

test("overall streaks cross exams, while exam summaries contain totals and accuracy only", () => {
  const stats = emptyStatistics("learner");
  for (const [isCorrect, exam] of [[true, "NDA (2) 2026"], [true, "CDS (1) 2025"], [false, "NDA"], [true, "NDA"]] as const) {
    addResult(stats, { isCorrect, exam, ts: "2026-10-30T00:00:00.000Z" });
  }
  assert.equal(stats.totalAttempts, 4);
  assert.equal(stats.correctAttempts, 3);
  assert.equal(stats.accuracy, 75);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.maxStreak, 2);
  const nda = Object.values(stats.exams).find(item => item.exam === "NDA")!;
  assert.equal(nda.totalAttempts, 3);
  assert.equal(nda.accuracy, 66.67);
  assert.equal("currentStreak" in nda, false);
  assert.equal("maxStreak" in nda, false);
});

test("historical initialization preserves retries and includes retained inactive question history", async () => {
  const f = fixture();
  f.container("user-questions").save({
    id: "prelims:1", userId: "learner@gmail.com", questionId: "1", questionType: "prelims", isActive: false,
    attempts: [
      { isCorrect: true, ts: "2026-10-29T00:00:00Z" },
      { isCorrect: false, ts: "2026-10-29T00:00:01Z" },
      { isCorrect: true, ts: "2026-10-29T00:00:02Z" },
    ], attemptCount: 3, correctCount: 2, wrongCount: 1, notes: "Keep my notes", isBookmarked: true,
  });
  await f.service.seed("learner@gmail.com");
  assert.equal((await f.stats()).totalAttempts, 3);
  await f.service.append(f.attempt(true));
  await f.service.drain("learner@gmail.com");
  const stats = await f.stats();
  assert.equal(stats.totalAttempts, 4);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.lastProcessedSequence, 1);
  const question = (await f.container("user-questions").item("prelims:1", "learner@gmail.com").read()).resource;
  assert.equal(question.notes, "Keep my notes");
  assert.equal(question.isBookmarked, true);
  assert.equal(question.isActive, false);
  assert.equal(question.attempts[0].sequence, undefined);
});

test("same submission is counted once, while a deliberate retry gets a new sequence", async () => {
  const f = fixture();
  const answer = f.attempt(true);
  const first = await f.service.append(answer);
  const duplicate = await f.service.append(answer);
  assert.equal(first.sequence, 1);
  assert.equal(duplicate.sequence, 1);
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(() => f.service.append({ ...answer, attempt: { ...answer.attempt, option: "B" } }), (caught: any) => caught.code === 409);
  await f.service.append(f.attempt(false));
  await f.service.drain(answer.userId);
  assert.equal((await f.stats()).totalAttempts, 2);
  assert.equal((await f.stats()).currentStreak, 0);
});

test("saved correctness comes from the source answer and invalid options cannot allocate a sequence", async () => {
  const f = fixture();
  f.service.primeQuestion("prelims", "1", { exam: "NDA", options: ["A", "B", "C"], answer: "A" });
  const answer = f.attempt(false);
  await assert.rejects(() => f.service.append({ ...answer, attempt: { ...answer.attempt, option: "D" } }), (caught: any) => caught.code === 400);
  assert.equal(f.container("user-questions").records.size, 0);
  await f.service.append({ ...answer, attempt: { ...answer.attempt, option: "A" } });
  await f.service.drain(answer.userId);
  assert.equal((await f.stats()).correctAttempts, 1);
  const question = (await f.container("user-questions").item("prelims:1", answer.userId).read()).resource;
  assert.equal(question.attempts[0].isCorrect, true);
});

test("the first sequenced answer refreshes a prepared summary with legacy answers saved after setup", async () => {
  const f = fixture();
  const user = "learner@gmail.com";
  await f.service.seed(user);
  f.container("user-questions").save({
    id: "prelims:1", userId: user, questionId: "1", questionType: "prelims",
    attempts: [{ isCorrect: true, ts: "2026-10-29T00:00:00Z" }],
    attemptCount: 1, correctCount: 1, wrongCount: 0,
  });
  await f.service.append(f.attempt(true));
  await f.service.drain(user);
  const stats = await f.stats();
  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.lastProcessedSequence, 1);
  assert.equal(stats.prepared, undefined);
});

test("initialization cannot overwrite an active summary when a save starts during historical loading", async () => {
  const f = fixture();
  const user = "learner@gmail.com";
  await f.service.seed(user);
  const historical = f.service.historicalStatistics.bind(f.service);
  let activate = true;
  f.service.historicalStatistics = async userId => {
    const stats = await historical(userId);
    if (activate) {
      activate = false;
      await f.service.append(f.attempt(true));
      await f.service.drain(userId);
    }
    return stats;
  };
  await f.service.seed(user);
  assert.equal((await f.stats()).totalAttempts, 1);
  assert.equal((await f.stats()).lastProcessedSequence, 1);
  assert.equal((await f.stats()).prepared, undefined);
});

test("concurrent first answers cannot overwrite history or allocate the same sequence", async () => {
  const f = fixture();
  const results = await Promise.all([true, true, false, true].map(correct => f.service.append(f.attempt(correct))));
  assert.deepEqual(results.map(result => result.sequence).sort(), [1, 2, 3, 4]);
  await Promise.all([f.service.drain("learner@gmail.com"), f.service.drain("learner@gmail.com")]);
  const stats = await f.stats();
  assert.equal(stats.totalAttempts, 4);
  assert.equal(stats.correctAttempts, 3);
  assert.equal(stats.lastProcessedSequence, 4);
  const question = (await f.container("user-questions").item("prelims:1", "learner@gmail.com").read()).resource;
  assert.equal(question.attempts.length, 4);
});

test("a lost save response and failed statistics write recover without losing or doubling an answer", async () => {
  const f = fixture();
  f.container("user-questions").loseBatchResponse = true;
  const answer = f.attempt(true);
  assert.equal((await f.service.append(answer)).duplicate, true);
  f.container("user_statistics").failWrites = true;
  await assert.rejects(() => f.service.drain(answer.userId));
  const stream = (await f.container("user-questions").item("statistics:sequence", answer.userId).read()).resource;
  assert.equal(stream.pending, true);
  f.container("user_statistics").failWrites = false;
  await f.service.repair();
  await f.service.drain(answer.userId);
  assert.equal((await f.stats()).totalAttempts, 1);
  assert.equal((await f.stats()).lastProcessedSequence, 1);
});

test("a missing event cannot advance the checkpoint or let a later result change streaks", async () => {
  const f = fixture();
  await f.service.append(f.attempt(true));
  await f.service.append(f.attempt(false, "2"));
  const records = f.container("user-questions").records;
  const key = f.container("user-questions").key(eventId(1), "learner@gmail.com");
  const missing = records.get(key);
  records.delete(key);
  await assert.rejects(() => f.service.drain("learner@gmail.com"), /sequence gap/);
  assert.equal((await f.stats()).lastProcessedSequence, 0);
  assert.equal((await f.stats()).totalAttempts, 0);
  records.set(key, missing);
  await f.service.drain("learner@gmail.com");
  assert.equal((await f.stats()).lastProcessedSequence, 2);
  assert.equal((await f.stats()).currentStreak, 0);
});

test("duplicate event delivery is ignored and out-of-order batches are rejected", () => {
  const stats = emptyStatistics("learner");
  const event = { sequence: 1, isCorrect: true, exam: "NDA", ts: "2026-10-30T00:00:00Z" } as StatisticsEvent;
  const once = applyEvents(stats, [event]);
  assert.equal(applyEvents(once, [event]).totalAttempts, 1);
  assert.throws(() => applyEvents(stats, [{ ...event, sequence: 2 }]), /sequence gap/);
  assert.equal(stats.totalAttempts, 0);
});

test("leaderboard ranks saved summaries without exposing emails or gender and excludes inactive profiles", () => {
  const first = emptyStatistics("first@gmail.com");
  const second = emptyStatistics("second@gmail.com");
  addResult(first, { isCorrect: true, exam: "NDA", ts: "2026-10-30T00:00:00Z" });
  addResult(second, { isCorrect: true, exam: "NDA", ts: "2026-10-30T00:00:00Z" });
  addResult(second, { isCorrect: true, exam: "CDS", ts: "2026-10-30T00:00:01Z" });
  const profiles = [{ email: first.userId, alias: "Aakash K", isActive: true }, { email: second.userId, alias: "Anshika B", isActive: true }];
  const ranked = rankLeaderboard([first, second], profiles, "all", "correct", first.userId);
  assert.equal(ranked[0].alias, "Anshika B");
  assert.equal(ranked.find(entry => entry.isYou)?.rank, 2);
  assert.doesNotMatch(JSON.stringify(ranked), /gmail|gender|userId/);
  assert.equal("maxStreak" in rankLeaderboard([first], profiles, "NDA", "correct")[0], false);
  assert.equal(rankLeaderboard([first], [{ ...profiles[0], isActive: false }], "all", "correct").length, 0);
});

test("learner exam splits include all lifetime exam attempts even when the ranking is filtered", () => {
  const stats = emptyStatistics("learner@example.com");
  for (const exam of ["NDA", "NDA", "CDS", "NDA", "CAPF", "CDS"]) {
    addResult(stats, { isCorrect: true, exam, ts: "2026-10-30T00:00:00Z" });
  }
  const expected = [{ exam: "NDA", attempts: 3 }, { exam: "CDS", attempts: 2 }, { exam: "CAPF", attempts: 1 }];
  const overall = rankLeaderboard([stats], [], "all", "attempts")[0];
  assert.deepEqual(overall.examBreakdown, expected);
  assert.equal(overall.examBreakdown.reduce((sum, item) => sum + item.attempts, 0), overall.totalAttempts);
  const nda = rankLeaderboard([stats], [], "NDA", "attempts")[0];
  assert.equal(nda.totalAttempts, 3);
  assert.deepEqual(nda.examBreakdown, expected);
  assert.doesNotMatch(JSON.stringify(nda), /@|email|userId|gender/);
});

test("podiums rank the full population independently and keep best streak overall when filtering exams", () => {
  const summaries = [
    { id: "attempts", count: 100, correct: 30, exam: "NDA" },
    { id: "streak", count: 80, correct: 60, exam: "CDS" },
    { id: "accuracy", count: 40, correct: 40, exam: "NDA" },
    { id: "small", count: 1, correct: 1, exam: "NDA" },
    { id: "inactive", count: 500, correct: 500, exam: "NDA" },
  ].map(user => {
    const stats = emptyStatistics(`${user.id}@example.com`);
    for (let index = 0; index < user.count; index++) {
      addResult(stats, { isCorrect: index < user.correct, exam: user.exam, ts: "2026-10-30T00:00:00Z" });
    }
    return stats;
  });
  const profiles = summaries.map(summary => ({ email: summary.userId, alias: summary.userId.split("@")[0], isActive: !summary.userId.startsWith("inactive") }));
  const all = getLeaderboardHighlights(summaries, profiles, "all", "small@example.com");
  assert.deepEqual(all.attempts.map(entry => entry.alias), ["attempts", "streak", "accuracy"]);
  assert.deepEqual(all.accuracy.map(entry => entry.alias), ["attempts"]);
  assert.deepEqual(all.maxStreak.map(entry => entry.alias), ["streak", "accuracy", "attempts"]);
  assert.equal(rankLeaderboard(summaries, profiles, "all", "accuracy", "small@example.com").find(entry => entry.isYou)?.rank, 3);
  assert.deepEqual(all.accuracy.map(entry => entry.rank), [1]);
  assert.doesNotMatch(JSON.stringify(all), /@|email|userId|gender|inactive/);
  const exam = getLeaderboardHighlights(summaries, profiles, "NDA");
  assert.deepEqual(exam.attempts.map(entry => entry.alias), ["attempts", "accuracy", "small"]);
  assert.equal(exam.maxStreak[0].alias, "streak");
  assert.equal("maxStreak" in exam.attempts[0], false);
  assert.equal(exam.maxStreak[0].maxStreak, 60);
});

test("accuracy ranks 100-attempt learners first, retains smaller histories last, and uses the selected exam count", () => {
  const summaries = [
    { id: "below", count: 99, correct: 99 },
    { id: "boundary", count: 100, correct: 50 },
    { id: "above", count: 101, correct: 90 },
    { id: "small", count: 1, correct: 1 },
  ].map(user => {
    const stats = emptyStatistics(`${user.id}@example.com`);
    for (let index = 0; index < user.count; index++) {
      addResult(stats, { isCorrect: index < user.correct, exam: "NDA", ts: "2026-10-30T00:00:00Z" });
    }
    return stats;
  });
  const profiles = summaries.map(summary => ({ email: summary.userId, alias: summary.userId.split("@")[0] }));
  const ranked = rankLeaderboard(summaries, profiles, "all", "accuracy", "below@example.com");
  assert.deepEqual(ranked.map(entry => entry.alias), ["above", "boundary", "below", "small"]);
  assert.deepEqual(ranked.map(entry => entry.accuracyQualified), [true, true, false, false]);
  assert.equal(ranked.find(entry => entry.isYou)?.rank, 3);
  assert.equal(ranked.length, 4);
  assert.deepEqual(getLeaderboardHighlights(summaries, profiles, "all").accuracy.map(entry => entry.alias), ["above", "boundary"]);
  assert.deepEqual(getLeaderboardHighlights([summaries[3]], profiles, "all").accuracy, []);
  assert.equal(rankLeaderboard(summaries, profiles, "all", "correct")[0].alias, "below");
  for (let index = 0; index < 20; index++) {
    addResult(summaries[0], { isCorrect: true, exam: "CDS", ts: "2026-10-30T00:00:00Z" });
  }
  assert.equal(rankLeaderboard(summaries, profiles, "all", "accuracy")[0].alias, "below");
  const nda = rankLeaderboard(summaries, profiles, "NDA", "accuracy");
  assert.deepEqual(nda.map(entry => entry.alias), ["above", "boundary", "below", "small"]);
  assert.equal(nda[2].totalAttempts, 99);
  assert.equal(nda[2].accuracyQualified, false);
});

test("leaderboard includes all 400 samples in every environment without enabling a flag", async t => {
  const keys = ["NODE_ENV", "VERCEL", "SAMPLE_LEARNERS"] as const;
  const original = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (original[index] === undefined) delete process.env[key];
    else process.env[key] = original[index];
  }));
  const f = fixture();
  await f.service.append(f.attempt(true));
  await f.service.drain("learner@gmail.com");
  const app = express();
  app.use("/api/leaderboard", createLeaderboardRouter(f.service.database, f.service));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const [environment, vercel, flag] of [
    ["development", undefined, undefined],
    ["production", undefined, "0"],
    ["development", "1", "0"],
  ]) {
    await t.test(`${environment}, VERCEL=${vercel}, SAMPLE_LEARNERS=${flag}`, async () => {
      for (const [index, value] of [environment, vercel, flag].entries()) {
        if (value === undefined) delete process.env[keys[index]];
        else process.env[keys[index]] = value;
      }
      const entries: { id: string; isSample: boolean; rank: number }[] = [];
      for (let page = 1; page <= 17; page++) {
        const response = await fetch(`${origin}/api/leaderboard?page=${page}&email=learner%40gmail.com`);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.total, 401);
        assert.equal(data.realTotal, 1);
        assert.equal(data.pageSize, 25);
        assert.equal(data.entries.length, page === 17 ? 1 : 25);
        assert.equal(data.me.isYou, true);
        entries.push(...data.entries);
      }
      assert.equal(new Set(entries.map(entry => entry.id)).size, 401);
      assert.deepEqual(entries.map(entry => entry.rank), Array.from({ length: 401 }, (_, index) => index + 1));
      assert.equal(entries.filter(entry => entry.isSample).length, 400);
      assert.equal(f.container("user_statistics").records.size, 1);
    });
  }
});

test("the current-streak endpoint reads saved overall streaks and returns zero for a new learner", async t => {
  const f = fixture();
  await f.service.append(f.attempt(true));
  await f.service.append(f.attempt(true, "2"));
  await f.service.drain("learner@gmail.com");
  const app = express();
  app.use("/api/leaderboard", createLeaderboardRouter(f.service.database, f.service));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const read = () => fetch(`${origin}/api/leaderboard/me?email=Learner%40gmail.com`);
  const response = await read();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { currentStreak: 2 });
  await f.service.append(f.attempt(false));
  await f.service.drain("learner@gmail.com");
  assert.deepEqual(await (await read()).json(), { currentStreak: 0 });
  assert.deepEqual(await (await fetch(`${origin}/api/leaderboard/me?email=new%40example.com`)).json(), { currentStreak: 0 });
  assert.equal((await fetch(`${origin}/api/leaderboard/me`)).status, 400);
});

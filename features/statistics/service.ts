import { randomUUID } from "node:crypto";
import type { Container, Database, OperationInput } from "@azure/cosmos";
import { addResult, applyEvents, emptyStatistics, eventId, hash, type StatisticsEvent, type UserStatistics } from "./model.js";

export const statisticsContainerId = "user_statistics";
const sequenceId = "statistics:sequence";
const sourceNames: Record<string, string[]> = {
  prelims: ["questions", "state_pcs"], mains: ["mains-questions"], essay: ["essay-questions"],
  csat: ["csat-questions"], english: ["english-questions"],
};
type Stored = Record<string, any>;
interface Sequence extends Stored {
  id: string;
  userId: string;
  type: "statistics-sequence";
  state: "prepared" | "active";
  lastAssignedSequence: number;
  pending: boolean;
  initial: UserStatistics;
}
export interface AttemptInput {
  userId: string;
  questionType: string;
  questionId: string | number;
  submissionId?: string;
  attempt: { attemptId: string; option: string | null; isCorrect: boolean; ts: string; timeSpentMs: number | null } & Stored;
  meta: { subject: string | null; topic: string | null; exam: string | null; year: string | null };
}

function error(code: number, message: string): Error & { code: number } {
  return Object.assign(new Error(message), { code });
}
function clean<T extends Stored>(doc: T): T {
  const result = { ...doc };
  for (const key of ["_rid", "_self", "_etag", "_attachments", "_ts"]) delete result[key];
  return result;
}
async function optionalRead<T = Stored>(container: Container, id: string, userId: string): Promise<(T & { _etag: string }) | null> {
  try {
    const { resource } = await container.item(id, userId).read<T & { _etag: string }>();
    return resource || null;
  } catch (caught: any) {
    if (caught.code === 404) return null;
    throw caught;
  }
}
async function transaction(container: Container, userId: string, operations: OperationInput[]): Promise<void> {
  const response = await container.items.batch(operations, userId);
  const failed = response.result?.find(result => result.statusCode >= 400 && result.statusCode !== 424);
  if (failed || response.code >= 400) throw error(failed?.statusCode || response.code, "Attempt transaction failed");
}

export class StatisticsService {
  readonly attempts: Container;
  readonly summaries: Container;
  private ready?: Promise<void>;
  private questions = new Map<string, Stored | null>();

  constructor(readonly database: Database) {
    this.attempts = database.container("user-questions");
    this.summaries = database.container(statisticsContainerId);
  }

  async ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.database.containers.createIfNotExists({
        id: statisticsContainerId, partitionKey: { paths: ["/userId"] },
        indexingPolicy: {
          indexingMode: "consistent", automatic: true,
          includedPaths: [{ path: "/*" }],
          excludedPaths: [{ path: "/exams/*" }, { path: '/"_etag"/?' }],
        },
      }).then(() => undefined).catch(caught => { this.ready = undefined; throw caught; });
    }
    return this.ready;
  }

  async question(questionType: string, questionId: string): Promise<Stored | null> {
    const key = `${questionType}:${questionId}`;
    if (this.questions.has(key)) return this.questions.get(key)!;
    for (const name of sourceNames[questionType] || []) {
      const doc = await optionalRead(this.database.container(name), questionId, questionId);
      if (doc) {
        const metadata = { exam: doc.exam, year: doc.year, subject: doc.subject, topic: doc.topic, answer: doc.answer, options: doc.options };
        this.questions.set(key, metadata);
        return metadata;
      }
    }
    this.questions.set(key, null);
    return null;
  }

  primeQuestion(questionType: string, questionId: string, metadata: Stored): void {
    this.questions.set(`${questionType}:${questionId}`, metadata);
  }

  async historicalStatistics(userId: string): Promise<UserStatistics> {
    const { resources } = await this.attempts.items.query<Stored>({
      query: "SELECT c.id,c.questionId,c.questionType,c.exam,c.attempts FROM c WHERE IS_ARRAY(c.attempts) AND ARRAY_LENGTH(c.attempts) > 0",
    }, { partitionKey: userId }).fetchAll();
    const events: { isCorrect: boolean; exam: string; ts: string; key: string; index: number }[] = [];
    for (const doc of resources) {
      const metadata = doc.exam ? doc : await this.question(doc.questionType || "prelims", String(doc.questionId));
      for (let index = 0; index < doc.attempts.length; index++) {
        const attempt = doc.attempts[index];
        if (attempt.sequence !== undefined) continue;
        if (typeof attempt.isCorrect !== "boolean" || !Number.isFinite(Date.parse(attempt.ts))) {
          throw error(422, "Historical attempt needs review before statistics initialization");
        }
        events.push({
          isCorrect: attempt.isCorrect, exam: attempt.exam || metadata?.exam || "Other",
          ts: attempt.ts, key: doc.id, index,
        });
      }
    }
    events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.key.localeCompare(b.key) || a.index - b.index);
    const stats = emptyStatistics(userId);
    for (const event of events) addResult(stats, event);
    return stats;
  }

  private async sequence(userId: string): Promise<Sequence & { _etag: string }> {
    for (let retry = 0; retry < 8; retry++) {
      const existing = await optionalRead<Sequence>(this.attempts, sequenceId, userId);
      if (existing?.state === "active") return existing;
      const initial = await this.historicalStatistics(userId);
      const doc: Sequence = {
        id: sequenceId, userId, type: "statistics-sequence", state: "active",
        lastAssignedSequence: 0, pending: true, initial,
      };
      try {
        if (existing) {
          await this.attempts.item(sequenceId, userId).replace(doc, {
            accessCondition: { type: "IfMatch", condition: existing._etag },
          });
        } else {
          await this.attempts.items.create(doc);
        }
      } catch (caught: any) {
        if (![409, 412].includes(caught.code)) throw caught;
      }
    }
    throw error(409, "Could not initialize the attempt stream; please retry");
  }

  async append(input: AttemptInput): Promise<{ sequence: number; submissionId: string; duplicate: boolean }> {
    const submissionId = input.submissionId || randomUUID();
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(submissionId)) throw error(400, "Invalid submission ID");
    const questionId = String(input.questionId);
    const questionDocumentId = `${input.questionType}:${questionId}`;
    const markerId = `statistics:submission:${hash(submissionId)}`;
    const metadata = await this.question(input.questionType, questionId);
    const option = input.attempt.option;
    if (Array.isArray(metadata?.options) && !metadata.options.includes(option)) throw error(400, "Answer is not one of this question's options");
    const isCorrect = typeof metadata?.answer === "string" && Array.isArray(metadata.options)
      ? !!metadata.answer && (option === metadata.answer ||
        (!metadata.options.includes(metadata.answer) && !!option && metadata.answer.includes(option)))
      : input.attempt.isCorrect;
    const payloadHash = hash(JSON.stringify([input.questionType, questionId, option]));
    for (let retry = 0; retry < 8; retry++) {
      const marker = await optionalRead(this.attempts, markerId, input.userId);
      if (marker) {
        if (marker.payloadHash !== payloadHash) throw error(409, "Submission ID already belongs to a different answer");
        return { sequence: marker.sequence, submissionId, duplicate: true };
      }
      const stream = await this.sequence(input.userId);
      const existing = await optionalRead(this.attempts, questionDocumentId, input.userId);
      const sequence = stream.lastAssignedSequence + 1;
      const exam = metadata?.exam || existing?.exam || input.meta.exam || "Other";
      const attempt: AttemptInput["attempt"] = { ...input.attempt, isCorrect, submissionId, sequence, exam };
      const attempts = [...(existing?.attempts || []), attempt];
      const doc = {
        ...(existing ? clean(existing) : {}),
        id: questionDocumentId, userId: input.userId, schemaVersion: 1,
        questionId: input.questionId, questionType: input.questionType,
        exam, year: metadata?.year ?? input.meta.year ?? existing?.year ?? null,
        subject: metadata?.subject ?? input.meta.subject ?? existing?.subject ?? null,
        topic: metadata?.topic ?? input.meta.topic ?? existing?.topic ?? null,
        isBookmarked: existing?.isBookmarked ?? false,
        isMarkedForRevision: existing?.isMarkedForRevision ?? false,
        notes: existing?.notes ?? "", hasNote: !!String(existing?.notes || "").trim(),
        attempts, attemptCount: attempts.length,
        correctCount: (existing?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0),
        wrongCount: (existing?.wrongCount ?? 0) + (attempt.isCorrect ? 0 : 1),
        lastOption: attempt.option, lastIsCorrect: attempt.isCorrect,
        lastAttemptId: attempt.attemptId, lastAttemptAt: attempt.ts,
        ...(attempt.via === "similarity" ? {
          similarityAttemptCount: (existing?.similarityAttemptCount ?? 0) + 1, lastSimilarityAt: attempt.ts,
        } : {}),
        isActive: existing?.isActive ?? true, deletedAt: existing?.deletedAt ?? null,
        createdAt: existing?.createdAt || attempt.ts, updatedAt: attempt.ts,
      };
      const event: StatisticsEvent = {
        id: eventId(sequence), userId: input.userId, type: "statistics-event", sequence, submissionId,
        questionId, questionType: input.questionType, isCorrect: attempt.isCorrect, exam, ts: attempt.ts,
      };
      const nextStream: Stored = { ...clean(stream), lastAssignedSequence: sequence, pending: true };
      const operations: OperationInput[] = [
        existing
          ? { operationType: "Replace", id: doc.id, ifMatch: existing._etag, resourceBody: doc }
          : { operationType: "Create", resourceBody: doc },
        {
          operationType: "Replace", id: sequenceId, ifMatch: stream._etag,
          resourceBody: nextStream,
        },
        { operationType: "Create", resourceBody: { ...event } },
        { operationType: "Create", resourceBody: {
          id: markerId, userId: input.userId, type: "statistics-submission", payloadHash, sequence,
        } },
      ];
      try {
        await transaction(this.attempts, input.userId, operations);
        return { sequence, submissionId, duplicate: false };
      } catch (caught: any) {
        const saved = await optionalRead(this.attempts, markerId, input.userId);
        if (saved) {
          if (saved.payloadHash !== payloadHash) throw error(409, "Submission ID already belongs to a different answer");
          return { sequence: saved.sequence, submissionId, duplicate: true };
        }
        if (![409, 412].includes(caught.code)) throw caught;
      }
    }
    throw error(409, "Another answer was saved simultaneously; please retry");
  }

  async drain(userId: string, maximum = 100): Promise<boolean> {
    await this.ensure();
    for (let retry = 0; retry < 8; retry++) {
      const stream = await optionalRead<Sequence>(this.attempts, sequenceId, userId);
      if (!stream || stream.state !== "active") return true;
      let existing = await optionalRead<UserStatistics>(this.summaries, "overall", userId);
      if (!existing || (existing.lastProcessedSequence === 0 && (existing as Stored).prepared)) {
        const seed = { ...stream.initial, updatedAt: new Date().toISOString() };
        try {
          if (existing) {
            await this.summaries.item("overall", userId).replace(seed, { accessCondition: { type: "IfMatch", condition: existing._etag } });
          } else {
            await this.summaries.items.create(seed);
          }
        } catch (caught: any) {
          if (![409, 412].includes(caught.code)) throw caught;
        }
        continue;
      }
      const { resources } = await this.attempts.items.query<StatisticsEvent>({
        query: "SELECT TOP @limit * FROM c WHERE c.type = 'statistics-event' AND c.sequence > @after AND c.sequence <= @head ORDER BY c.sequence",
        parameters: [
          { name: "@limit", value: maximum }, { name: "@after", value: existing.lastProcessedSequence },
          { name: "@head", value: stream.lastAssignedSequence },
        ],
      }, { partitionKey: userId }).fetchAll();
      if (resources.length) {
        const next = applyEvents(clean(existing), resources);
        try {
          await this.summaries.item("overall", userId).replace(next, {
            accessCondition: { type: "IfMatch", condition: existing._etag },
          });
        } catch (caught: any) {
          if (caught.code === 412) continue;
          throw caught;
        }
        existing = { ...next, _etag: "" };
      }
      if (existing.lastProcessedSequence < stream.lastAssignedSequence) return false;
      if (stream.pending) {
        try {
          await this.attempts.item(sequenceId, userId).patch([{ op: "set", path: "/pending", value: false }], {
            accessCondition: { type: "IfMatch", condition: stream._etag },
          });
        } catch (caught: any) {
          if (caught.code === 412) continue;
          throw caught;
        }
      }
      return true;
    }
    return false;
  }

  async repair(limit = 5): Promise<{ repaired: number; pending: number }> {
    const { resources } = await this.attempts.items.query<{ userId: string }>({
      query: "SELECT TOP @limit c.userId FROM c WHERE c.type = 'statistics-sequence' AND c.pending = true AND c.state = 'active' " +
        "AND (NOT IS_DEFINED(c.retryAfter) OR c.retryAfter <= @now)",
      parameters: [{ name: "@limit", value: limit + 1 }, { name: "@now", value: new Date().toISOString() }],
    }).fetchAll();
    let repaired = 0;
    for (const user of resources.slice(0, limit)) {
      try { if (await this.drain(user.userId)) repaired++; }
      catch (caught) {
        console.error("Statistics retry failed:", caught instanceof Error ? caught.message : caught);
        const stream = await optionalRead<Sequence>(this.attempts, sequenceId, user.userId);
        if (stream) {
          await this.attempts.item(sequenceId, user.userId).patch([
            { op: "set", path: "/retryAfter", value: new Date(Date.now() + 60_000).toISOString() },
          ], { accessCondition: { type: "IfMatch", condition: stream._etag } }).catch(() => {});
        }
      }
    }
    return { repaired, pending: resources.length - repaired };
  }

  async seed(userId: string): Promise<UserStatistics> {
    await this.ensure();
    const stream = await optionalRead<Sequence>(this.attempts, sequenceId, userId);
    if (stream?.state === "active") {
      await this.drain(userId, 500);
      const existing = await optionalRead<UserStatistics>(this.summaries, "overall", userId);
      if (!existing) throw new Error("Active statistics were not materialized");
      return clean(existing);
    }
    const existing = await optionalRead<UserStatistics & { prepared?: boolean }>(this.summaries, "overall", userId);
    if (existing && !existing.prepared) return clean(existing);
    const stats = await this.historicalStatistics(userId);
    const activated = await optionalRead<Sequence>(this.attempts, sequenceId, userId);
    if (activated?.state === "active") {
      await this.drain(userId, 500);
      return clean((await optionalRead<UserStatistics>(this.summaries, "overall", userId))!);
    }
    const prepared = { ...stats, prepared: true };
    if (existing) {
      await this.summaries.item("overall", userId).replace(prepared, { accessCondition: { type: "IfMatch", condition: existing._etag } });
    } else {
      await this.summaries.items.create(prepared);
    }
    return stats;
  }
}

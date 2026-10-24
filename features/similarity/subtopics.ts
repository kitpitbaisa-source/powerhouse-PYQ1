import type { Database } from "@azure/cosmos";
import { z } from "zod";
import { profileContainerId, schemaVersion } from "./config.js";
import { hashContent } from "./content-hash.js";
import { sourceQuestionSchema } from "./schema.js";
import type { QuestionSourceContainer, SubjectClassificationDisplay } from "./types.js";
import { questionVerificationSchema } from "./verification.js";
import { masterClassificationSchema, masterContainerId, masterRecordSchema, type MasterRecord } from "../taxonomy/master.js";

const subtopicProfileSchema = z.object({
  questionId: z.string(),
  classification: z.object({
    subject: z.string(),
    topic: z.string(),
    subtopics: z.array(z.string()),
    master: z.unknown().optional(),
  }),
  sourceContentHash: z.string(),
});
type SubtopicProfile = z.infer<typeof subtopicProfileSchema>;

export async function loadActiveSubtopicMaster(database: Database): Promise<MasterRecord[]> {
  const { resources } = await database.container(masterContainerId).items.query<unknown>(
    "SELECT VALUE c FROM c WHERE c.isActive = true",
  ).fetchAll();
  return resources.map(record => masterRecordSchema.parse(record));
}

export function approvedQuestionSubject(
  question: unknown, master: readonly MasterRecord[],
): SubjectClassificationDisplay | null {
  const source = sourceQuestionSchema.safeParse(question);
  const review = z.object({ verification: questionVerificationSchema }).safeParse(question);
  if (!source.success || !source.data.isActive || !review.success) return null;
  const { verification } = review.data;
  if (verification.checks.master_classification.status !== "passed" ||
      verification.sourceContentHash !== hashContent(source.data) || !verification.masterClassification) return null;
  const { subjectId, topicId } = verification.masterClassification;
  const subject = master.find(record => record.isActive && record.id === subjectId && record.type === "subject");
  const topic = master.find(record => record.isActive && record.id === topicId && record.type === "topic");
  if (!subject || subject.subjectId !== subjectId ||
      !topic || topic.subjectId !== subjectId || topic.parentId !== subjectId) return null;
  return { subjectId, subject: subject.name };
}

export function approvedMasterSubtopics(
  classification: { subject: string; topic: string; subtopics: readonly string[]; master?: unknown },
  master: readonly MasterRecord[],
): string[] {
  const binding = masterClassificationSchema.safeParse(classification.master);
  if (!binding.success || binding.data.subtopicIds.length !== classification.subtopics.length) return [];
  const { subjectId, topicId, subtopicIds } = binding.data;
  const records = new Map(master.filter(record => record.isActive).map(record => [record.id, record]));
  const subject = records.get(subjectId);
  const topic = records.get(topicId);
  if (subject?.type !== "subject" || subject.subjectId !== subjectId ||
      subject.name !== classification.subject ||
      topic?.type !== "topic" || topic.subjectId !== subjectId ||
      topic.parentId !== subjectId || topic.name !== classification.topic) return [];
  return subtopicIds.flatMap((id, index) => {
    const subtopic = records.get(id);
    return subtopic?.type === "subtopic" && subtopic.subjectId === subjectId &&
      subtopic.parentId === topicId && subtopic.name === classification.subtopics[index]
      ? [subtopic.name] : [];
  });
}

export function mergeProfileSubtopics<T extends { id?: string | number; subtopics?: string[]; verification?: { status?: string } }>(
  questions: T[], profiles: SubtopicProfile[], master: readonly MasterRecord[],
): (T & { subtopics?: string[] })[] {
  const byId = new Map(profiles.map(profile => [profile.questionId, profile]));
  return questions.map(question => {
    const hidden: T & { subtopics: string[] } = { ...question, subtopics: [] };
    const profile = byId.get(String(question.id));
    if (!profile || question.verification?.status === "pending_review") return hidden;
    const source = sourceQuestionSchema.safeParse(question);
    if (!source.success) {
      console.warn(`Cannot display profile subtopics for invalid source question ${question.id}.`);
      return hidden;
    }
    if (!source.data.isActive || hashContent(source.data) !== profile.sourceContentHash) return hidden;
    return { ...question, subtopics: approvedMasterSubtopics(profile.classification, master) };
  });
}

export async function loadQuestionSubtopics<T extends { id?: string | number; subtopics?: string[] }>(
  database: Database, sourceContainer: QuestionSourceContainer, questions: T[],
) {
  const profiles: SubtopicProfile[] = [];
  const ids = [...new Set(questions.filter(question => question.id !== undefined).map(question => String(question.id)))];
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const { resources } = await database.container(profileContainerId).items.query<unknown>({
      query: `SELECT c.questionId, c.classification,
          c.processing.sourceContentHash AS sourceContentHash
        FROM c WHERE c.sourceContainer = @source AND c.schemaVersion = @schema
          AND ARRAY_CONTAINS(@ids, c.questionId)
          AND c.processing.status = "ready"
          AND (NOT IS_DEFINED(c.verification.status) OR c.verification.status != "pending_review")
          AND ARRAY_LENGTH(c.classification.subtopics) > 0`,
      parameters: [
        { name: "@source", value: sourceContainer },
        { name: "@schema", value: schemaVersion },
        { name: "@ids", value: ids.slice(offset, offset + 1000) },
      ],
    }).fetchAll();
    profiles.push(...resources.map(resource => subtopicProfileSchema.parse(resource)));
  }
  const master = questions.length ? await loadActiveSubtopicMaster(database) : [];
  return mergeProfileSubtopics(questions, profiles, master).map(question => ({
    ...question, subjectClassification: approvedQuestionSubject(question, master),
  }));
}

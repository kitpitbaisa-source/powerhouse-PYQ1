import type { Database } from "@azure/cosmos";
import { z } from "zod";
import { hashContent } from "../similarity/content-hash.js";

export const mainsSyllabusContainerId = "mains_syllabus_master";
const needsClassification = "Needs classification";
const masterRecord = z.object({
  id: z.string().min(1), syllabusId: z.string().min(1), paperId: z.string().min(1),
  type: z.enum(["paper", "subject", "topic"]), parentId: z.string().nullable(),
  name: z.string().min(1), isActive: z.boolean(),
});

export function mainsSyllabusSourceHash(question: Record<string, any>): string {
  return hashContent({
    exam: question.exam, id: question.id, paper: question.paper, question: question.question,
    questionRaw: question.questionRaw ?? null, type: question.type ?? null, year: question.year,
  });
}

export function applyMainsSyllabus<T extends Record<string, any>>(questions: readonly T[], records: readonly unknown[]) {
  const master = new Map(records.flatMap(record => {
    const parsed = masterRecord.safeParse(record);
    return parsed.success && parsed.data.isActive
      ? [[`${parsed.data.syllabusId}:${parsed.data.id}`, parsed.data] as const] : [];
  }));
  return questions.filter(question => question.isActive !== false && question.id !== "__cache_version__").map(question => {
    const binding = question.mainsSyllabus;
    const get = (id: string) => master.get(`${binding?.syllabusId}:${id}`);
    const paper = get(binding?.paperId);
    const subject = get(binding?.subjectId);
    const topic = get(binding?.topicId);
    const approved = binding?.review?.status === "mapped" &&
      Array.isArray(binding.review.issues) && binding.review.issues.length === 0 &&
      binding.review.sourceHash === mainsSyllabusSourceHash(question) &&
      paper?.type === "paper" && paper.parentId === null &&
      paper.id === `MAINS-${String(question.paper).replace(/\s/g, "").toUpperCase()}` &&
      subject?.type === "subject" && subject.parentId === paper.id && subject.paperId === paper.id &&
      topic?.type === "topic" && topic.parentId === subject.id && topic.paperId === paper.id;
    return {
      ...question,
      legacyClassification: question.legacyClassification ?? {
        subject: question.subject, topic: question.topic, paper: question.paper,
      },
      originalSubject: question.originalSubject ?? question.subject,
      classificationSource: "mains_syllabus" as const,
      subject: approved ? subject.name : needsClassification,
      topic: approved ? topic.name : needsClassification,
      subjectClassification: approved ? { subjectId: subject.id, subject: subject.name } : null,
      subtopics: [],
    };
  });
}

export async function loadMainsSyllabusQuestions<T extends Record<string, any>>(database: Database, questions: readonly T[]) {
  const { resources } = await database.container(mainsSyllabusContainerId).items
    .query<unknown>("SELECT * FROM c WHERE c.isActive = true").fetchAll();
  return applyMainsSyllabus(questions, resources);
}

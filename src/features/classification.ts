import type { SubjectClassificationDisplay } from "../../features/similarity/types";

export const NEEDS_CLASSIFICATION = "Needs classification";

export interface QuestionSubjectFields {
  subjectClassification?: SubjectClassificationDisplay | null;
  originalSubject?: string;
}

export function withSubjectDisplay<T extends QuestionSubjectFields & { subject: string }>(question: T): T & { originalSubject: string } {
  return {
    ...question,
    originalSubject: question.originalSubject ?? question.subject,
    subject: question.subjectClassification?.subject ?? NEEDS_CLASSIFICATION,
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { QuestionSourceContainer, SourceQualityNotice } from "../features/similarity/types";
import type { QuestionSubjectFields } from "./features/classification";
import type { ContentVerification } from "./features/question-review";

export interface Question extends QuestionSubjectFields {
  id: number;
  year: string;
  subject: string;
  topic?: string;
  subtopics?: string[];
  exam: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  sourceContainer?: QuestionSourceContainer;
  reviewWarnings?: SourceQualityNotice[];
  verification?: ContentVerification & { warnings?: SourceQualityNotice[] };
}

export interface MainsQuestion extends QuestionSubjectFields {
  id: string;
  question: string;
  year: string;
  exam: string;
  subject: string;
  topic?: string;
  subtopics?: string[];
  paper?: string;
  modelAnswer?: string;
  model_answer?: string;
  keywords?: string[];
  marks?: number | null;
  words?: number | null;
  questionNumber?: number | string | null;
  sourceContainer?: QuestionSourceContainer;
  reviewWarnings?: SourceQualityNotice[];
  verification?: ContentVerification & { warnings?: SourceQualityNotice[] };
}

export interface EssayQuestion extends MainsQuestion {
  source?: string;
}

export interface TopperAnswer {
  topperName: string;
  rank: string;
  topperAnswerText: string;
}

export interface ToppersCopyQuestion extends QuestionSubjectFields {
  id: string;
  year: string;
  subject: string;
  topic?: string;
  exam: string;
  paper?: string;
  question: string;
  marks?: number;
  words?: number;
  questionNumber?: number;
  answers: TopperAnswer[];
}

export type SubjectColorMap = {
  [key: string]: string;
};

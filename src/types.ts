/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: number;
  year: string;
  subject: string;
  topic?: string;
  exam: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface MainsQuestion {
  id: string;
  question: string;
  year: string;
  exam: string;
  subject: string;
  topic?: string;
  paper?: string;
  modelAnswer?: string;
  model_answer?: string;
  keywords?: string[];
}

export interface TopperAnswer {
  topperName: string;
  rank: string;
  topperAnswerText: string;
}

export interface ToppersCopyQuestion {
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

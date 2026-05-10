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

export type SubjectColorMap = {
  [key: string]: string;
};

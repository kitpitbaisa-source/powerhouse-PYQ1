/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Accepts every option named in a multi-answer key such as "(b) X and (c) Y".
export function isCorrectOption(option: string, answer: string, options: string[] = []): boolean {
  if (!answer) return false;
  if (option === answer) return true;
  if (options.includes(answer)) return false;
  const normalizedAnswer = answer.toLowerCase();
  const normalizedOption = option.toLowerCase();
  const matchingOptions = options.filter(value => value.toLowerCase() === normalizedAnswer);
  if (matchingOptions.length) return matchingOptions.length === 1 && matchingOptions[0] === option;
  return normalizedOption.length > 0 && normalizedAnswer.includes(normalizedOption);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

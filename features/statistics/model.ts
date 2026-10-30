import { createHash } from "node:crypto";

export interface Totals {
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  accuracy: number;
}

export interface ExamTotals extends Totals {
  exam: string;
}

export interface UserStatistics extends Totals {
  id: "overall";
  userId: string;
  publicId: string;
  type: "user-statistics";
  schemaVersion: 1;
  currentStreak: number;
  maxStreak: number;
  lastProcessedSequence: number;
  lastAttemptAt: string | null;
  exams: Record<string, ExamTotals>;
  updatedAt: string;
}

export interface StatisticsEvent {
  id: string;
  userId: string;
  type: "statistics-event";
  sequence: number;
  submissionId: string;
  questionId: string;
  questionType: string;
  isCorrect: boolean;
  exam: string;
  ts: string;
}

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const publicUserId = (userId: string) => hash(userId).slice(0, 24);
export const eventId = (sequence: number) => `statistics:event:${String(sequence).padStart(12, "0")}`;
export const emptyTotals = (): Totals => ({ totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, accuracy: 0 });

export function emptyStatistics(userId: string): UserStatistics {
  return {
    id: "overall", userId, publicId: publicUserId(userId), type: "user-statistics", schemaVersion: 1,
    ...emptyTotals(), currentStreak: 0, maxStreak: 0, lastProcessedSequence: 0,
    lastAttemptAt: null, exams: {}, updatedAt: new Date().toISOString(),
  };
}

export function examCategory(exam?: string | null): string {
  const name = (exam || "").trim();
  if (!name) return "Other";
  const upper = name.toUpperCase();
  if (upper.includes("CIVIL SERVICES") || upper.includes("CSE") || upper.includes("UPSC")) return "UPSC CSE";
  for (const key of ["NDA", "CDS", "CAPF", "BPSC", "CISF", "EPFO EO/AO"]) {
    if (upper.includes(key)) return key;
  }
  if (upper.includes("STATE PCS") || /\bPCS\b/.test(upper)) return "State PCS";
  return name.replace(/\s*[-–]?\s*(?:19|20)\d{2}\s*$/u, "").replace(/\s+\([12]\)\s*$/u, "").trim() || "Other";
}

function addAnswer(totals: Totals, correct: boolean): void {
  totals.totalAttempts++;
  totals.correctAttempts += correct ? 1 : 0;
  totals.wrongAttempts = totals.totalAttempts - totals.correctAttempts;
  totals.accuracy = Math.round(totals.correctAttempts / totals.totalAttempts * 10000) / 100;
}

export function addResult(stats: UserStatistics, answer: { isCorrect: boolean; exam: string; ts: string }): void {
  addAnswer(stats, answer.isCorrect);
  stats.currentStreak = answer.isCorrect ? stats.currentStreak + 1 : 0;
  stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  const exam = examCategory(answer.exam);
  const key = hash(exam).slice(0, 16);
  const totals = stats.exams[key] ||= { exam, ...emptyTotals() };
  addAnswer(totals, answer.isCorrect);
  stats.lastAttemptAt = answer.ts;
}

export function applyEvents(stats: UserStatistics, events: StatisticsEvent[]): UserStatistics {
  const next = structuredClone(stats);
  for (const event of events) {
    if (event.sequence <= next.lastProcessedSequence) continue;
    if (event.sequence !== next.lastProcessedSequence + 1) throw new Error("Statistics event sequence gap");
    addResult(next, event);
    next.lastProcessedSequence = event.sequence;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

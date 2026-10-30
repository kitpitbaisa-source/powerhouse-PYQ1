import { ALIAS_ADJECTIVES, ALIAS_NOUNS } from "./alias-names.js";
import { emptyStatistics, type UserStatistics } from "./model.js";

// Sample learners are included in every environment and never stored in the database.
export const SAMPLE_LEARNER_COUNT = 400;
const MAX_ATTEMPTS = 60;
const MAX_STREAK = 6;

export const SAMPLE_EMAIL_DOMAIN = "@sample.invalid";
export const isSampleUser = (userId: string) => userId.endsWith(SAMPLE_EMAIL_DOMAIN);

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleLearners(exams: string[]): { summaries: UserStatistics[]; profiles: { email: string; alias: string }[] } {
  const pool = exams.length ? exams : ["General"];
  const next = random(20261030);
  const summaries: UserStatistics[] = [];
  const profiles: { email: string; alias: string }[] = [];
  for (let index = 0; index < SAMPLE_LEARNER_COUNT; index++) {
    const email = `sample-learner-${index + 1}${SAMPLE_EMAIL_DOMAIN}`;
    const alias = `${ALIAS_ADJECTIVES[index % ALIAS_ADJECTIVES.length]} ${ALIAS_NOUNS[Math.floor(index / ALIAS_ADJECTIVES.length) % ALIAS_NOUNS.length]}`;
    const stats = emptyStatistics(email);
    const total = 5 + Math.floor(next() * (MAX_ATTEMPTS - 4));
    const correct = Math.min(total, Math.round(total * (0.35 + next() * 0.5)));
    const spread = 1 + Math.floor(next() * Math.min(3, pool.length));
    const chosen = [...pool].sort(() => next() - 0.5).slice(0, spread);
    let remaining = total;
    let remainingCorrect = correct;
    chosen.forEach((exam, position) => {
      const last = position === chosen.length - 1;
      const attempts = last ? remaining : Math.max(1, Math.floor(remaining * (0.3 + next() * 0.4)));
      const right = last ? remainingCorrect : Math.min(attempts, Math.round(remainingCorrect * attempts / remaining));
      remaining -= attempts;
      remainingCorrect -= right;
      stats.exams[exam] = { exam, totalAttempts: attempts, correctAttempts: right, wrongAttempts: attempts - right, accuracy: Math.round(right / attempts * 10000) / 100 };
    });
    stats.totalAttempts = total;
    stats.correctAttempts = correct;
    stats.wrongAttempts = total - correct;
    stats.accuracy = Math.round(correct / total * 10000) / 100;
    stats.maxStreak = Math.min(MAX_STREAK, Math.max(1, Math.floor(next() * (MAX_STREAK + 1))));
    stats.currentStreak = Math.min(stats.maxStreak, Math.floor(next() * (stats.maxStreak + 1)));
    summaries.push(stats);
    profiles.push({ email, alias });
  }
  return { summaries, profiles };
}

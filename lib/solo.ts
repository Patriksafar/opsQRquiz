import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Question } from "./types";

/**
 * Shared bits of the solo quiz that must stay on the server.
 *
 * The important one is `correctIndex`: it never reaches the browser. Questions
 * are shipped stripped, the client posts back only which option it picked, and
 * grading happens here. Otherwise anyone could read the answer key out of the
 * page source — which matters more here than in the live game, because these
 * scores are attached to a person and a reward.
 */

/** A question as the browser sees it — no answer key. */
export type SoloQuestion = {
  text: string;
  options: string[];
};

export function loadQuestions(): Question[] {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "questions.json"), "utf-8"),
  ) as Question[];
}

export function stripAnswers(questions: Question[]): SoloQuestion[] {
  return questions.map((q) => ({ text: q.text, options: q.options }));
}

export function grade(answers: (number | null)[], questions: Question[]) {
  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score += 1;
  });
  return { score, total: questions.length };
}

/**
 * Deliberately permissive: this gate exists to catch typos that would make a
 * reward undeliverable, not to police which addresses are legitimate.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function parseAnswers(raw: unknown, expected: number): (number | null)[] | null {
  if (!Array.isArray(raw) || raw.length !== expected) return null;
  return raw.map((v) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null));
}

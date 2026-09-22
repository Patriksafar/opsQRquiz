import { NextResponse } from "next/server";
import { recordResult } from "@/lib/db";
import { grade, loadQuestions, parseAnswers } from "@/lib/solo";

export const dynamic = "force-dynamic";

/**
 * Grades the submitted answers server-side and stores the result.
 *
 * The client posts only the option indices it picked; the answer key never
 * left the server, so the score can't be forged from the browser.
 *
 * Note what this returns on a DB failure: still the score. The email was
 * already secured by /api/solo/start, so a write failure here loses a score,
 * not a participant — and there's no reason to make the person who just
 * finished the quiz stare at an error over it.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { participantId, answers: rawAnswers } = (body ?? {}) as {
    participantId?: unknown;
    answers?: unknown;
  };

  const questions = loadQuestions();
  const answers = parseAnswers(rawAnswers, questions.length);
  if (!answers) {
    return NextResponse.json({ error: "Neplatné odpovědi." }, { status: 400 });
  }

  const { score, total } = grade(answers, questions);

  // Timed on the server from when /start stamped started_at, since this
  // decides the top three. If the write fails we still return the score and
  // let the client fall back to its own stopwatch for the display.
  let durationMs: number | null = null;
  if (typeof participantId === "string" && participantId.length > 0) {
    try {
      ({ durationMs } = await recordResult(participantId, score, total, answers));
    } catch (err) {
      console.error("[solo] failed to record result:", err);
    }
  }

  return NextResponse.json({ score, total, durationMs });
}

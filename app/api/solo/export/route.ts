import { NextResponse } from "next/server";
import { DbNotConfiguredError, listParticipants } from "@/lib/db";
import { loadQuestions } from "@/lib/solo";

export const dynamic = "force-dynamic";

/**
 * CSV of everyone who entered an email, for actually sending the rewards.
 *
 * Gated on ADMIN_SECRET, the same secret the live game's admin route uses:
 *   /api/solo/export?secret=<ADMIN_SECRET>
 *
 * Without this the list is only reachable through the Neon console, which is
 * a poor fit for "export the addresses and mail them".
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote anything that could break the row, and double embedded quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The driver hands timestamptz back as a Date, and String(Date) drops the
 * milliseconds and isn't something a spreadsheet parses — so emit ISO 8601.
 */
function formatTimestamp(value: Date | string | null): string {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function GET(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");

  if (!adminSecret || provided !== adminSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const rows = await listParticipants();
    const questions = loadQuestions();
    // Rows come back ordered by standing, so the reward winners are the
    // first three lines of the file.
    const header = [
      "rank",
      "email",
      "consent",
      "score",
      "total",
      "duration_ms",
      "duration",
      "attempts",
      "created_at",
      "started_at",
      "completed_at",
      // The picked option (1-based) per question, from the best attempt,
      // followed by whether it was right.
      ...questions.flatMap((_, i) => [`q${i + 1}`, `q${i + 1}_correct`]),
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.rank,
          r.email,
          r.consent,
          r.score,
          r.total,
          r.duration_ms,
          // Raw ms for sorting, m:ss alongside it for reading.
          formatDuration(r.duration_ms),
          r.attempts,
          formatTimestamp(r.created_at),
          formatTimestamp(r.started_at),
          formatTimestamp(r.completed_at),
          ...questions.flatMap((q, i): unknown[] => {
            if (!r.answers) return ["", ""];
            const picked = r.answers[i];
            if (picked === null || picked === undefined) return ["", "false"];
            return [picked + 1, picked === q.correctIndex];
          }),
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="quiz-participants.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json(
        { error: "DATABASE_URL is not set." },
        { status: 503 },
      );
    }
    console.error("[solo] export failed:", err);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}

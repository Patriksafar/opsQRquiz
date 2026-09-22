import { NextResponse } from "next/server";
import { DbNotConfiguredError, listParticipants } from "@/lib/db";

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

export async function GET(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");

  if (!adminSecret || provided !== adminSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const rows = await listParticipants();
    const header = [
      "email",
      "consent",
      "score",
      "total",
      "attempts",
      "created_at",
      "completed_at",
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.email,
          r.consent,
          r.score,
          r.total,
          r.attempts,
          r.created_at,
          r.completed_at,
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

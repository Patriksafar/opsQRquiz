import { NextResponse } from "next/server";
import { DbNotConfiguredError, upsertParticipant } from "@/lib/db";
import { normalizeEmail } from "@/lib/solo";

export const dynamic = "force-dynamic";

/**
 * Captures the email BEFORE the quiz begins.
 *
 * The address is the thing that actually matters here — it's what the rewards
 * and follow-up go to. Storing it up front means a failure later (a dropped
 * connection, a closed tab, a DB blip on submit) costs us a score, not a
 * participant. If this write fails the user is told immediately, while they've
 * invested nothing but an email address.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const { email: rawEmail, consent } = (body ?? {}) as {
    email?: unknown;
    consent?: unknown;
  };

  const email = normalizeEmail(rawEmail);
  if (!email) {
    return NextResponse.json(
      { error: "Zadej platnou e-mailovou adresu." },
      { status: 400 },
    );
  }

  if (consent !== true) {
    return NextResponse.json(
      { error: "Bez souhlasu bohužel nemůžeme e-mail uložit." },
      { status: 400 },
    );
  }

  try {
    const participant = await upsertParticipant(email, true);
    return NextResponse.json({ participantId: participant.id });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      console.error("[solo] DATABASE_URL is not set — refusing to start a quiz.");
      return NextResponse.json(
        { error: "Kvíz zatím není připravený. Zkus to prosím za chvíli." },
        { status: 503 },
      );
    }
    console.error("[solo] failed to store participant:", err);
    return NextResponse.json(
      { error: "E-mail se nepodařilo uložit. Zkus to prosím znovu." },
      { status: 500 },
    );
  }
}

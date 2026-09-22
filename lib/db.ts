import { neon } from "@neondatabase/serverless";

/**
 * Neon Postgres access for the solo quiz.
 *
 * The live multiplayer game (`lib/game.ts`) stays entirely in memory — nothing
 * here touches it. This module exists only so the solo quiz can persist the
 * email addresses it collects.
 */

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set — cannot store participants.");
    this.name = "DbNotConfiguredError";
  }
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfiguredError();
  return neon(url);
}

/**
 * Created on first use rather than in a migration step, so deploying is just
 * "set DATABASE_URL and go". `ensureSchema` is cheap and idempotent, but we
 * only pay for it once per process.
 */
let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      await db`
        create table if not exists solo_participants (
          id            bigserial   primary key,
          email         text        not null unique,
          consent       boolean     not null default false,
          score         integer,
          total         integer,
          attempts      integer     not null default 1,
          answers       jsonb,
          created_at    timestamptz not null default now(),
          completed_at  timestamptz
        )
      `;
    })().catch((err) => {
      // Don't cache a failed init — the next request should retry.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type Participant = {
  id: string;
  email: string;
};

/**
 * Records the email before the quiz starts, so an address is never lost to a
 * later failure. A repeat visitor updates their existing row instead of
 * creating a duplicate — the reward list wants one entry per person.
 */
export async function upsertParticipant(
  email: string,
  consent: boolean,
): Promise<Participant> {
  await ensureSchema();
  const db = sql();
  const rows = (await db`
    insert into solo_participants (email, consent)
    values (${email}, ${consent})
    on conflict (email) do update
      set attempts = solo_participants.attempts + 1,
          consent  = excluded.consent
    returning id, email
  `) as { id: string; email: string }[];
  return { id: String(rows[0].id), email: rows[0].email };
}

/**
 * Stores the graded result. Keeps the best score across attempts so a retake
 * can't lower what someone already earned.
 */
export async function recordResult(
  participantId: string,
  score: number,
  total: number,
  answers: (number | null)[],
): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`
    update solo_participants
       set score        = greatest(coalesce(score, 0), ${score}),
           total        = ${total},
           answers      = ${JSON.stringify(answers)}::jsonb,
           completed_at = now()
     where id = ${participantId}
  `;
}

export type ParticipantRow = {
  email: string;
  consent: boolean;
  score: number | null;
  total: number | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
};

/** Backs the CSV export the organiser uses to actually send the rewards. */
export async function listParticipants(): Promise<ParticipantRow[]> {
  await ensureSchema();
  const db = sql();
  return (await db`
    select email, consent, score, total, attempts, created_at, completed_at
      from solo_participants
     order by created_at asc
  `) as ParticipantRow[];
}

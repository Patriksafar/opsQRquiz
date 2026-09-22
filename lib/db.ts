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
      // Added after the table was already live, so these have to be additive.
      // `started_at` is distinct from `created_at`: created_at is when we first
      // ever saw this address, started_at is when the CURRENT attempt began —
      // on a retake they diverge, and timing the retake against created_at
      // would report the time since their first ever visit.
      await db`alter table solo_participants add column if not exists started_at  timestamptz`;
      await db`alter table solo_participants add column if not exists duration_ms integer`;
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
    insert into solo_participants (email, consent, started_at)
    values (${email}, ${consent}, now())
    on conflict (email) do update
      set attempts   = solo_participants.attempts + 1,
          consent    = excluded.consent,
          started_at = now()
    returning id, email
  `) as { id: string; email: string }[];
  return { id: String(rows[0].id), email: rows[0].email };
}

/**
 * Stores the graded result and how long the attempt took.
 *
 * Timed from `started_at` on the server rather than from a clock the browser
 * reports, because this time decides who places in the top three.
 *
 * Keeps the BEST attempt as a unit: if a retake scores worse, its score,
 * answers and duration are all discarded together. Mixing a new duration into
 * an old score would invent an attempt that never happened. Every SET
 * expression below reads the pre-UPDATE row, so `score` in the CASE guards is
 * the stored score, not the one being written.
 */
export async function recordResult(
  participantId: string,
  score: number,
  total: number,
  answers: (number | null)[],
): Promise<{ durationMs: number | null }> {
  await ensureSchema();
  const db = sql();
  const rows = (await db`
    update solo_participants
       set total        = ${total},
           completed_at = now(),
           answers      = case when ${score} > coalesce(score, -1)
                               then ${JSON.stringify(answers)}::jsonb
                               else answers end,
           duration_ms  = case when ${score} > coalesce(score, -1)
                               then greatest(
                                 0,
                                 (extract(epoch from (now() - coalesce(started_at, created_at))) * 1000)::bigint
                               )::integer
                               else duration_ms end,
           score        = greatest(coalesce(score, 0), ${score})
     where id = ${participantId}
    returning duration_ms
  `) as { duration_ms: number | null }[];
  return { durationMs: rows[0]?.duration_ms ?? null };
}

export type ParticipantRow = {
  rank: number | null;
  email: string;
  consent: boolean;
  score: number | null;
  total: number | null;
  duration_ms: number | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
};

/**
 * Backs the CSV export the organiser uses to actually send the rewards.
 *
 * Ordered by standing, not chronologically, because the rewards go to the top
 * three — so they are simply the first three rows. Ties on score break on the
 * faster time. Anyone who never finished has no score and sorts last with a
 * blank rank rather than being ranked joint-last among finishers.
 */
export async function listParticipants(): Promise<ParticipantRow[]> {
  await ensureSchema();
  const db = sql();
  return (await db`
    select case when completed_at is null then null
                else rank() over (
                  order by score desc nulls last,
                           duration_ms asc nulls last
                )
           end as rank,
           email, consent, score, total, duration_ms, attempts,
           created_at, completed_at
      from solo_participants
     order by completed_at is null,
              score desc nulls last,
              duration_ms asc nulls last,
              created_at asc
  `) as ParticipantRow[];
}

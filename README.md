# opsQRquiz

Two independent quizzes share this app.

### 1. Live multiplayer quiz (the original)

Kahoot-style, host-driven, three views:

- **Player** (`/`) — mobile-first, join by nickname, tap to answer.
- **Display** (`/display`) — the big-screen "cast" view: QR code in lobby, floating tilted names as players join, questions with countdown, correct-answer reveal, leaderboard.
- **Admin** (`/admin/<secret>`) — start the game, skip phases, reset.

Built on Next.js (App Router) + Socket.IO. State is in-memory; needs no database.

### 2. Solo email quiz (`/solo`)

Self-serve and self-paced, for collecting contacts:

1. Visitor enters their email and ticks a consent box.
2. The quiz starts immediately — same `questions.json`, no timer, answers changeable via "Zpět".
3. A thank-you screen shows their score.

Emails are stored in Postgres so rewards and follow-up can be sent. The two
quizzes share only `questions.json` and the colour palette — the solo quiz
never touches the live game's state, and the live game never needs the
database.

**The answer key never reaches the browser.** Questions are served stripped of
`correctIndex` (`lib/solo.ts`), the client posts back only which option it
picked, and grading happens server-side — scores here are tied to a person and
a reward, so they shouldn't be forgeable from devtools.

**The email is stored before the quiz starts**, not at the end. An address is
the thing that actually matters; capturing it up front means a later failure
(closed tab, dropped connection) costs a score rather than a participant.

#### Exporting the collected emails

```
/api/solo/export?secret=<ADMIN_SECRET>
```

Returns CSV: `email, consent, score, total, attempts, created_at, completed_at`.
One row per address — a repeat visitor bumps `attempts` and keeps their best
score rather than creating a duplicate.

## Local development

```bash
cp .env.example .env
# edit .env to set ADMIN_SECRET
npm install
npm run dev
```

Open:
- `http://localhost:3000/display` on the screen you'll cast
- `http://localhost:3000/admin/<ADMIN_SECRET>` on your phone/laptop to control
- Players scan the QR on the display

### Same-network play

For players on phones to scan the QR and reach your server, run on a network all devices share (LAN or hotspot). Find your local IP:

```bash
ipconfig getifaddr en0   # macOS
```

Then visit `http://<your-ip>:3000/display`. The QR will encode the host shown in the browser address bar, so opening `/display` via the LAN IP makes the QR work for phones on the same network.

## Configuring questions

Edit `questions.json` at the repo root. Each entry:

```json
{
  "text": "Question text?",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0
}
```

`correctIndex` is 0-3. Restart the server after editing.

## Environment variables

| Var | Purpose |
|-----|---------|
| `PORT` | HTTP port (default 3000) |
| `ADMIN_SECRET` | Secret path segment for the admin route (`/admin/<ADMIN_SECRET>`), and the `secret` query param for the solo CSV export |
| `DATABASE_URL` | Neon Postgres connection string. **Only the solo quiz uses this.** Without it `/solo` refuses to start a quiz (rather than silently dropping emails); the live multiplayer game is unaffected. |

### Setting up the database

The solo quiz needs a Postgres database. Any Postgres works, but the app ships
with Neon's serverless driver:

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string.
3. Set it as `DATABASE_URL` locally (`.env`) and in the Render dashboard.

The `solo_participants` table is created automatically on first use — there is
no migration step.

## Tuning

In `lib/game.ts`:

- `QUESTION_DURATION_MS` — time per question (default 10s)
- `REVEAL_DURATION_MS` — how long the correct answer is shown (default 4s)
- `LEADERBOARD_DURATION_MS` — leaderboard between questions (default 6s)
- `MAX_POINTS` / `MIN_POINTS_ON_CORRECT` — speed-based scoring bounds

## Deployment

Needs a host that supports persistent WebSocket connections. Vercel serverless does **not** suit this app — use one of:

- **Render** / **Railway** / **Fly.io** — set the start command to `npm run build && npm run start`, expose `PORT`, set `ADMIN_SECRET`.
- A small VM (Hetzner/DigitalOcean) with `pm2` or `systemd`.

Build step: `npm run build`. Start step: `npm run start`.

## Architecture notes

- `server.ts` — custom Node HTTP server that wraps Next.js's request handler and attaches a single Socket.IO server. Holds the single in-memory `GameEngine` instance.
- `lib/game.ts` — pure game state machine (phases: `lobby → question → reveal → leaderboard → … → ended`). Emits change events; the server broadcasts the public state on each change.
- All clients (player, display, admin) connect to the same Socket.IO endpoint and subscribe to `state` updates. Players additionally receive a private `self` payload.

State is in-memory only. Restarting the server clears the game.

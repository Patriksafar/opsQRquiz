# opsQRquiz

A Kahoot-style live quiz webapp with three views:

- **Player** (`/`) — mobile-first, join by nickname, tap to answer.
- **Display** (`/display`) — the big-screen "cast" view: QR code in lobby, floating tilted names as players join, questions with countdown, correct-answer reveal, leaderboard.
- **Admin** (`/admin/<secret>`) — start the game, skip phases, reset.

Built on Next.js (App Router) + Socket.IO for real-time sync.

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
| `ADMIN_SECRET` | Secret path segment for the admin route (`/admin/<ADMIN_SECRET>`) |

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

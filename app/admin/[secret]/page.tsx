"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/lib/use-socket";
import type { PublicState } from "@/lib/types";

export default function AdminPage() {
  const params = useParams<{ secret: string }>();
  const secret = params.secret;
  const socket = useSocket();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<PublicState | null>(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit("admin:auth", secret, (res) => setAuthed(res.ok));
    const onState = (s: PublicState) => setState(s);
    socket.on("state", onState);
    return () => {
      socket.off("state", onState);
    };
  }, [socket, secret]);

  if (authed === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-2xl text-rose-400 font-bold">Invalid admin URL</div>
      </main>
    );
  }

  if (!state || authed === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-white/60">Connecting…</div>
      </main>
    );
  }

  const start = () => socket?.emit("admin:start", secret);
  const next = () => socket?.emit("admin:next", secret);
  const reset = () => {
    if (confirm("Reset the game? All players will be removed.")) {
      socket?.emit("admin:reset", secret);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-2">Admin</h1>
        <p className="text-white/50 mb-8">Control the live quiz</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Stat label="Phase" value={state.phase} />
          <Stat label="Players" value={`${state.players.length}`} />
          <Stat label="Question" value={state.question ? `${state.question.index + 1} / ${state.question.total}` : "—"} />
          <Stat label="Top score" value={state.leaderboard[0] ? `${state.leaderboard[0].score}` : "—"} />
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {state.phase === "lobby" && (
            <button
              onClick={start}
              disabled={state.players.length === 0}
              className="px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl disabled:opacity-40 transition-colors"
            >
              Start game
            </button>
          )}
          {state.phase !== "lobby" && state.phase !== "ended" && (
            <button
              onClick={next}
              className="px-6 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl transition-colors"
            >
              Skip to next
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xl transition-colors ml-auto"
          >
            Reset game
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-white/80">Players ({state.players.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {state.players.map((p) => (
              <div
                key={p.id}
                className="bg-white/5 rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <span className="font-semibold">{p.nickname}</span>
                <span className="text-white/60 tabular-nums">{p.score}</span>
              </div>
            ))}
            {state.players.length === 0 && (
              <div className="text-white/40 col-span-full">No players yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4">
      <div className="text-white/50 text-sm uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

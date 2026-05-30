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
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-2xl text-rose-400 font-display font-black uppercase tracking-widest">
          Neplatná admin URL
        </div>
      </main>
    );
  }

  if (!state || authed === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-white/60">Připojuji…</div>
      </main>
    );
  }

  const start = () => socket?.emit("admin:start", secret);
  const next = () => socket?.emit("admin:next", secret);
  const reset = () => {
    if (confirm("Restartovat hru? Všichni hráči budou odstraněni.")) {
      socket?.emit("admin:reset", secret);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-black text-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-brand-yellow font-display font-black text-xs tracking-[0.3em] uppercase">
          US Launchpad · Admin
        </div>
        <h1 className="font-display font-black text-5xl uppercase mt-3 mb-1">
          Ovládání kvízu
        </h1>
        <p className="text-white/50 mb-8">Spusť hru, přeskoč fázi, restartuj.</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Stat label="Fáze" value={phaseLabel(state.phase)} />
          <Stat label="Hráči" value={`${state.players.length}`} />
          <Stat
            label="Otázka"
            value={
              state.question
                ? `${state.question.index + 1} / ${state.question.total}`
                : "—"
            }
          />
          <Stat
            label="Top skóre"
            value={state.leaderboard[0] ? `${state.leaderboard[0].score}` : "—"}
          />
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {state.phase === "lobby" && (
            <button
              onClick={start}
              disabled={state.players.length === 0}
              className="px-6 py-4 rounded-2xl bg-brand-yellow text-black font-display font-black text-xl uppercase tracking-wider disabled:opacity-30 active:scale-[0.98] transition-transform"
            >
              Spustit hru
            </button>
          )}
          {state.phase !== "lobby" && state.phase !== "ended" && (
            <button
              onClick={next}
              className="px-6 py-4 rounded-2xl bg-white text-black font-display font-black text-xl uppercase tracking-wider active:scale-[0.98] transition-transform"
            >
              Přeskočit
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-4 rounded-2xl bg-transparent border-2 border-rose-500 text-rose-400 hover:bg-rose-500 hover:text-white font-display font-black text-xl uppercase tracking-wider transition-colors ml-auto"
          >
            Restart
          </button>
        </div>

        <div>
          <h2 className="font-display font-black text-sm uppercase tracking-widest text-white/60 mb-3">
            Hráči ({state.players.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {state.players.map((p) => (
              <div
                key={p.id}
                className="bg-brand-smoke border border-brand-line rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <span className="font-semibold">{p.nickname}</span>
                <span className="text-brand-yellow font-display font-black tabular-nums">
                  {p.score}
                </span>
              </div>
            ))}
            {state.players.length === 0 && (
              <div className="text-white/40 col-span-full">Zatím žádní hráči.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-smoke border border-brand-line rounded-2xl p-4">
      <div className="text-white/50 text-xs uppercase tracking-widest font-display font-black">
        {label}
      </div>
      <div className="text-2xl font-display font-black mt-1 text-brand-yellow">
        {value}
      </div>
    </div>
  );
}

function phaseLabel(phase: PublicState["phase"]) {
  switch (phase) {
    case "lobby":
      return "Lobby";
    case "question":
      return "Otázka";
    case "reveal":
      return "Odhalení";
    case "leaderboard":
      return "Žebříček";
    case "ended":
      return "Konec";
  }
}

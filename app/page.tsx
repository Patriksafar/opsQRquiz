"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/lib/use-socket";
import type { PlayerSelfState, PublicState } from "@/lib/types";

const OPTION_STYLES = [
  { bg: "bg-quiz-red", label: "A", shape: "△" },
  { bg: "bg-quiz-blue", label: "B", shape: "◇" },
  { bg: "bg-quiz-yellow", label: "C", shape: "○" },
  { bg: "bg-quiz-green", label: "D", shape: "□" },
];

export default function PlayerPage() {
  const socket = useSocket();
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<PublicState | null>(null);
  const [self, setSelf] = useState<PlayerSelfState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!socket) return;
    const onState = (s: PublicState) => setState(s);
    const onSelf = (s: PlayerSelfState) => setSelf(s);
    socket.on("state", onState);
    socket.on("self", onSelf);
    return () => {
      socket.off("state", onState);
      socket.off("self", onSelf);
    };
  }, [socket]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const handleJoin = () => {
    if (!socket) return;
    const value = nickname.trim();
    if (!value) return;
    socket.emit("player:join", value, (res) => {
      if (res.ok) {
        setJoined(true);
        setJoinError(null);
      } else {
        setJoinError(res.error);
      }
    });
  };

  const handleAnswer = (idx: number) => {
    if (!socket) return;
    if (self?.hasAnsweredCurrent) return;
    socket.emit("player:answer", idx);
  };

  const secondsLeft = useMemo(() => {
    if (!state?.question) return 0;
    return Math.max(0, Math.ceil((state.question.endsAt - now) / 1000));
  }, [state, now]);

  const myRank = useMemo(() => {
    if (!self || !state) return null;
    const all = [...state.players].sort((a, b) => b.score - a.score);
    const idx = all.findIndex((p) => p.id === self.id);
    return idx === -1 ? null : idx + 1;
  }, [state, self]);

  if (!joined) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <h1 className="text-4xl font-extrabold mb-2 text-white">Join the Quiz</h1>
        <p className="text-white/70 mb-8 text-center">Pick a nickname to enter the game</p>
        <div className="w-full max-w-sm flex flex-col gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Your nickname"
            maxLength={20}
            autoFocus
            className="w-full bg-white/10 backdrop-blur rounded-2xl text-2xl text-white text-center placeholder-white/40 px-5 py-4 outline-none border-2 border-transparent focus:border-white/40"
          />
          <button
            onClick={handleJoin}
            disabled={!socket || nickname.trim().length === 0}
            className="w-full bg-white text-indigo-900 font-bold text-xl py-4 rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            Join
          </button>
          {joinError && (
            <div className="text-red-200 text-center font-medium">{joinError}</div>
          )}
        </div>
      </main>
    );
  }

  const phase = state?.phase ?? "lobby";

  if (phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-800 via-teal-900 to-cyan-900">
        <div className="text-white/60 uppercase tracking-widest text-sm">You're in</div>
        <div className="text-5xl font-extrabold mt-2 mb-8 text-white">{self?.nickname}</div>
        <div className="w-20 h-20 rounded-full border-4 border-white/30 border-t-white animate-spin mb-6" />
        <div className="text-white/80 text-xl">Waiting for the host to start…</div>
        <div className="mt-6 text-white/50">{state?.players.length ?? 0} player{(state?.players.length ?? 0) === 1 ? "" : "s"} in lobby</div>
      </main>
    );
  }

  if (phase === "question" && state?.question) {
    if (self?.hasAnsweredCurrent) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-900 to-purple-900">
          <div className="text-white/60 uppercase tracking-widest text-sm">Answer locked in</div>
          <div className="text-5xl font-extrabold mt-2 mb-6 text-white">Nice!</div>
          <div className="text-white/70 text-xl">Hang tight for the reveal…</div>
          <div className="mt-8 text-7xl font-mono text-white/90">{secondsLeft}</div>
        </main>
      );
    }
    return (
      <main className="min-h-screen flex flex-col p-3 bg-slate-950">
        <div className="flex justify-between items-center mb-3 px-2">
          <div className="text-white/60 text-sm">Q{state.question.index + 1}/{state.question.total}</div>
          <div className="text-3xl font-mono text-white">{secondsLeft}</div>
        </div>
        <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1">
          {OPTION_STYLES.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className={`${opt.bg} rounded-3xl flex items-center justify-center text-white font-extrabold text-7xl active:scale-95 transition-transform shadow-lg`}
            >
              {opt.shape}
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (phase === "reveal") {
    const correct = self?.lastAnswerCorrect;
    const points = self?.lastAnswerPoints ?? 0;
    return (
      <main className={`min-h-screen flex flex-col items-center justify-center p-6 ${correct ? "bg-gradient-to-br from-green-600 to-emerald-800" : "bg-gradient-to-br from-rose-700 to-red-900"}`}>
        <div className="text-white/80 uppercase tracking-widest text-sm">{correct ? "Correct!" : "Wrong"}</div>
        <div className="text-7xl font-extrabold my-4 text-white">{correct ? "🎉" : "💥"}</div>
        {correct ? (
          <div className="text-3xl font-bold text-white">+{points} pts</div>
        ) : (
          <div className="text-2xl text-white/80">No points this round</div>
        )}
        <div className="mt-10 text-white/70">Total: <span className="font-bold text-white">{self?.score ?? 0}</span></div>
      </main>
    );
  }

  if (phase === "leaderboard") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 to-indigo-950">
        <div className="text-white/60 uppercase tracking-widest text-sm">Standings</div>
        <div className="text-7xl font-extrabold my-4 text-white">{self?.score ?? 0}</div>
        <div className="text-white/70 text-xl">points</div>
        {myRank && (
          <div className="mt-6 text-white/80">Rank: <span className="font-bold text-white text-2xl">#{myRank}</span></div>
        )}
      </main>
    );
  }

  if (phase === "ended") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-700 via-orange-800 to-rose-900">
        <div className="text-white/70 uppercase tracking-widest text-sm">Game over</div>
        <div className="text-6xl font-extrabold my-4 text-white">{self?.score ?? 0}</div>
        <div className="text-white/80">final score</div>
        {myRank && (
          <div className="mt-6 text-2xl text-white">
            You finished <span className="font-extrabold">#{myRank}</span>
          </div>
        )}
      </main>
    );
  }

  return null;
}

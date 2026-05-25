"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useSocket } from "@/lib/use-socket";
import type { PublicState } from "@/lib/types";

const OPTION_STYLES = [
  { bg: "bg-quiz-red", label: "A", shape: "△" },
  { bg: "bg-quiz-blue", label: "B", shape: "◇" },
  { bg: "bg-quiz-yellow", label: "C", shape: "○" },
  { bg: "bg-quiz-green", label: "D", shape: "□" },
];

export default function DisplayPage() {
  const socket = useSocket();
  const [state, setState] = useState<PublicState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = `${window.location.protocol}//${window.location.host}/`;
      setJoinUrl(url);
      QRCode.toString(url, { type: "svg", margin: 1, width: 480, color: { dark: "#0b0f1a", light: "#ffffff" } })
        .then(setQrSvg)
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onState = (s: PublicState) => setState(s);
    socket.on("state", onState);
    return () => {
      socket.off("state", onState);
    };
  }, [socket]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!state?.question) return 0;
    return Math.max(0, Math.ceil((state.question.endsAt - now) / 1000));
  }, [state, now]);

  const phase = state?.phase ?? "lobby";

  if (phase === "lobby") {
    return <Lobby state={state} joinUrl={joinUrl} qrSvg={qrSvg} />;
  }
  if (phase === "question" && state?.question) {
    return <QuestionView state={state} secondsLeft={secondsLeft} />;
  }
  if (phase === "reveal" && state?.reveal) {
    return <RevealView state={state} />;
  }
  if (phase === "leaderboard") {
    return <Leaderboard state={state!} title="Leaderboard" />;
  }
  if (phase === "ended") {
    return <Leaderboard state={state!} title="Final Results" final />;
  }
  return null;
}

function Lobby({ state, joinUrl, qrSvg }: { state: PublicState | null; joinUrl: string; qrSvg: string }) {
  const players = state?.players ?? [];
  return (
    <main className="min-h-screen p-10 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white overflow-hidden relative">
      <div className="absolute top-8 left-10 right-10 flex justify-between items-baseline">
        <h1 className="text-5xl font-extrabold tracking-tight">Live Quiz</h1>
        <div className="text-2xl text-white/60">
          {players.length} player{players.length === 1 ? "" : "s"} joined
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          {qrSvg ? (
            <div className="w-[480px] h-[480px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div className="w-[480px] h-[480px] bg-slate-200 animate-pulse rounded-2xl" />
          )}
          <div className="mt-4 text-center text-slate-900 text-2xl font-bold">{joinUrl}</div>
          <div className="text-center text-slate-500">Scan to join</div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {players.map((p, i) => (
          <FloatingName key={p.id} name={p.nickname} angle={p.angle} index={i} total={players.length} />
        ))}
      </div>
    </main>
  );
}

function FloatingName({ name, angle, index, total }: { name: string; angle: number; index: number; total: number }) {
  const positions = useMemo(() => placeAround(index, total), [index, total]);
  const colors = ["bg-quiz-red", "bg-quiz-blue", "bg-quiz-yellow", "bg-quiz-green", "bg-fuchsia-600", "bg-orange-500", "bg-teal-500", "bg-rose-500"];
  const color = colors[index % colors.length];
  return (
    <div
      className="absolute animate-fade-in"
      style={{
        left: `${positions.x}%`,
        top: `${positions.y}%`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      }}
    >
      <div className={`${color} px-6 py-3 rounded-2xl text-white text-3xl font-extrabold shadow-2xl border-4 border-white/20`}>
        {name}
      </div>
    </div>
  );
}

function placeAround(index: number, _total: number) {
  const slots = [
    { x: 12, y: 22 }, { x: 88, y: 22 }, { x: 12, y: 78 }, { x: 88, y: 78 },
    { x: 22, y: 50 }, { x: 78, y: 50 }, { x: 32, y: 18 }, { x: 68, y: 18 },
    { x: 32, y: 82 }, { x: 68, y: 82 }, { x: 8, y: 50 }, { x: 92, y: 50 },
    { x: 18, y: 35 }, { x: 82, y: 35 }, { x: 18, y: 65 }, { x: 82, y: 65 },
    { x: 28, y: 30 }, { x: 72, y: 30 }, { x: 28, y: 70 }, { x: 72, y: 70 },
  ];
  return slots[index % slots.length];
}

function QuestionView({ state, secondsLeft }: { state: PublicState; secondsLeft: number }) {
  const q = state.question!;
  const pct = (secondsLeft / 10) * 100;
  const answered = state.players.length > 0 ? null : null;
  return (
    <main className="min-h-screen p-10 bg-slate-950 text-white flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="text-2xl text-white/60 font-bold">Question {q.index + 1} / {q.total}</div>
        <div className="flex items-center gap-4">
          <div className="text-9xl font-black tabular-nums">{secondsLeft}</div>
        </div>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="bg-white/5 rounded-3xl p-12 mb-8 text-center">
        <div className="text-6xl font-extrabold leading-tight">{q.text}</div>
      </div>
      <div className="grid grid-cols-2 gap-6 flex-1">
        {OPTION_STYLES.map((opt, i) => (
          <div
            key={i}
            className={`${opt.bg} rounded-3xl flex items-center gap-6 p-8 shadow-lg`}
          >
            <div className="text-6xl">{opt.shape}</div>
            <div className="text-4xl font-bold flex-1">{q.options[i]}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

function RevealView({ state }: { state: PublicState }) {
  const reveal = state.reveal!;
  const total = reveal.perOption.reduce((a, b) => a + b, 0) || 1;
  return (
    <main className="min-h-screen p-10 bg-slate-950 text-white flex flex-col">
      <div className="text-4xl font-extrabold text-center mb-8">Correct answer</div>
      <div className="grid grid-cols-2 gap-6 flex-1">
        {OPTION_STYLES.map((opt, i) => {
          const isCorrect = i === reveal.correctIndex;
          const count = reveal.perOption[i] ?? 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div
              key={i}
              className={`${opt.bg} rounded-3xl flex flex-col p-8 shadow-lg transition-all ${isCorrect ? "ring-8 ring-white scale-105" : "opacity-50"}`}
            >
              <div className="flex items-center gap-6 mb-4">
                <div className="text-6xl">{opt.shape}</div>
                <div className="text-4xl font-bold flex-1">{state.question?.options[i] ?? ""}</div>
                {isCorrect && <div className="text-5xl">✓</div>}
              </div>
              <div className="mt-auto">
                <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white/90" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 text-white/90 font-semibold">{count} answer{count === 1 ? "" : "s"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Leaderboard({ state, title, final = false }: { state: PublicState; title: string; final?: boolean }) {
  const top = state.leaderboard;
  const winner = final && top.length > 0 ? top[0] : null;
  return (
    <main className="min-h-screen p-10 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white flex flex-col">
      <div className="text-center mb-8">
        <div className="text-5xl font-extrabold tracking-tight">{title}</div>
        {winner && (
          <div className="mt-4 text-3xl text-amber-300">
            🏆 Winner: <span className="font-extrabold">{winner.nickname}</span> · {winner.score} pts
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-4xl mx-auto w-full">
        {top.map((entry) => {
          const isTop3 = entry.rank <= 3;
          const colors: Record<number, string> = {
            1: "from-amber-400 to-yellow-600 text-slate-900",
            2: "from-slate-200 to-slate-400 text-slate-900",
            3: "from-orange-400 to-amber-700 text-white",
          };
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-6 p-5 rounded-2xl shadow-lg ${
                isTop3
                  ? `bg-gradient-to-r ${colors[entry.rank]} scale-105 text-3xl`
                  : "bg-white/5 text-xl"
              }`}
            >
              <div className={`${isTop3 ? "text-5xl" : "text-3xl"} font-black w-16 text-center`}>
                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
              </div>
              <div className="flex-1 font-extrabold">{entry.nickname}</div>
              <div className="font-black tabular-nums">{entry.score}</div>
            </div>
          );
        })}
        {top.length === 0 && (
          <div className="text-center text-white/60 text-xl">No players yet.</div>
        )}
      </div>
    </main>
  );
}

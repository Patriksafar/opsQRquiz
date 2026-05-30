"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useSocket } from "@/lib/use-socket";
import type { PublicState } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

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
      QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 360,
        color: { dark: "#000000", light: "#ffed00" },
      })
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
  if (phase === "reveal" && state?.reveal && state.question) {
    return <RevealView state={state} />;
  }
  if (phase === "leaderboard") {
    return <Leaderboard state={state!} title="Žebříček" />;
  }
  if (phase === "ended") {
    return <Leaderboard state={state!} title="Finální výsledky" final />;
  }
  return null;
}

function BrandStripe() {
  return (
    <div className="absolute top-0 left-0 right-0 bg-brand-yellow text-black px-10 py-3 flex items-center justify-between text-sm font-display font-black uppercase tracking-[0.3em]">
      <span>US Launchpad</span>
      <span>Live Quiz</span>
    </div>
  );
}

function Lobby({
  state,
  joinUrl,
  qrSvg,
}: {
  state: PublicState | null;
  joinUrl: string;
  qrSvg: string;
}) {
  const players = state?.players ?? [];
  return (
    <main className="min-h-svh bg-black text-white overflow-hidden relative">
      <BrandStripe />

      {/* Main 3-column grid: headline | QR | counter */}
      <div className="pt-20 px-10 min-h-svh flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-10 items-center flex-1 pb-[35vh]">
          <div className="z-10">
            <div className="font-display font-black text-brand-yellow text-6xl uppercase leading-[0.9]">
              Připoj se
            </div>
            <div className="font-display font-black text-6xl uppercase leading-[0.9] mt-2">
              do <span className="text-brand-yellow">kvízu</span>
            </div>
            <div className="text-white/60 mt-5 text-lg max-w-sm">
              Naskenuj QR kód mobilem a&nbsp;zadej přezdívku.
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-brand-yellow rounded-3xl p-5 shadow-2xl border-4 border-black">
              {qrSvg ? (
                <div
                  className="w-[360px] h-[360px]"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="w-[360px] h-[360px] bg-black/10 animate-pulse rounded-2xl" />
              )}
              <div className="mt-3 text-center text-black font-display font-black text-lg">
                {joinUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </div>
              <div className="text-center text-black/70 font-semibold uppercase text-[10px] tracking-widest mt-0.5">
                Sken pro připojení
              </div>
            </div>
          </div>

          <div className="text-right z-10">
            <div className="text-white/40 text-sm uppercase tracking-widest">Hráčů</div>
            <div className="font-display font-black text-brand-yellow text-7xl tabular-nums leading-none">
              {players.length}
            </div>
          </div>
        </div>
      </div>

      {/* Floating names — constrained to bottom band so they never overlap headline/QR/counter */}
      <div className="absolute inset-0 pointer-events-none">
        {players.map((p, i) => (
          <FloatingName key={p.id} name={p.nickname} angle={p.angle} index={i} />
        ))}
      </div>
    </main>
  );
}

function FloatingName({
  name,
  angle,
  index,
}: {
  name: string;
  angle: number;
  index: number;
}) {
  const pos = useMemo(() => placeAround(index), [index]);
  // Alternate yellow chip / black chip with yellow border for variety
  const variant = index % 2 === 0;
  return (
    // Outer: positioning only (centered at coords). Animation here would conflict with translate.
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Inner: rotation + opacity fade-in. Animation only touches opacity, so the rotation sticks. */}
      <div className="animate-fade-in" style={{ transform: `rotate(${angle}deg)` }}>
        <div
          className={`px-5 py-2.5 rounded-2xl font-display font-black text-2xl uppercase shadow-2xl whitespace-nowrap
            ${
              variant
                ? "bg-brand-yellow text-black"
                : "bg-black text-brand-yellow border-4 border-brand-yellow"
            }`}
        >
          {name}
        </div>
      </div>
    </div>
  );
}

// Safe zone: bottom 30% of the screen, distributed horizontally.
// Never overlaps the headline (top-left), QR (center), or counter (top-right).
function placeAround(index: number) {
  const slots = [
    { x: 12, y: 78 }, { x: 30, y: 84 }, { x: 50, y: 79 }, { x: 70, y: 84 }, { x: 88, y: 78 },
    { x: 20, y: 92 }, { x: 40, y: 90 }, { x: 60, y: 90 }, { x: 80, y: 92 },
    { x: 8, y: 86 }, { x: 92, y: 86 }, { x: 25, y: 75 }, { x: 75, y: 75 },
    { x: 15, y: 82 }, { x: 85, y: 82 }, { x: 35, y: 88 }, { x: 65, y: 88 },
    { x: 45, y: 95 }, { x: 55, y: 95 }, { x: 5, y: 78 },
  ];
  return slots[index % slots.length];
}

function QuestionView({
  state,
  secondsLeft,
}: {
  state: PublicState;
  secondsLeft: number;
}) {
  const q = state.question!;
  const pct = (secondsLeft / 10) * 100;
  return (
    <main className="min-h-screen p-10 pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="flex justify-between items-center mb-6 mt-4">
        <div className="font-display font-black text-brand-yellow uppercase tracking-widest text-xl">
          Otázka {q.index + 1} / {q.total}
        </div>
        <div
          className={`font-display font-black text-[9rem] leading-none tabular-nums ${
            secondsLeft <= 3 ? "text-rose-400" : "text-brand-yellow"
          }`}
        >
          {secondsLeft}
        </div>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-brand-yellow transition-all duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="bg-brand-yellow text-black rounded-3xl p-12 mb-8 text-center">
        <div className="font-display font-black text-5xl leading-tight text-balance">
          {q.text}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 flex-1">
        {q.options.map((opt, i) => (
          <div
            key={i}
            className="bg-brand-smoke border-2 border-brand-line rounded-2xl flex items-center gap-6 p-6"
          >
            <div className="shrink-0 w-16 h-16 rounded-xl bg-brand-yellow text-black font-display font-black text-3xl flex items-center justify-center">
              {OPTION_LETTERS[i]}
            </div>
            <div className="text-3xl font-semibold flex-1">{opt}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

function RevealView({ state }: { state: PublicState }) {
  const reveal = state.reveal!;
  const q = state.question!;
  const total = reveal.perOption.reduce((a, b) => a + b, 0) || 1;
  return (
    <main className="min-h-screen p-10 pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="font-display font-black text-brand-yellow text-5xl uppercase text-center mb-8 mt-2">
        Správná odpověď
      </div>
      <div className="grid grid-cols-1 gap-4 flex-1">
        {q.options.map((opt, i) => {
          const isCorrect = i === reveal.correctIndex;
          const count = reveal.perOption[i] ?? 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div
              key={i}
              className={`rounded-2xl flex flex-col p-6 transition-all
                ${
                  isCorrect
                    ? "bg-brand-yellow text-black ring-4 ring-white scale-[1.02]"
                    : "bg-brand-smoke text-white/40 border-2 border-brand-line"
                }`}
            >
              <div className="flex items-center gap-6 mb-3">
                <div
                  className={`shrink-0 w-16 h-16 rounded-xl font-display font-black text-3xl flex items-center justify-center
                    ${isCorrect ? "bg-black text-brand-yellow" : "bg-brand-line text-white/40"}`}
                >
                  {OPTION_LETTERS[i]}
                </div>
                <div className="text-3xl font-semibold flex-1">{opt}</div>
                {isCorrect && <div className="text-5xl">✓</div>}
              </div>
              <div className="mt-auto pl-22">
                <div className="h-3 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isCorrect ? "bg-black" : "bg-white/30"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className={`mt-2 font-semibold ${
                    isCorrect ? "text-black/80" : "text-white/40"
                  }`}
                >
                  {count} {pluralize(count, "odpověď", "odpovědi", "odpovědí")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Leaderboard({
  state,
  title,
  final = false,
}: {
  state: PublicState;
  title: string;
  final?: boolean;
}) {
  const top = state.leaderboard;
  const winner = final && top.length > 0 ? top[0] : null;
  return (
    <main className="min-h-screen p-10 pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="text-center mb-8 mt-2">
        <div className="font-display font-black text-brand-yellow text-6xl uppercase">
          {title}
        </div>
        {winner && (
          <div className="mt-6 text-3xl text-white/80">
            🏆 Vítěz:{" "}
            <span className="font-display font-black text-brand-yellow">
              {winner.nickname}
            </span>{" "}
            · {winner.score} bodů
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-5xl mx-auto w-full">
        {top.map((entry) => {
          const isTop3 = entry.rank <= 3;
          const medal =
            entry.rank === 1
              ? "🥇"
              : entry.rank === 2
              ? "🥈"
              : entry.rank === 3
              ? "🥉"
              : `#${entry.rank}`;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-6 p-5 rounded-2xl shadow-lg
                ${
                  entry.rank === 1
                    ? "bg-brand-yellow text-black scale-[1.05] text-4xl"
                    : isTop3
                    ? "bg-white text-black scale-[1.02] text-3xl"
                    : "bg-brand-smoke border-2 border-brand-line text-xl"
                }`}
            >
              <div
                className={`${
                  isTop3 ? "text-5xl" : "text-3xl"
                } font-display font-black w-20 text-center`}
              >
                {medal}
              </div>
              <div className="flex-1 font-display font-black uppercase tracking-tight">
                {entry.nickname}
              </div>
              <div className="font-display font-black tabular-nums">{entry.score}</div>
            </div>
          );
        })}
        {top.length === 0 && (
          <div className="text-center text-white/40 text-xl">Zatím žádní hráči.</div>
        )}
      </div>
    </main>
  );
}

function pluralize(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

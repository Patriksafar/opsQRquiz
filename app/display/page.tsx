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
      // Render the QR at a high resolution; CSS sizing makes it responsive.
      QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 480,
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
    <div className="absolute top-0 left-0 right-0 bg-brand-yellow text-black px-4 py-2 md:px-10 md:py-3 flex items-center justify-between text-[10px] md:text-sm font-display font-black uppercase tracking-[0.25em] md:tracking-[0.3em] z-20">
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
    <main className="min-h-svh bg-black text-white overflow-hidden relative flex flex-col">
      <BrandStripe />

      {/* Content: stacked on mobile, 3-col grid on md+ */}
      <div className="flex-1 pt-12 md:pt-20 px-4 md:px-10 pb-4 md:pb-0 flex flex-col gap-6 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-10 md:items-center md:pb-[35vh]">
        {/* Headline */}
        <div className="z-10 text-center md:text-left">
          <div className="font-display font-black text-brand-yellow text-4xl md:text-6xl uppercase leading-[0.95] md:leading-[0.9]">
            Připoj se
          </div>
          <div className="font-display font-black text-4xl md:text-6xl uppercase leading-[0.95] md:leading-[0.9] mt-1 md:mt-2">
            do <span className="text-brand-yellow">kvízu</span>
          </div>
          <div className="text-white/60 mt-3 md:mt-5 text-sm md:text-lg max-w-sm mx-auto md:mx-0">
            Naskenuj QR kód mobilem a&nbsp;zadej přezdívku.
          </div>
        </div>

        {/* QR */}
        <div className="flex justify-center">
          <div className="bg-brand-yellow rounded-3xl p-3 md:p-5 shadow-2xl border-4 border-black">
            {qrSvg ? (
              <div
                className="w-[230px] h-[230px] md:w-[360px] md:h-[360px] [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-[230px] h-[230px] md:w-[360px] md:h-[360px] bg-black/10 animate-pulse rounded-2xl" />
            )}
            <div className="mt-2 md:mt-3 text-center text-black font-display font-black text-sm md:text-lg break-all">
              {joinUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </div>
            <div className="text-center text-black/70 font-semibold uppercase text-[9px] md:text-[10px] tracking-widest mt-0.5">
              Sken pro připojení
            </div>
          </div>
        </div>

        {/* Counter */}
        <div className="text-center md:text-right z-10">
          <div className="text-white/40 text-xs md:text-sm uppercase tracking-widest">
            Hráčů
          </div>
          <div className="font-display font-black text-brand-yellow text-5xl md:text-7xl tabular-nums leading-none">
            {players.length}
          </div>
        </div>
      </div>

      {/* Names — desktop: floating absolutely positioned chips at the bottom */}
      <div className="hidden md:block absolute inset-0 pointer-events-none">
        {players.map((p, i) => (
          <FloatingName key={p.id} name={p.nickname} angle={p.angle} index={i} />
        ))}
      </div>

      {/* Names — mobile: wrapped chip list at the bottom (no overlap risk) */}
      <div className="md:hidden px-4 pb-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {players.map((p, i) => {
            const variant = i % 2 === 0;
            return (
              <div key={p.id} className="animate-fade-in" style={{ transform: `rotate(${p.angle * 0.4}deg)` }}>
                <div
                  className={`px-3 py-1.5 rounded-xl font-display font-black text-sm uppercase shadow-lg whitespace-nowrap
                    ${
                      variant
                        ? "bg-brand-yellow text-black"
                        : "bg-black text-brand-yellow border-2 border-brand-yellow"
                    }`}
                >
                  {p.nickname}
                </div>
              </div>
            );
          })}
        </div>
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
  const variant = index % 2 === 0;
  return (
    <div
      className="absolute"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
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
    <main className="min-h-svh p-4 pt-12 md:p-10 md:pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="flex justify-between items-center mb-3 md:mb-6 mt-2 md:mt-4">
        <div className="font-display font-black text-brand-yellow uppercase tracking-widest text-xs md:text-xl">
          Otázka {q.index + 1} / {q.total}
        </div>
        <div
          className={`font-display font-black text-6xl md:text-[9rem] leading-none tabular-nums ${
            secondsLeft <= 3 ? "text-rose-400" : "text-brand-yellow"
          }`}
        >
          {secondsLeft}
        </div>
      </div>
      <div className="h-2 md:h-3 bg-white/10 rounded-full overflow-hidden mb-4 md:mb-8">
        <div
          className="h-full bg-brand-yellow transition-all duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="bg-brand-yellow text-black rounded-2xl md:rounded-3xl p-5 md:p-12 mb-4 md:mb-8 text-center">
        <div className="font-display font-black text-xl md:text-5xl leading-tight md:leading-tight text-balance">
          {q.text}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 md:gap-4 flex-1">
        {q.options.map((opt, i) => (
          <div
            key={i}
            className="bg-brand-smoke border-2 border-brand-line rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-6 p-3 md:p-6"
          >
            <div className="shrink-0 w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-brand-yellow text-black font-display font-black text-lg md:text-3xl flex items-center justify-center">
              {OPTION_LETTERS[i]}
            </div>
            <div className="text-base md:text-3xl font-semibold flex-1 leading-snug">
              {opt}
            </div>
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
    <main className="min-h-svh p-4 pt-12 md:p-10 md:pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="font-display font-black text-brand-yellow text-2xl md:text-5xl uppercase text-center mb-4 md:mb-8 mt-2">
        Správná odpověď
      </div>
      <div className="grid grid-cols-1 gap-2 md:gap-4 flex-1">
        {q.options.map((opt, i) => {
          const isCorrect = i === reveal.correctIndex;
          const count = reveal.perOption[i] ?? 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div
              key={i}
              className={`rounded-xl md:rounded-2xl flex flex-col p-3 md:p-6 transition-all
                ${
                  isCorrect
                    ? "bg-brand-yellow text-black ring-2 md:ring-4 ring-white scale-[1.02]"
                    : "bg-brand-smoke text-white/40 border-2 border-brand-line"
                }`}
            >
              <div className="flex items-center gap-3 md:gap-6 mb-2 md:mb-3">
                <div
                  className={`shrink-0 w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl font-display font-black text-lg md:text-3xl flex items-center justify-center
                    ${isCorrect ? "bg-black text-brand-yellow" : "bg-brand-line text-white/40"}`}
                >
                  {OPTION_LETTERS[i]}
                </div>
                <div className="text-base md:text-3xl font-semibold flex-1 leading-snug">
                  {opt}
                </div>
                {isCorrect && <div className="text-2xl md:text-5xl">✓</div>}
              </div>
              <div className="mt-auto">
                <div className="h-2 md:h-3 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isCorrect ? "bg-black" : "bg-white/30"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className={`mt-1 md:mt-2 text-xs md:text-base font-semibold ${
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
    <main className="min-h-svh p-4 pt-12 md:p-10 md:pt-20 bg-black text-white flex flex-col relative">
      <BrandStripe />
      <div className="text-center mb-4 md:mb-8 mt-2">
        <div className="font-display font-black text-brand-yellow text-3xl md:text-6xl uppercase">
          {title}
        </div>
        {winner && (
          <div className="mt-3 md:mt-6 text-base md:text-3xl text-white/80">
            🏆 Vítěz:{" "}
            <span className="font-display font-black text-brand-yellow">
              {winner.nickname}
            </span>{" "}
            · {winner.score} bodů
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:gap-3 max-w-5xl mx-auto w-full">
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
              className={`flex items-center gap-3 md:gap-6 p-3 md:p-5 rounded-xl md:rounded-2xl shadow-lg
                ${
                  entry.rank === 1
                    ? "bg-brand-yellow text-black scale-[1.03] md:scale-[1.05] text-lg md:text-4xl"
                    : isTop3
                    ? "bg-white text-black scale-[1.01] md:scale-[1.02] text-base md:text-3xl"
                    : "bg-brand-smoke border-2 border-brand-line text-sm md:text-xl"
                }`}
            >
              <div
                className={`${
                  isTop3 ? "text-2xl md:text-5xl" : "text-lg md:text-3xl"
                } font-display font-black w-10 md:w-20 text-center`}
              >
                {medal}
              </div>
              <div className="flex-1 font-display font-black uppercase tracking-tight truncate">
                {entry.nickname}
              </div>
              <div className="font-display font-black tabular-nums">{entry.score}</div>
            </div>
          );
        })}
        {top.length === 0 && (
          <div className="text-center text-white/40 text-base md:text-xl">
            Zatím žádní hráči.
          </div>
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

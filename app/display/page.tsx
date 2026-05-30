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
        width: 520,
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
    <main className="min-h-screen p-10 pt-20 bg-black text-white overflow-hidden relative">
      <BrandStripe />

      <div className="absolute top-24 left-10 right-10 flex justify-between items-start z-10">
        <div>
          <div className="font-display font-black text-brand-yellow text-7xl uppercase leading-[0.9]">
            Připoj se
          </div>
          <div className="font-display font-black text-7xl uppercase leading-[0.9] mt-2">
            do <span className="text-brand-yellow">kvízu</span>
          </div>
          <div className="text-white/60 mt-6 text-2xl max-w-md">
            Naskenuj QR kód mobilem a zadej přezdívku.
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/40 text-sm uppercase tracking-widest">Hráčů</div>
          <div className="font-display font-black text-brand-yellow text-8xl tabular-nums leading-none">
            {players.length}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-brand-yellow rounded-3xl p-6 shadow-2xl border-8 border-black ring-4 ring-brand-yellow">
          {qrSvg ? (
            <div
              className="w-[520px] h-[520px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="w-[520px] h-[520px] bg-black/10 animate-pulse rounded-2xl" />
          )}
          <div className="mt-5 text-center text-black font-display font-black text-2xl">
            {joinUrl.replace(/^https?:\/\//, "")}
          </div>
          <div className="text-center text-black/70 font-semibold uppercase text-xs tracking-widest mt-1">
            Sken pro připojení
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {players.map((p, i) => (
          <FloatingName
            key={p.id}
            name={p.nickname}
            angle={p.angle}
            index={i}
            total={players.length}
          />
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
  total: number;
}) {
  const pos = useMemo(() => placeAround(index), [index]);
  // Alternate yellow chip / black chip with yellow border for variety
  const variant = index % 2 === 0;
  return (
    <div
      className="absolute animate-fade-in"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      }}
    >
      <div
        className={`px-6 py-3 rounded-2xl font-display font-black text-3xl uppercase shadow-2xl
          ${
            variant
              ? "bg-brand-yellow text-black"
              : "bg-black text-brand-yellow border-4 border-brand-yellow"
          }`}
      >
        {name}
      </div>
    </div>
  );
}

function placeAround(index: number) {
  const slots = [
    { x: 10, y: 28 }, { x: 90, y: 28 }, { x: 10, y: 72 }, { x: 90, y: 72 },
    { x: 18, y: 50 }, { x: 82, y: 50 }, { x: 30, y: 20 }, { x: 70, y: 20 },
    { x: 30, y: 80 }, { x: 70, y: 80 }, { x: 6, y: 50 }, { x: 94, y: 50 },
    { x: 14, y: 38 }, { x: 86, y: 38 }, { x: 14, y: 62 }, { x: 86, y: 62 },
    { x: 26, y: 32 }, { x: 74, y: 32 }, { x: 26, y: 68 }, { x: 74, y: 68 },
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

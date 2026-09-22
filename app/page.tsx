"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/lib/use-socket";
import type { PlayerSelfState, PublicState } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const QUERY_KEY = "p";

function readSavedId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(QUERY_KEY);
}

function saveIdToUrl(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_KEY, id);
  window.history.replaceState(null, "", url.toString());
}

function clearIdFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(QUERY_KEY);
  window.history.replaceState(null, "", url.toString());
}

export default function PlayerPage() {
  const socket = useSocket();
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  // `bootstrapped` flips true after we've resolved the auto-rejoin probe.
  // Until then we show a tiny spinner instead of flashing the join form.
  const [bootstrapped, setBootstrapped] = useState(false);
  const [state, setState] = useState<PublicState | null>(null);
  const [self, setSelf] = useState<PlayerSelfState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Try to rejoin once the socket is up.
  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    const saved = readSavedId();
    if (!saved) {
      setBootstrapped(true);
      return;
    }
    socket.emit("player:rejoin", saved, (res) => {
      if (cancelled) return;
      if (res.ok) {
        setJoined(true);
      } else {
        // Server doesn't know this id (restart, reset, or stale id) — drop it.
        clearIdFromUrl();
      }
      setBootstrapped(true);
    });
    return () => {
      cancelled = true;
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onState = (s: PublicState) => {
      setState((prev) => {
        if (prev?.question?.index !== s.question?.index) setSelected(null);
        return s;
      });
    };
    const onSelf = (s: PlayerSelfState) => setSelf(s);
    socket.on("state", onState);
    socket.on("self", onSelf);
    return () => {
      socket.off("state", onState);
      socket.off("self", onSelf);
    };
  }, [socket]);

  // If the admin resets the game, the server stops knowing about us — drop the URL id.
  useEffect(() => {
    if (!joined || !state || !self) return;
    if (state.phase === "lobby" && !state.players.some((p) => p.id === self.id)) {
      clearIdFromUrl();
      setJoined(false);
      setSelf(null);
    }
  }, [state, self, joined]);

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
        saveIdToUrl(res.id);
        setJoined(true);
        setJoinError(null);
      } else {
        setJoinError(res.error);
      }
    });
  };

  const handleAnswer = (idx: number) => {
    if (!socket) return;
    // Answers stay changeable until the timer runs out.
    if (!state?.question || secondsLeft <= 0) return;
    if (selected === idx) return;
    setSelected(idx);
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

  // Avoid flashing the join form while we wait for the rejoin probe to resolve.
  if (!bootstrapped) {
    return (
      <main className="min-h-svh flex items-center justify-center text-foreground">
        <div className="w-10 h-10 rounded-full border-4 border-line-canvas border-t-brand animate-spin" />
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="min-h-svh flex flex-col text-foreground px-6 pt-8 pb-6">
        <div>
          <div className="font-display font-black text-xs tracking-[0.3em] uppercase">
            US Launchpad
          </div>
          <h1 className="font-display font-black text-4xl uppercase leading-[0.95] mt-3 text-balance">
            Pojď do <span className="bg-brand text-brand-foreground px-2 inline-block">kvízu</span>
          </h1>
          <p className="mt-2 text-foreground-subtle text-sm">Zadej přezdívku a počkej na start.</p>
        </div>
        <div className="flex flex-col gap-3 pt-6">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Tvoje přezdívka"
            maxLength={20}
            autoFocus
            className="w-full bg-card border-2 border-card-border rounded-2xl text-2xl text-card-foreground text-center placeholder-card-foreground-subtle/70 px-5 py-4 outline-none focus:border-brand font-semibold"
          />
          <button
            onClick={handleJoin}
            disabled={!socket || nickname.trim().length === 0}
            className="w-full bg-brand text-brand-foreground font-display font-black text-2xl uppercase tracking-wider py-4 rounded-2xl disabled:opacity-30 active:scale-[0.98] transition-transform"
          >
            Připojit se
          </button>
          {joinError && (
            <div className="text-destructive text-center font-semibold mt-1">{joinError}</div>
          )}
        </div>
      </main>
    );
  }

  const phase = state?.phase ?? "lobby";

  if (phase === "lobby") {
    return (
      <main className="min-h-svh flex flex-col items-center justify-center p-6 text-foreground">
        <div className="font-display font-black text-xs tracking-[0.3em] uppercase text-brand">
          Jsi ve hře
        </div>
        <div className="font-display font-black text-5xl mt-3 mb-10 text-balance text-center">
          {self?.nickname}
        </div>
        <div className="w-16 h-16 rounded-full border-4 border-line-canvas border-t-brand animate-spin mb-6" />
        <div className="text-foreground-muted text-xl">Čekáme na start…</div>
        <div className="mt-4 text-foreground-subtle text-sm">
          {state?.players.length ?? 0}{" "}
          {pluralize(state?.players.length ?? 0, "hráč", "hráči", "hráčů")} v lobby
        </div>
      </main>
    );
  }

  if (phase === "question" && state?.question) {
    const opts = state.question.options;
    const hasAnswered = selected !== null;
    return (
      <main className="min-h-svh flex flex-col p-4 text-foreground">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="font-display font-black uppercase tracking-widest text-xs">
            Otázka {state.question.index + 1}/{state.question.total}
          </div>
          <div
            className={`font-display font-black text-3xl tabular-nums ${
              secondsLeft <= 3 ? "text-destructive" : "text-foreground"
            }`}
          >
            {secondsLeft}s
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-brand transition-all duration-200 ease-linear"
            style={{ width: `${(secondsLeft / 15) * 100}%` }}
          />
        </div>
        <div className="bg-card text-card-foreground border border-card-border rounded-2xl p-5 mb-4">
          <div className="font-display font-bold text-lg leading-snug text-balance">
            {state.question.text}
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 pb-2">
          {opts.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`group text-left rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-all font-semibold text-base leading-snug
                  ${
                    isSelected
                      ? "bg-brand text-brand-foreground border-2 border-brand"
                      : "bg-card text-card-foreground border-2 border-card-border hover:border-brand"
                  }`}
              >
                <span
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-xl
                    ${isSelected ? "bg-brand-foreground text-brand" : "bg-brand text-brand-foreground"}`}
                >
                  {OPTION_LETTERS[i]}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
        {hasAnswered && (
          <div className="mt-2 text-center text-foreground-subtle text-sm">
            Odpověď uložena · můžeš ji měnit, dokud běží čas.
          </div>
        )}
      </main>
    );
  }

  if (phase === "reveal") {
    // `state` and `self` arrive as two separate socket events. On a slow link
    // (e.g. mobile data) the gap between them can be hundreds of ms, during
    // which `self` still holds the PREVIOUS question's result. So don't render
    // correctness from `self` until its index matches the question being
    // revealed. Until then, derive it optimistically from data carried in the
    // SAME event that flipped the phase: `state.reveal.correctIndex` vs the
    // option this client picked (`selected`). `self` then becomes authoritative
    // and also supplies the points once it catches up.
    const reveal = state?.reveal;
    const revealIndex = reveal?.index ?? state?.question?.index ?? null;
    const selfReady = self != null && self.lastAnswerIndex === revealIndex;
    const correct = selfReady
      ? self.lastAnswerCorrect === true
      : reveal != null && selected != null && selected === reveal.correctIndex;
    const points = selfReady ? self.lastAnswerPoints ?? 0 : 0;
    return (
      <main
        className={`min-h-svh flex flex-col items-center justify-center p-6 ${
          correct ? "bg-brand text-brand-foreground" : "bg-canvas-bottom text-foreground"
        }`}
      >
        <div
          className={`font-display font-black uppercase tracking-[0.3em] text-xs ${
            correct ? "" : "text-destructive"
          }`}
        >
          {correct ? "Správně!" : "Špatně"}
        </div>
        <div className="text-8xl font-black my-6">{correct ? "🎉" : "💥"}</div>
        {correct ? (
          selfReady ? (
            <div className="font-display font-black text-4xl">+{points} bodů</div>
          ) : (
            <div className="text-xl opacity-70">Počítáme body…</div>
          )
        ) : (
          <div className="text-xl opacity-70">Tentokrát bez bodů</div>
        )}
        <div className="mt-10 opacity-70">
          Celkem: <span className="font-display font-black">{self?.score ?? 0}</span>
        </div>
      </main>
    );
  }

  if (phase === "leaderboard") {
    return (
      <main className="min-h-svh flex flex-col items-center justify-center p-6 text-foreground">
        <div className="font-display font-black uppercase tracking-[0.3em] text-xs text-brand">
          Průběžný stav
        </div>
        <div className="font-display font-black text-7xl my-4 text-brand">
          {self?.score ?? 0}
        </div>
        <div className="text-foreground-subtle">bodů</div>
        {myRank && (
          <div className="mt-8 text-xl">
            Pořadí: <span className="font-display font-black text-2xl">#{myRank}</span>
          </div>
        )}
      </main>
    );
  }

  if (phase === "ended") {
    return (
      <main className="min-h-svh flex flex-col items-center justify-center p-6 text-foreground">
        <div className="font-display font-black uppercase tracking-[0.3em] text-xs text-brand">
          Konec hry
        </div>
        <div className="font-display font-black text-7xl my-4 text-brand">
          {self?.score ?? 0}
        </div>
        <div className="text-foreground-muted">finální skóre</div>
        {myRank && (
          <div className="mt-6 text-2xl text-foreground-muted">
            Skončil/a jsi{" "}
            <span className="font-display font-black text-brand">#{myRank}</span>
          </div>
        )}
      </main>
    );
  }

  return null;
}

function pluralize(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

"use client";

import { useState } from "react";
import type { SoloQuestion } from "@/lib/solo";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

type Stage = "email" | "quiz" | "done";

export default function SoloQuiz({ questions }: { questions: SoloQuestion[] }) {
  const [stage, setStage] = useState<Stage>("email");

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const handleStart = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/solo/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Něco se pokazilo. Zkus to prosím znovu.");
        return;
      }
      setParticipantId(data.participantId);
      // The quiz begins the moment the email is stored — no extra tap.
      setStage("quiz");
    } catch {
      setError("Nepodařilo se spojit se serverem. Zkontroluj připojení.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePick = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
  };

  const handleNext = async (finalAnswers: (number | null)[]) => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/solo/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, answers: finalAnswers }),
      });
      const data = await res.json();
      // Grading is server-side; if it somehow fails we still close the loop
      // rather than trapping someone on the last question.
      setResult(res.ok ? data : { score: 0, total: questions.length });
    } catch {
      setResult({ score: 0, total: questions.length });
    } finally {
      setSubmitting(false);
      setStage("done");
    }
  };

  if (stage === "email") {
    return (
      <main className="min-h-svh flex flex-col justify-center text-foreground px-6 py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="font-display font-black text-xs tracking-[0.3em] uppercase">
            Operations Hub
          </div>
          <h1 className="font-display font-black text-4xl uppercase leading-[0.95] mt-3 text-balance">
            Vyplň <span className="bg-brand text-brand-foreground px-2 inline-block">kvíz</span>
          </h1>
          <p className="mt-3 text-foreground-subtle text-sm">
            Zadej e-mail a kvíz se rovnou spustí. {questions.length} otázek, bez
            časového limitu.
          </p>

          <div className="flex flex-col gap-3 pt-7">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && consent && email.trim()) handleStart();
              }}
              placeholder="tvuj@email.cz"
              maxLength={254}
              autoFocus
              className="w-full bg-card border-2 border-card-border rounded-2xl text-xl text-card-foreground text-center placeholder-card-foreground-subtle/70 px-5 py-4 outline-none focus:border-brand font-semibold"
            />

            <label className="flex items-start gap-3 text-sm text-foreground-muted bg-card/50 border border-card-border/50 rounded-2xl px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 accent-brand cursor-pointer"
              />
              <span>
                Souhlasím, aby Operations Hub uložil můj e-mail a použil ho pro
                zaslání odměny a další komunikaci.
              </span>
            </label>

            <button
              onClick={handleStart}
              disabled={submitting || !consent || email.trim().length === 0}
              className="w-full bg-brand hover:bg-brand-hover text-brand-foreground font-display font-black text-2xl uppercase tracking-wider py-4 rounded-2xl disabled:opacity-30 active:scale-[0.98] transition-transform"
            >
              {submitting ? "Spouštím…" : "Spustit kvíz"}
            </button>

            {error && (
              <div className="text-destructive text-center font-semibold mt-1">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (stage === "quiz") {
    const q = questions[index];
    const selected = answers[index];
    const isLast = index === questions.length - 1;
    return (
      <main className="min-h-svh flex flex-col p-4 text-foreground">
        <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">
          <div className="flex justify-between items-center mb-3 px-1">
            <div className="font-display font-black uppercase tracking-widest text-xs">
              Otázka {index + 1}/{questions.length}
            </div>
            <div className="font-display font-black text-xs uppercase tracking-widest text-foreground-subtle tabular-nums">
              {answers.filter((a) => a !== null).length}/{questions.length} zodpovězeno
            </div>
          </div>

          {/* Progress reflects position in the quiz, not time — it's untimed. */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-brand transition-all duration-300 ease-out"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="bg-card text-card-foreground border border-card-border rounded-2xl p-5 mb-4">
            <div className="font-display font-bold text-lg leading-snug text-balance">
              {q.text}
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => handlePick(i)}
                  className={`text-left rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-all font-semibold text-base leading-snug
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

          <div className="flex gap-3 pt-5">
            {index > 0 && (
              <button
                onClick={() => setIndex(index - 1)}
                className="px-5 py-4 rounded-2xl bg-card text-card-foreground border-2 border-card-border hover:border-brand font-display font-black text-base uppercase tracking-wider active:scale-[0.98] transition-transform"
              >
                Zpět
              </button>
            )}
            <button
              onClick={() => handleNext(answers)}
              disabled={selected === null || submitting}
              className="flex-1 bg-brand hover:bg-brand-hover text-brand-foreground font-display font-black text-xl uppercase tracking-wider py-4 rounded-2xl disabled:opacity-30 active:scale-[0.98] transition-transform"
            >
              {submitting ? "Odesílám…" : isLast ? "Dokončit" : "Další"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh flex flex-col items-center justify-center p-6 text-foreground text-center">
      <div className="text-7xl mb-6">🎉</div>
      <div className="font-display font-black uppercase tracking-[0.3em] text-xs text-brand">
        Hotovo
      </div>
      <h1 className="font-display font-black text-4xl uppercase mt-3 text-balance">
        Díky za vyplnění!
      </h1>

      {result && (
        <div className="mt-8 bg-card border border-card-border rounded-2xl px-8 py-6">
          <div className="text-card-foreground-subtle text-xs uppercase tracking-widest font-display font-black">
            Tvůj výsledek
          </div>
          <div className="font-display font-black text-6xl text-brand mt-2 tabular-nums">
            {result.score}/{result.total}
          </div>
        </div>
      )}

      <p className="mt-8 text-foreground-muted max-w-sm text-balance">
        Odměnu a další informace ti pošleme na{" "}
        <span className="font-semibold text-foreground">{email}</span>.
      </p>
    </main>
  );
}

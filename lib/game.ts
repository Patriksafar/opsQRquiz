import { nanoid } from "nanoid";
import type {
  ClientQuestion,
  LeaderboardEntry,
  Phase,
  Player,
  PublicPlayer,
  PublicState,
  Question,
  RevealPayload,
} from "./types";

export const QUESTION_DURATION_MS = 10_000;
export const REVEAL_DURATION_MS = 4_000;
export const LEADERBOARD_DURATION_MS = 6_000;
export const MAX_POINTS = 1000;
export const MIN_POINTS_ON_CORRECT = 100;

type AnswerRecord = {
  optionIndex: number;
  timeMs: number;
  correct: boolean;
  points: number;
};

type QuestionRound = {
  startedAt: number;
  endsAt: number;
  answers: Map<string, AnswerRecord>;
};

type Listener = () => void;

export class GameEngine {
  private players = new Map<string, Player>();
  private phase: Phase = "lobby";
  private questions: Question[];
  private currentIndex = -1;
  private round: QuestionRound | null = null;
  private reveal: RevealPayload | null = null;
  private timer: NodeJS.Timeout | null = null;
  private listeners = new Set<Listener>();

  constructor(questions: Question[]) {
    this.questions = questions;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  addPlayer(nickname: string): { ok: true; id: string } | { ok: false; error: string } {
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      return { ok: false, error: "Nickname must be 1-20 characters" };
    }
    if (this.phase !== "lobby") {
      return { ok: false, error: "Game already started" };
    }
    const existing = [...this.players.values()].some(
      (p) => p.nickname.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      return { ok: false, error: "Nickname already taken" };
    }
    const id = nanoid(10);
    const angle = (Math.random() * 30 - 15);
    const player: Player = {
      id,
      nickname: trimmed,
      score: 0,
      angle,
      joinedAt: Date.now(),
    };
    this.players.set(id, player);
    this.notify();
    return { ok: true, id };
  }

  removePlayer(id: string) {
    if (this.players.delete(id)) this.notify();
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  startGame() {
    if (this.phase !== "lobby") return;
    if (this.questions.length === 0) return;
    this.currentIndex = -1;
    this.advance();
  }

  reset() {
    this.clearTimer();
    this.players.clear();
    this.phase = "lobby";
    this.currentIndex = -1;
    this.round = null;
    this.reveal = null;
    this.notify();
  }

  forceNext() {
    if (this.phase === "lobby" || this.phase === "ended") return;
    this.clearTimer();
    if (this.phase === "question") {
      this.enterReveal();
    } else if (this.phase === "reveal") {
      this.enterLeaderboard();
    } else if (this.phase === "leaderboard") {
      this.advance();
    }
  }

  submitAnswer(playerId: string, optionIndex: number) {
    if (this.phase !== "question" || !this.round) return;
    const question = this.questions[this.currentIndex];
    if (optionIndex < 0 || optionIndex >= question.options.length) return;
    const player = this.players.get(playerId);
    if (!player) return;
    if (this.round.answers.has(playerId)) return;

    const now = Date.now();
    const elapsed = now - this.round.startedAt;
    if (elapsed >= QUESTION_DURATION_MS) return;

    const correct = optionIndex === question.correctIndex;
    let points = 0;
    if (correct) {
      const speedRatio = 1 - elapsed / QUESTION_DURATION_MS;
      points = Math.round(MIN_POINTS_ON_CORRECT + (MAX_POINTS - MIN_POINTS_ON_CORRECT) * speedRatio);
    }
    this.round.answers.set(playerId, { optionIndex, timeMs: elapsed, correct, points });
    player.score += points;

    if (this.round.answers.size >= this.players.size) {
      this.clearTimer();
      this.enterReveal();
    } else {
      this.notify();
    }
  }

  private advance() {
    this.clearTimer();
    this.reveal = null;
    this.currentIndex += 1;
    if (this.currentIndex >= this.questions.length) {
      this.phase = "ended";
      this.round = null;
      this.notify();
      return;
    }
    const startedAt = Date.now();
    this.round = {
      startedAt,
      endsAt: startedAt + QUESTION_DURATION_MS,
      answers: new Map(),
    };
    this.phase = "question";
    this.timer = setTimeout(() => this.enterReveal(), QUESTION_DURATION_MS);
    this.notify();
  }

  private enterReveal() {
    this.clearTimer();
    if (!this.round) return;
    const question = this.questions[this.currentIndex];
    const perOption = new Array(question.options.length).fill(0);
    for (const a of this.round.answers.values()) {
      perOption[a.optionIndex] = (perOption[a.optionIndex] ?? 0) + 1;
    }
    this.reveal = {
      index: this.currentIndex,
      correctIndex: question.correctIndex,
      perOption,
    };
    this.phase = "reveal";
    this.timer = setTimeout(() => this.enterLeaderboard(), REVEAL_DURATION_MS);
    this.notify();
  }

  private enterLeaderboard() {
    this.clearTimer();
    this.phase = "leaderboard";
    const isLast = this.currentIndex >= this.questions.length - 1;
    if (isLast) {
      this.timer = setTimeout(() => {
        this.phase = "ended";
        this.notify();
      }, LEADERBOARD_DURATION_MS);
    } else {
      this.timer = setTimeout(() => this.advance(), LEADERBOARD_DURATION_MS);
    }
    this.notify();
  }

  getPublicState(): PublicState {
    const players: PublicPlayer[] = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, angle: p.angle }));

    let question: ClientQuestion | null = null;
    if ((this.phase === "question" || this.phase === "reveal") && this.round) {
      const q = this.questions[this.currentIndex];
      question = {
        index: this.currentIndex,
        total: this.questions.length,
        text: q.text,
        options: q.options,
        endsAt: this.round.endsAt,
      };
    }

    const leaderboard = this.buildLeaderboard();
    const isFinal = this.phase === "ended";

    return {
      phase: this.phase,
      players,
      question,
      reveal: this.phase === "reveal" ? this.reveal : null,
      leaderboard,
      isFinal,
    };
  }

  private buildLeaderboard(): LeaderboardEntry[] {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
      .slice(0, 10)
      .map((p, i) => ({ id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }));
  }

  getPlayerSelfState(id: string) {
    const player = this.players.get(id);
    if (!player) return null;
    const lastAnswer = this.round?.answers.get(id) ?? null;
    return {
      id: player.id,
      nickname: player.nickname,
      score: player.score,
      lastAnswerCorrect: this.phase === "reveal" || this.phase === "leaderboard" ? lastAnswer?.correct ?? false : null,
      lastAnswerPoints: this.phase === "reveal" || this.phase === "leaderboard" ? lastAnswer?.points ?? 0 : null,
      hasAnsweredCurrent: this.phase === "question" && !!lastAnswer,
    };
  }
}

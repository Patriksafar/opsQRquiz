export type Question = {
  text: string;
  options: string[];
  correctIndex: number;
};

export type Phase = "lobby" | "question" | "reveal" | "leaderboard" | "ended";

export type Player = {
  id: string;
  nickname: string;
  score: number;
  angle: number;
  joinedAt: number;
};

export type PublicPlayer = {
  id: string;
  nickname: string;
  score: number;
  angle: number;
};

export type ClientQuestion = {
  index: number;
  total: number;
  text: string;
  options: string[];
  endsAt: number;
};

export type RevealPayload = {
  index: number;
  correctIndex: number;
  perOption: number[];
};

export type LeaderboardEntry = {
  id: string;
  nickname: string;
  score: number;
  rank: number;
};

export type PublicState = {
  phase: Phase;
  players: PublicPlayer[];
  question: ClientQuestion | null;
  reveal: RevealPayload | null;
  leaderboard: LeaderboardEntry[];
  isFinal: boolean;
};

export type PlayerSelfState = {
  id: string;
  nickname: string;
  score: number;
  lastAnswerCorrect: boolean | null;
  lastAnswerPoints: number | null;
  hasAnsweredCurrent: boolean;
};

export type ServerToClientEvents = {
  state: (state: PublicState) => void;
  self: (self: PlayerSelfState) => void;
  joined: (player: { id: string; nickname: string }) => void;
  error: (message: string) => void;
};

export type ClientToServerEvents = {
  "player:join": (nickname: string, cb: (res: { ok: true; id: string } | { ok: false; error: string }) => void) => void;
  "player:answer": (optionIndex: number) => void;
  "admin:auth": (secret: string, cb: (res: { ok: boolean }) => void) => void;
  "admin:start": (secret: string) => void;
  "admin:next": (secret: string) => void;
  "admin:reset": (secret: string) => void;
  "display:subscribe": () => void;
};

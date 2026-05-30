import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import next from "next";
import { Server as IOServer } from "socket.io";
import { GameEngine } from "./lib/game";
import type {
  ClientToServerEvents,
  Question,
  ServerToClientEvents,
} from "./lib/types";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const adminSecret = process.env.ADMIN_SECRET ?? "change-me";

const questions = JSON.parse(
  readFileSync(resolve(process.cwd(), "questions.json"), "utf-8"),
) as Question[];

const game = new GameEngine(questions);
const app = next({ dev });
const handle = app.getRequestHandler();

const playerSockets = new Map<string, Set<string>>();
const socketToPlayer = new Map<string, string>();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  const broadcastState = () => {
    const state = game.getPublicState();
    io.emit("state", state);
    for (const [playerId, sockets] of playerSockets) {
      const self = game.getPlayerSelfState(playerId);
      if (!self) continue;
      for (const sid of sockets) io.to(sid).emit("self", self);
    }
  };

  game.onChange(broadcastState);

  io.on("connection", (socket) => {
    socket.emit("state", game.getPublicState());

    socket.on("player:join", (nickname, cb) => {
      const result = game.addPlayer(nickname);
      if (!result.ok) {
        cb(result);
        return;
      }
      const { id } = result;
      socketToPlayer.set(socket.id, id);
      const set = playerSockets.get(id) ?? new Set();
      set.add(socket.id);
      playerSockets.set(id, set);
      cb({ ok: true, id });
      socket.emit("joined", { id, nickname: game.getPlayer(id)!.nickname });
      const self = game.getPlayerSelfState(id);
      if (self) socket.emit("self", self);
    });

    socket.on("player:rejoin", (playerId, cb) => {
      const player = game.getPlayer(playerId);
      if (!player) {
        cb({ ok: false, error: "Player not found" });
        return;
      }
      socketToPlayer.set(socket.id, playerId);
      const set = playerSockets.get(playerId) ?? new Set();
      set.add(socket.id);
      playerSockets.set(playerId, set);
      cb({ ok: true, id: playerId, nickname: player.nickname });
      const self = game.getPlayerSelfState(playerId);
      if (self) socket.emit("self", self);
    });

    socket.on("player:answer", (optionIndex) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;
      game.submitAnswer(playerId, optionIndex);
      const self = game.getPlayerSelfState(playerId);
      if (self) socket.emit("self", self);
    });

    socket.on("admin:start", (secret) => {
      if (secret !== adminSecret) return;
      game.startGame();
    });

    socket.on("admin:next", (secret) => {
      if (secret !== adminSecret) return;
      game.forceNext();
    });

    socket.on("admin:reset", (secret) => {
      if (secret !== adminSecret) return;
      game.reset();
    });

    socket.on("admin:auth", (secret, cb) => {
      cb({ ok: secret === adminSecret });
    });

    socket.on("disconnect", () => {
      const playerId = socketToPlayer.get(socket.id);
      socketToPlayer.delete(socket.id);
      if (playerId) {
        const set = playerSockets.get(playerId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            playerSockets.delete(playerId);
          }
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Admin path: /admin/${adminSecret}`);
  });
});

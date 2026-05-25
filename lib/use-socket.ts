"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(): AppSocket | null {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const ref = useRef<AppSocket | null>(null);

  useEffect(() => {
    const s: AppSocket = io({ transports: ["websocket", "polling"] });
    ref.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      ref.current = null;
    };
  }, []);

  return socket;
}

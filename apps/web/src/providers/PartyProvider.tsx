import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import PartySocket from "partysocket";
import type { RoomSnapshot } from "@/games/registry";

/** Message types matching the server's ClientMessage */
export type ClientMessage =
  | { type: "join"; name: string; sessionId: string; avatarImage?: string }
  | { type: "rejoin"; sessionId: string }
  | { type: "changeGameType"; hostId: string; gameType: string }
  | { type: "startGame"; hostId: string }
  | { type: "submitAnswer"; sessionId: string; content: unknown }
  | { type: "hostAdvance"; hostId: string }
  | { type: "updateSettings"; hostId: string; settings: Record<string, unknown> }
  | { type: "backToLobby"; hostId: string }
  | { type: "restartGame"; hostId: string }
  | { type: "continueGame"; hostId: string }
  | { type: "kickPlayer"; hostId: string; playerId: string }
  | { type: "heartbeat"; sessionId: string }
  | { type: "telefonAdvanceReveal"; hostId: string }
  | { type: "changeAvatar"; sessionId: string; avatarImage: string }
  | { type: "leaveRoom"; sessionId: string };

type ServerMessage =
  | { type: "room"; data: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "joined"; playerId: string; roomCode: string }
  | { type: "kicked" };

interface PartyContextValue {
  room: RoomSnapshot | null;
  send: (msg: ClientMessage) => void;
  error: string | null;
  connected: boolean;
}

const PartyContext = createContext<PartyContextValue | null>(null);

const PARTY_HOST =
  (import.meta.env.VITE_PARTY_HOST as string) ?? "localhost:1999";

export function PartyProvider({
  roomCode,
  sessionId,
  children,
}: {
  roomCode: string;
  sessionId: string;
  children: ReactNode;
}) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const ws = new PartySocket({
      host: PARTY_HOST,
      room: roomCode.toLowerCase(),
      id: sessionId,
    });

    ws.addEventListener("open", () => {
      setConnected(true);
      setError(null);
    });

    ws.addEventListener("close", () => {
      setConnected(false);
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "room":
            setRoom(msg.data);
            break;
          case "error":
            setError(msg.message);
            break;
          case "kicked":
            setError("Du er blevet fjernet fra spillet");
            break;
        }
      } catch {
        // ignore parse errors
      }
    });

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, sessionId]);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return (
    <PartyContext.Provider value={{ room, send, error, connected }}>
      {children}
    </PartyContext.Provider>
  );
}

/** Get the current room state (replaces useQuery) */
export function useRoom(): RoomSnapshot | null {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useRoom must be used within PartyProvider");
  return ctx.room;
}

/** Get the send function (replaces useMutation) */
export function useSend(): (msg: ClientMessage) => void {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useSend must be used within PartyProvider");
  return ctx.send;
}

/** Get connection state */
export function usePartyConnection(): { connected: boolean; error: string | null } {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("usePartyConnection must be used within PartyProvider");
  return { connected: ctx.connected, error: ctx.error };
}

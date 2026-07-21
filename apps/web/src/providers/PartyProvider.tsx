import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import PartySocket from "partysocket";
import type { RoomSnapshot } from "@/games/registry";
import { PARTY_HOST } from "@/lib/partyHost";
import type { AvatarSpec } from "@/lib/avatar";

/** Message types matching the server's ClientMessage */
export type ClientMessage =
  | { type: "join"; name: string; sessionId: string; avatar?: AvatarSpec }
  | { type: "rejoin"; sessionId: string }
  | { type: "changeGameType"; hostId: string; gameType: string }
  | { type: "startGame"; hostId: string }
  | { type: "submitAnswer"; sessionId: string; content: unknown; phase?: string }
  | { type: "hostAdvance"; hostId: string }
  | { type: "updateSettings"; hostId: string; settings: Record<string, unknown> }
  | { type: "backToLobby"; hostId: string }
  | { type: "restartGame"; hostId: string }
  | { type: "continueGame"; hostId: string }
  | { type: "kickPlayer"; hostId: string; playerId: string }
  | { type: "morphAdvanceReveal"; hostId: string }
  | { type: "changeAvatar"; sessionId: string; avatar: AvatarSpec }
  | { type: "leaveRoom"; sessionId: string }
  | { type: "hostConnect"; sessionId: string; hostSecret: string; license?: string }
  | { type: "redeemLicense"; hostId: string; code: string; requestId?: string }
  | { type: "ping" };

type ServerMessage =
  | { type: "pong" }
  | { type: "room"; data: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "joined"; playerId: string; roomCode: string }
  | { type: "rejoinFailed" }
  | { type: "kicked" }
  | { type: "roomClosed"; reason: string }
  | { type: "hostClaimed"; success: boolean }
  | {
      type: "licenseResult";
      ok: boolean;
      packs: string[];
      reason?: "invalid" | "rateLimited" | "denylisted";
      requestId?: string;
    };

/** Seneste licens-svar. `at` gør at to ens fejl i træk stadig re-trigger effects. */
export interface LicenseResult {
  ok: boolean;
  packs: string[];
  reason?: "invalid" | "rateLimited" | "denylisted";
  /** Ekko af redeemLicense-requestId'et — auto-indløsninger (hostConnect) har intet. */
  requestId?: string;
  at: number;
}

interface PartyContextValue {
  room: RoomSnapshot | null;
  send: (msg: ClientMessage) => void;
  error: string | null;
  connected: boolean;
  roomClosed: string | null;
  rejoinFailed: boolean;
  /** null = no claim attempted/answered yet; false = claim rejected */
  hostClaimed: boolean | null;
  /** null indtil serveren har svaret på en indløsning/medbragt kode */
  licenseResult: LicenseResult | null;
}

const PartyContext = createContext<PartyContextValue | null>(null);

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
  const [roomClosed, setRoomClosed] = useState<string | null>(null);
  const [rejoinFailed, setRejoinFailed] = useState(false);
  const [hostClaimed, setHostClaimed] = useState<boolean | null>(null);
  const [licenseResult, setLicenseResult] = useState<LicenseResult | null>(null);
  const wsRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const ws = new PartySocket({
      host: PARTY_HOST,
      room: roomCode.toLowerCase(),
      id: sessionId,
    });

    // ── Heartbeat + vågn-op ──
    // Brave og mobilbrowsere throttler baggrundsfaner så hårdt, at en død
    // socket kan stå som OPEN i minutter uden at 'close' fyrer. Ping/pong
    // opdager zombien, og visibility/pageshow/online-listeners tvinger et
    // øjeblikkeligt reconnect når fanen vågner, i stedet for at brugeren
    // venter på exponential backoff mod en socket, der aldrig svarer.
    const HEARTBEAT_INTERVAL_MS = 20_000;
    const PONG_TIMEOUT_MS = 10_000;
    let lastPongAt = 0;
    let pingSentAt = 0;
    let zombieCheck: ReturnType<typeof setTimeout> | null = null;

    const pongMissing = () =>
      pingSentAt > lastPongAt && Date.now() - pingSentAt >= PONG_TIMEOUT_MS;

    const sendPing = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      pingSentAt = Date.now();
      ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (pongMissing()) {
        ws.reconnect();
        return;
      }
      sendPing();
    }, HEARTBEAT_INTERVAL_MS);

    const wake = () => {
      if (document.visibilityState === "hidden") return;
      // visibilitychange/pageshow/online fyrer ofte i klynge ved oplåsning —
      // et reconnect() midt i et igangværende handshake ville afbryde og
      // genstarte det (partysocket lukker også en CONNECTING socket).
      if (ws.readyState === WebSocket.CONNECTING) return;
      if (ws.readyState !== WebSocket.OPEN) {
        // Springer backoff-ventetiden over — brugeren kigger på skærmen nu.
        ws.reconnect();
        return;
      }
      // Socketen SER åben ud, men kan være en zombie — afgør det med et ping.
      sendPing();
      if (zombieCheck) clearTimeout(zombieCheck);
      zombieCheck = setTimeout(() => {
        if (pongMissing()) ws.reconnect();
      }, PONG_TIMEOUT_MS + 500);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);

    ws.addEventListener("open", () => {
      // Nulstil så et ubesvaret ping fra FØR reconnect ikke straks dræber
      // den nye, sunde forbindelse.
      lastPongAt = Date.now();
      pingSentAt = 0;
      setConnected(true);
      setError(null);
    });

    ws.addEventListener("close", () => {
      setConnected(false);
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "pong":
            lastPongAt = Date.now();
            break;
          case "room":
            setRoom(msg.data);
            break;
          case "joined":
            setRejoinFailed(false);
            break;
          case "rejoinFailed":
            setRejoinFailed(true);
            break;
          case "error":
            setError(msg.message);
            break;
          case "kicked":
            setError("Du er blevet fjernet fra spillet");
            break;
          case "roomClosed":
            setRoomClosed(msg.reason);
            break;
          case "hostClaimed":
            // A rejected claim (code collision / wrong secret) must surface —
            // otherwise the host stares at a dead UI that ignores every click.
            setHostClaimed(msg.success);
            break;
          case "licenseResult":
            setLicenseResult({
              ok: msg.ok,
              packs: msg.packs,
              reason: msg.reason,
              requestId: msg.requestId,
              at: Date.now(),
            });
            break;
        }
      } catch {
        // ignore parse errors
      }
    });

    wsRef.current = ws;

    return () => {
      clearInterval(heartbeat);
      if (zombieCheck) clearTimeout(zombieCheck);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, sessionId]);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return (
    <PartyContext.Provider
      value={{ room, send, error, connected, roomClosed, rejoinFailed, hostClaimed, licenseResult }}
    >
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

/** Get roomClosed reason (null if room is still open) */
export function useRoomClosed(): string | null {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useRoomClosed must be used within PartyProvider");
  return ctx.roomClosed;
}

/** True when the server rejected a rejoin (unknown session) */
export function useRejoinFailed(): boolean {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useRejoinFailed must be used within PartyProvider");
  return ctx.rejoinFailed;
}

/** Result of the latest hostConnect claim: null until answered, false = rejected */
export function useHostClaimed(): boolean | null {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useHostClaimed must be used within PartyProvider");
  return ctx.hostClaimed;
}

/** Seneste licenseResult fra serveren (null indtil første svar) */
export function useLicenseResult(): LicenseResult | null {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useLicenseResult must be used within PartyProvider");
  return ctx.licenseResult;
}

/** Mock provider for simulator — renders game components without a WebSocket */
export function MockPartyProvider({
  room,
  onSend,
  children,
}: {
  room: RoomSnapshot;
  onSend?: (msg: ClientMessage) => void;
  children: ReactNode;
}) {
  const send = useCallback(
    (msg: ClientMessage) => onSend?.(msg),
    [onSend],
  );

  const value = useMemo(
    () => ({
      room,
      send,
      error: null,
      connected: true,
      roomClosed: null,
      rejoinFailed: false,
      hostClaimed: true as boolean | null,
      licenseResult: null,
    }),
    [room, send],
  );

  return (
    <PartyContext.Provider value={value}>
      {children}
    </PartyContext.Provider>
  );
}

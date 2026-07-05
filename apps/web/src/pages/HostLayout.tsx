import { useEffect, useRef } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, usePartyConnection, useSend } from "@/providers/PartyProvider";
import { getHostSession } from "@/lib/session";

/**
 * Re-claims host on EVERY websocket open, not just the first: after a network
 * blink or server restart the server may have lost the host binding, and
 * handleHostConnect is idempotent for the correct secret.
 */
function HostConnectionManager({ sessionId }: { sessionId: string }) {
  const send = useSend();
  const { connected } = usePartyConnection();
  const prevConnected = useRef(false);

  useEffect(() => {
    if (!connected) {
      prevConnected.current = false;
      return;
    }
    if (prevConnected.current) return;
    prevConnected.current = true;

    const session = getHostSession();
    if (session) {
      send({ type: "hostConnect", sessionId, hostSecret: session.secret });
    }
  }, [connected, send, sessionId]);

  return null;
}

/**
 * Layout route that shares ONE PartyProvider between /host/:code and
 * /host/:code/settings, so opening settings doesn't close the host's
 * websocket and auto-pause the game for everyone.
 */
export function HostLayout() {
  const { code } = useParams<{ code: string }>();
  const sessionId = useSessionId();

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--color-text-muted)]">Intet rumkode angivet.</p>
      </div>
    );
  }

  return (
    <PartyProvider roomCode={code} sessionId={sessionId}>
      <HostConnectionManager sessionId={sessionId} />
      <Outlet />
    </PartyProvider>
  );
}

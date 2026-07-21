import { useEffect, useRef } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, useLicenseResult, usePartyConnection, useRoom, useSend } from "@/providers/PartyProvider";
import { getHostSession } from "@/lib/session";
import { ConnectionLostBanner } from "@/components/ConnectionLostBanner";
import {
  getStoredLicense,
  LICENSE_STORAGE_KEY,
  setStoredLicense,
  takeRedeemForStorage,
} from "@/lib/license";

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
      // En gemt licenskode medsendes altid — serveren unioner entitlements
      // (gyldig) eller rører intet (ugyldig/manglende), så det er ufarligt.
      send({
        type: "hostConnect",
        sessionId,
        hostSecret: session.secret,
        license: getStoredLicense() ?? undefined,
      });
    }
  }, [connected, send, sessionId]);

  return null;
}

/**
 * Samme-enheds-auto-indløsning (spec §3.3): når /tak-fanen gemmer koden i
 * localStorage, fyrer storage-eventet i DENNE fane (storage-events fyrer kun i
 * andre faner end skriveren) — indløs straks over den åbne socket, så låsen
 * forsvinder uden refresh.
 */
function LicenseStorageListener({ sessionId }: { sessionId: string }) {
  const send = useSend();

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LICENSE_STORAGE_KEY || !e.newValue) return;
      send({ type: "redeemLicense", hostId: sessionId, code: e.newValue });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [send, sessionId]);

  return null;
}

/**
 * Central persistering af indløste koder: komponenten her er altid mountet
 * under PartyProvider, så koden gemmes også når afsenderen (oplåsnings-modal
 * eller settings-fanen) unmountes før serverens svar ankommer.
 */
function LicensePersistence() {
  const licenseResult = useLicenseResult();

  useEffect(() => {
    if (!licenseResult?.requestId) return;
    const code = takeRedeemForStorage(licenseResult.requestId);
    if (licenseResult.ok && code) setStoredLicense(code);
  }, [licenseResult]);

  return null;
}

/**
 * Værten havde ingen indikator ved mistet forbindelse — skærmen stod bare med
 * et frosset snapshot. `room`-guarden undgår et blink før første connect.
 */
function HostConnectionBanner() {
  const room = useRoom();
  const { connected } = usePartyConnection();
  if (connected || !room) return null;
  return <ConnectionLostBanner />;
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
      <LicenseStorageListener sessionId={sessionId} />
      <LicensePersistence />
      <HostConnectionBanner />
      <Outlet />
    </PartyProvider>
  );
}

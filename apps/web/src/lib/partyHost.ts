// Fail the build/boot loudly rather than silently connecting every client to a
// dead localhost socket in production when VITE_PARTY_HOST is forgotten.
if (import.meta.env.PROD && !import.meta.env.VITE_PARTY_HOST) {
  throw new Error(
    "VITE_PARTY_HOST mangler i produktions-build — sæt den i deploy-miljøet (Vercel/Cloudflare).",
  );
}

export const PARTY_HOST =
  (import.meta.env.VITE_PARTY_HOST as string) || "localhost:1999";

/**
 * HTTP-URL til et rums DO (onRequest-endpointet). DO-id'er er lowercase —
 * PartySocket forbinder med roomCode.toLowerCase(), så det skal vi også.
 */
export function partyRoomHttpUrl(roomCode: string): string {
  const protocol = /^(localhost|127\.)/.test(PARTY_HOST) ? "http" : "https";
  return `${protocol}://${PARTY_HOST}/parties/main/${roomCode.toLowerCase()}`;
}

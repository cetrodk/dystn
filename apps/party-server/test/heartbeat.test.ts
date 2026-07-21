import { describe, expect, it, vi } from "vitest";
import type * as Party from "partykit/server";
import DystnServer from "../src/server";

function makeConn(id = "session-1") {
  return { id, send: vi.fn() } as unknown as Party.Connection & {
    send: ReturnType<typeof vi.fn>;
  };
}

// Ping håndteres før al auth/state i onMessage, så en server uden onStart
// (tom storage, mocket room) er nok til at teste kontrakten.
function makeServer() {
  return new DystnServer({ id: "abcd1234" } as unknown as Party.Room);
}

describe("heartbeat (ping/pong)", () => {
  it("svarer pong på ping", async () => {
    const server = makeServer();
    const conn = makeConn();

    await server.onMessage(JSON.stringify({ type: "ping" }), conn);

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(conn.send.mock.calls[0][0])).toEqual({ type: "pong" });
  });

  it("ping kræver ikke at afsenderen er kendt spiller eller vært", async () => {
    const server = makeServer();
    server.state.hostId = "en-anden";
    const conn = makeConn("helt-fremmed");

    await server.onMessage(JSON.stringify({ type: "ping" }), conn);

    expect(JSON.parse(conn.send.mock.calls[0][0])).toEqual({ type: "pong" });
  });

  it("ping muterer ikke rummets state", async () => {
    const server = makeServer();
    const before = JSON.stringify(server.state);

    await server.onMessage(JSON.stringify({ type: "ping" }), makeConn());

    expect(JSON.stringify(server.state)).toBe(before);
  });
});

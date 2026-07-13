import type * as Party from "partykit/server";
import type {
  RoomState,
  ClientMessage,
  ServerMessage,
  RoomSnapshot,
  Player,
} from "./types";
import { advancePhase, getPhaseDuration } from "./phase";
import { getGameHandlers, hasGameHandlers } from "./registry";
import { getAvatarColor } from "./colors";
import { denylistFromEnv, keyringFromEnv, verifyLicense } from "./license";
import { AVATAR_PALETTE, sanitizeAvatarSpec, traitsOf } from "./avatar";

// Register all game handlers (must be after registry is loaded)
import "./games/blitz";
import "./games/fusk";
import "./games/scrawl";
import "./games/surge";
import "./games/morph";
import "./games/hunch";

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 1;
/** Minimum gap between accepted host-advance messages (kills double-clicks) */
const HOST_ADVANCE_DEBOUNCE_MS = 500;

/** Efter så mange fejlslagne licens-valideringer FRA SAMME KILDE starter cooldown */
const LICENSE_MAX_FAILS = 5;
/** Cooldown-længde — kort nok til at ærlige tastefejl ikke brænder værten af */
const LICENSE_COOLDOWN_MS = 30_000;
/** Ryd udløbne throttle-entries når mappet når denne størrelse (mange kilder = angreb) */
const LICENSE_THROTTLE_SWEEP = 500;
/** Sentinel for spil uden eksplicit pack-config: aldrig i entitlements ⇒ altid låst */
const LOCKED_PACK = "__locked__";

/** Settings keys the host may change — the pause keys are server-managed */
const ALLOWED_SETTINGS_KEYS = new Set([
  "submitTime",
  "presentTime",
  "voteTime",
  "revealTime",
  "scoresTime",
  "drawTime",
  "guessTime",
  "writeTime",
  "commitTime",
  "clueTime",
  "showIntro",
  "scrawlDifficulty",
  "surgeDifficulty",
]);

/** Host-only message types — authorized by the connection, not a payload field */
const HOST_ONLY_TYPES = new Set([
  "changeGameType",
  "startGame",
  "hostAdvance",
  "updateSettings",
  "backToLobby",
  "restartGame",
  "continueGame",
  "kickPlayer",
  "morphAdvanceReveal",
  "redeemLicense",
]);

/** Resultat af én licens-validering (fælles for alle tre indløsningskilder) */
type LicenseOutcome =
  | { ok: true; packs: string[] }
  | { ok: false; reason: "invalid" | "rateLimited" | "denylisted" };

/** Generate a 4-char room code from the party room ID */
function roomCodeFromId(id: string): string {
  return id.slice(0, 4).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export default class DystnServer implements Party.Server {
  state: RoomState;
  private readonly roomId: string;
  /** Timestamp of the last accepted phase advance — debounces host double-clicks */
  private lastAdvanceAt = 0;
  /**
   * Licens-throttle PR. KILDE (ws-connection-id hhv. afsender-IP). Bevidst i
   * instans-hukommelsen og ikke i RoomState: en rum-bred, persisteret tæller
   * lod enhver gæst (via det åbne onRequest-endpoint) eller en forældet gemt
   * kode på reconnect spærre værtens egen indløsning permanent. Koderne er
   * 120-bit signerede, så throttlen er chikane-bremse, ikke kryptoværn — at
   * en DO-genstart nulstiller den er acceptabelt.
   */
  private licenseThrottle = new Map<string, { fails: number; cooldownUntil?: number }>();

  constructor(readonly room: Party.Room) {
    this.roomId = room.id;
    this.state = this.freshState();
  }

  private freshState(): RoomState {
    return {
      code: roomCodeFromId(this.roomId),
      hostId: "",
      hostSecret: "",
      hostConnected: false,
      hostLastSeen: 0,
      status: "lobby",
      settings: {},
      players: [],
      submissions: [],
      createdAt: Date.now(),
      phaseVersion: 0,
      entitlements: [],
    };
  }

  /**
   * advancePhase can throw if a game handler hits unrecoverable state (e.g.
   * every player left mid-game and setupRound has nobody to pick from). An
   * uncaught throw mid-mutation would freeze the room in a broken phase —
   * finish the game instead so clients land on a sane screen.
   */
  private safeAdvance(event: string) {
    try {
      advancePhase(this.state, event);
    } catch {
      this.state.status = "finished";
      this.state.currentPhase = "finished";
      this.state.phaseDeadline = undefined;
    }
    // Advancing while paused (host skip / all-submitted during a pause) must
    // not leave a live deadline behind — continueGame would clobber it with
    // the OLD phase's remaining time. Convert it to pausedRemaining so the
    // new phase resumes with its full duration.
    if (this.state.settings.paused && this.state.phaseDeadline) {
      this.state.settings.pausedRemaining = Math.max(0, this.state.phaseDeadline - Date.now());
      this.state.settings.pausedAt = Date.now();
      this.state.phaseDeadline = undefined;
    }
  }

  /**
   * Restore persisted state so a redeploy/eviction mid-game doesn't reset the
   * room to an empty lobby (which would also blank hostSecret and let anyone
   * claim the room).
   */
  async onStart() {
    const saved = await this.room.storage.get<RoomState>("state");
    if (!saved) return;
    this.state = saved;

    // Rum persisteret før licens-felterne fandtes — giv dem defaults
    this.state.entitlements ??= [];

    // All sockets are gone after a restart — connection flags are transient
    this.state.hostConnected = false;
    this.state.hostPauseDeadline = undefined;
    for (const p of this.state.players) p.isConnected = false;

    // The host must reclaim the room within the usual window
    if (this.state.status !== "finished") {
      this.state.hostDisconnectDeadline ??= Date.now() + 5 * 60 * 1000;
    }

    // Deadlines are absolute epoch-ms and still apply; if the phase expired
    // while we were down, advance it once before re-arming the alarm.
    if (
      this.state.status === "playing" &&
      !this.state.settings.paused &&
      this.state.phaseDeadline &&
      Date.now() >= this.state.phaseDeadline
    ) {
      this.safeAdvance("TIMER_EXPIRED");
    }
    this.scheduleNextAlarm();
  }

  /** ── Connection lifecycle ── */

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // console.log(`[${this.state.code}] connect: ${conn.id}, players: ${this.state.players.length}, host: ${this.state.hostId || "(none)"}`);

    // Host reconnect (same sessionId from PartySocket)
    if (conn.id === this.state.hostId) {
      this.state.hostConnected = true;
      this.state.hostLastSeen = Date.now();
      // Cancel pending host-disconnect/pause deadlines
      this.state.hostDisconnectDeadline = undefined;
      this.state.hostPauseDeadline = undefined;
    }

    // Reconnecting player — mark as connected
    const player = this.state.players.find((p) => p.sessionId === conn.id);
    if (player) {
      player.isConnected = true;
      player.lastSeen = Date.now();
    }

    if (player || conn.id === this.state.hostId) {
      // Known reconnect: everyone should see the player/host flip back to
      // connected now, not at the next unrelated broadcast.
      this.broadcastState();
    } else {
      // Send current state to the new connection
      this.sendToConnection(conn);
    }
  }

  onClose(conn: Party.Connection) {
    // Host disconnect detection
    if (conn.id === this.state.hostId) {
      this.state.hostConnected = false;
      this.state.hostLastSeen = Date.now();
      // Schedule room cleanup in 5 minutes
      this.state.hostDisconnectDeadline = Date.now() + 5 * 60 * 1000;
      // Grace period before auto-pause so a WS blink (network switch, page
      // navigation) doesn't pause the game for everyone. onAlarm pauses if
      // the host is still gone when this fires.
      if (this.state.status === "playing" && !this.state.settings.paused && this.state.phaseDeadline) {
        this.state.hostPauseDeadline = Date.now() + 2500;
      }
      this.scheduleNextAlarm();
      this.broadcastState();
      return; // host is not in players array, so skip the rest
    }

    // Mark the player as disconnected
    const player = this.state.players.find(
      (p) => p.sessionId === conn.id,
    );
    if (player) {
      player.isConnected = false;
      player.lastSeen = Date.now();

      // Auto-pause if playing
      if (this.state.status === "playing" && !this.state.settings.paused && this.state.phaseDeadline) {
        const remaining = Math.max(0, this.state.phaseDeadline - Date.now());
        this.state.settings.paused = true;
        this.state.settings.pausedAt = Date.now();
        this.state.settings.pausedRemaining = remaining;
        this.state.phaseDeadline = undefined;
      }

      this.broadcastState();
    }
  }

  /** ── Message handling ── */

  async onMessage(raw: string, sender: Party.Connection) {
    // Global inbound cap before JSON.parse — larger than any legal payload
    // (drawings are capped at MAX_DRAWING_BYTES in the game handlers).
    if (raw.length > 512_000) {
      this.sendError(sender, "Beskeden er for stor");
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendError(sender, "Ugyldig besked");
      return;
    }

    // console.log(`[${this.state.code}] ${msg.type} from ${sender.id}`, msg.type === "join" ? msg.name : "");

    // Authorize host-only actions by the connection identity, never by a
    // client-supplied hostId. conn.id === the sessionId the socket connected
    // with, and hostConnect binds hostId to that sessionId, so the real host's
    // connection is the only one whose id equals hostId. This makes the hostId
    // that ships in every snapshot useless for impersonation.
    if (HOST_ONLY_TYPES.has(msg.type) && sender.id !== this.state.hostId) {
      return;
    }

    try {
      switch (msg.type) {
        case "join":
          this.handleJoin(sender, msg.sessionId, msg.name, msg.avatar);
          break;
        case "rejoin":
          this.handleRejoin(sender, msg.sessionId);
          break;
        case "changeGameType":
          this.handleChangeGameType(msg.hostId, msg.gameType);
          break;
        case "startGame":
          this.handleStartGame(msg.hostId);
          break;
        case "submitAnswer":
          // Player actions are keyed on the connection identity (conn.id ===
          // sessionId), never the payload field — same rationale as hostId.
          this.handleSubmitAnswer(sender.id, msg.content, msg.phase);
          break;
        case "hostAdvance":
          this.handleHostAdvance(msg.hostId);
          break;
        case "updateSettings":
          this.handleUpdateSettings(msg.hostId, msg.settings);
          break;
        case "backToLobby":
          this.handleBackToLobby(msg.hostId);
          break;
        case "restartGame":
          this.handleRestartGame(msg.hostId);
          break;
        case "continueGame":
          this.handleContinueGame(msg.hostId);
          break;
        case "kickPlayer":
          this.handleKickPlayer(msg.hostId, msg.playerId);
          break;
        case "changeAvatar":
          this.handleChangeAvatar(sender.id, msg.avatar);
          break;
        case "leaveRoom":
          this.handleLeaveRoom(sender, sender.id);
          break;
        case "morphAdvanceReveal":
          this.handleMorphAdvanceReveal(msg.hostId);
          break;
        case "hostConnect":
          // Async handlers awaites INDE i try/catch, så danske fejl når sendError
          await this.handleHostConnect(sender, msg.sessionId, msg.hostSecret, msg.license);
          break;
        case "redeemLicense":
          await this.handleRedeemLicense(sender, msg.code, msg.requestId);
          break;
      }
    } catch (err) {
      this.sendError(sender, err instanceof Error ? err.message : "Serverfejl");
    }
  }

  /** ── Timer alarm (replaces Convex scheduled functions) ── */

  async onAlarm() {
    const now = Date.now();

    // A stale alarm woke an empty room (nobody connected, no game running) —
    // treat it as closed instead of keeping a dead room alive in storage.
    const hasConnections = [...this.room.getConnections()].length > 0;
    if (!hasConnections && this.state.status !== "playing") {
      await this.room.storage.deleteAll();
      await this.room.storage.deleteAlarm();
      this.state = this.freshState();
      return;
    }

    // Check host disconnect timeout
    if (this.state.hostDisconnectDeadline && now >= this.state.hostDisconnectDeadline && !this.state.hostConnected) {
      // Host gone too long — notify all clients and close room
      for (const conn of this.room.getConnections()) {
        conn.send(JSON.stringify({ type: "roomClosed", reason: "Værten har forladt spillet" }));
      }
      this.state.status = "finished";
      this.state.hostDisconnectDeadline = undefined;
      this.state.hostPauseDeadline = undefined;
      this.broadcastState();
      return;
    }
    // Clear expired deadline
    if (this.state.hostDisconnectDeadline && now >= this.state.hostDisconnectDeadline) {
      this.state.hostDisconnectDeadline = undefined;
    }

    // Host-disconnect grace expired — pause if the host is still gone
    if (this.state.hostPauseDeadline && now >= this.state.hostPauseDeadline) {
      this.state.hostPauseDeadline = undefined;
      if (
        !this.state.hostConnected &&
        this.state.status === "playing" &&
        !this.state.settings.paused &&
        this.state.phaseDeadline
      ) {
        this.state.settings.paused = true;
        this.state.settings.pausedAt = now;
        this.state.settings.pausedRemaining = Math.max(0, this.state.phaseDeadline - now);
        this.state.phaseDeadline = undefined;
        this.scheduleNextAlarm();
        this.broadcastState();
        return;
      }
    }

    // Phase timer
    if (this.state.status !== "playing" || this.state.settings.paused) {
      this.scheduleNextAlarm();
      return;
    }
    // Staleness guard: only advance when the current deadline has actually
    // passed — an alarm armed for an older phase must not skip the new one.
    if (!this.state.phaseDeadline || now < this.state.phaseDeadline - 50) {
      this.scheduleNextAlarm();
      return;
    }

    this.safeAdvance("TIMER_EXPIRED");
    this.scheduleNextAlarm();
    this.broadcastState();
  }

  /** ── Handlers ── */

  private handleJoin(conn: Party.Connection, sessionId: string, name: string, avatarInput?: unknown) {
    const trimmedName = name.trim().slice(0, 16);
    if (!trimmedName) throw new Error("Navn er påkrævet");

    // Check for existing player (reconnect)
    const existing = this.state.players.find((p) => p.sessionId === sessionId);
    if (existing) {
      existing.isConnected = true;
      existing.lastSeen = Date.now();
      const response: ServerMessage = { type: "joined", playerId: existing.id, roomCode: this.state.code };
      conn.send(JSON.stringify(response));
      this.broadcastState();
      return;
    }

    if (this.state.status !== "lobby") {
      // Safety net: a player whose session was lost (new device/cleared
      // storage) can reclaim their disconnected seat by name mid-game.
      const reclaim = this.state.players.find(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && !p.isConnected,
      );
      if (reclaim) {
        reclaim.sessionId = sessionId;
        reclaim.isConnected = true;
        reclaim.lastSeen = Date.now();
        const response: ServerMessage = { type: "joined", playerId: reclaim.id, roomCode: this.state.code };
        conn.send(JSON.stringify(response));
        this.broadcastState();
        return;
      }
      throw new Error("Spillet er allerede i gang");
    }
    if (this.state.players.length >= MAX_PLAYERS) throw new Error(`Rummet er fuldt (max ${MAX_PLAYERS})`);

    // Check name uniqueness
    if (this.state.players.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error("Navnet er allerede taget");
    }

    const spec = sanitizeAvatarSpec(avatarInput);
    // Ønsket farve honoreres kun hvis den er ledig — join-defaults er tilfældige,
    // og spillerne skal kunne skelnes fra start. Frit farvevalg (inkl. dubletter)
    // er stadig muligt via changeAvatar i lobbyen.
    const usedColors = this.state.players.map((p) => p.avatarColor);
    const wantedColor = spec ? AVATAR_PALETTE[spec.color] : undefined;
    const player: Player = {
      id: generateId(),
      name: trimmedName,
      sessionId,
      avatarColor:
        wantedColor && !usedColors.includes(wantedColor)
          ? wantedColor
          : getAvatarColor(usedColors),
      avatar: spec ? traitsOf(spec) : undefined,
      score: 0,
      isConnected: true,
      lastSeen: Date.now(),
    };
    this.state.players.push(player);
    // console.log(`[${this.state.code}] player added: "${player.name}" (${player.id}), total: ${this.state.players.length}`);

    const response: ServerMessage = { type: "joined", playerId: player.id, roomCode: this.state.code };
    conn.send(JSON.stringify(response));
    this.broadcastState();
  }

  private handleRejoin(conn: Party.Connection, sessionId: string) {
    // console.log(`[${this.state.code}] rejoin attempt: ${sessionId}, found: ${!!this.state.players.find((p) => p.sessionId === sessionId)}`);
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (player) {
      player.isConnected = true;
      player.lastSeen = Date.now();
      const response: ServerMessage = { type: "joined", playerId: player.id, roomCode: this.state.code };
      conn.send(JSON.stringify(response));
      this.broadcastState();
      return;
    }
    // Unknown session — tell the client explicitly so it can fall back to the
    // join screen instead of waiting forever on a silent no-op.
    const response: ServerMessage = { type: "rejoinFailed" };
    conn.send(JSON.stringify(response));
  }

  private handleChangeGameType(hostId: string, gameType: string) {
    if (this.state.hostId !== hostId) return;
    // Only selectable in the lobby — switching mid-game would feed the new
    // game's handlers the old game's phase/phaseData and corrupt the state.
    if (this.state.status !== "lobby") return;
    // Ukendt-tjek FØR registry-opslag: registry kaster en engelsk exception,
    // og en vilkårlig klient-streng må ikke ende i state. Tom streng = fravælg.
    if (gameType && !hasGameHandlers(gameType)) throw new Error("Ukendt spil");
    if (gameType && !this.canPlay(gameType)) throw new Error("Dette spil kræver Dystn-pakken");
    this.state.gameType = gameType || undefined;
    this.broadcastState();
  }

  private handleStartGame(hostId: string) {
    if (this.state.hostId !== hostId) throw new Error("Kun værten kan starte spillet");
    if (this.state.status !== "lobby") throw new Error("Spillet er allerede i gang");
    if (!this.state.gameType) throw new Error("Der er ikke valgt et spil");
    // Forsvar i dybden: changeGameType guarder allerede, men et persisteret
    // gameType fra før guarden (eller en direkte startGame) må ikke slippe forbi.
    if (!this.canPlay(this.state.gameType)) throw new Error("Dette spil kræver Dystn-pakken");

    const handlers = getGameHandlers(this.state.gameType);
    const config = handlers.config ?? {};
    const minPlayers = config.minPlayers ?? MIN_PLAYERS;
    if (this.state.players.length < minPlayers) {
      throw new Error(`Kræver mindst ${minPlayers} spillere`);
    }
    const firstPhase = config.initialPhase ?? "submit";
    const totalRounds = config.totalRoundsForPlayerCount
      ? config.totalRoundsForPlayerCount(this.state.players.length)
      : Math.min(this.state.players.length, 3);

    this.state.status = "playing";
    this.state.currentPhase = firstPhase;
    this.state.roundNumber = 1;
    this.state.totalRounds = totalRounds;
    this.state.submissions = [];
    this.state.phaseVersion = 0;

    const roundData = handlers.setupRound(this.state);
    this.state.phaseData = roundData;

    const duration = getPhaseDuration(firstPhase, this.state.settings);
    // The GameIntro overlay covers clients for ~6.4s after start — give the
    // first phase that time back so the intro doesn't eat answer time.
    const introDelay = this.state.settings.showIntro ? 6_500 : 0;
    this.state.phaseDeadline = Date.now() + duration + introDelay;

    this.scheduleNextAlarm();
    this.broadcastState();
  }

  private handleSubmitAnswer(sessionId: string, content: unknown, clientPhase?: string) {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (!player) throw new Error("Spilleren blev ikke fundet");
    if (this.state.status !== "playing" || !this.state.gameType) return;

    const phase = this.state.currentPhase ?? "";
    const base = phase.split("_")[0];
    if (!["submit", "vote", "draw", "guess", "write", "commit", "clue"].includes(base)) return;

    // A submission that raced a phase flip must not count toward the new
    // phase (e.g. a fusk fake-text stored as a vote, or a drawing object
    // String()'ed into a guess). Clients stamp the phase they answered in;
    // drop mismatches silently — the results for that phase are already final.
    if (clientPhase !== undefined && clientPhase !== phase) return;

    // Check deadline (2s grace), skip if paused
    if (!this.state.settings.paused && this.state.phaseDeadline && Date.now() > this.state.phaseDeadline + 2000) {
      return;
    }

    const handlers = getGameHandlers(this.state.gameType);
    const isVote = base === "vote";

    if (isVote) {
      handlers.onVote(this.state, player, content);
    } else {
      handlers.onSubmission(this.state, player, content);
    }

    this.checkAllSubmitted();
    this.broadcastState();
  }

  /**
   * Advance the phase early when every expected submitter has delivered. Only
   * count players who are connected (or already submitted) — otherwise a
   * dropped player makes the phase wait out the full timer even after
   * "fortsæt alligevel". Also called when a player leaves mid-phase: if the
   * last outstanding player leaves, the rest shouldn't wait out the timer.
   */
  private checkAllSubmitted() {
    if (this.state.status !== "playing" || !this.state.gameType) return;
    const base = (this.state.currentPhase ?? "").split("_")[0];
    if (!["submit", "vote", "draw", "guess", "write", "commit", "clue"].includes(base)) return;

    const handlers = getGameHandlers(this.state.gameType);
    const currentPhase = this.state.currentPhase ?? "";
    const phaseSubmissions = this.state.submissions.filter(
      (s) => s.round === this.state.roundNumber && s.phase === currentPhase,
    );
    const submittedIds = new Set(phaseSubmissions.map((s) => s.playerId));
    const presentCount = this.state.players.filter(
      (p) => p.isConnected || submittedIds.has(p.id),
    ).length;
    const expectedCount = handlers.getExpectedSubmitterCount
      ? Math.min(handlers.getExpectedSubmitterCount(this.state), presentCount)
      : presentCount;

    if (expectedCount > 0 && phaseSubmissions.length >= expectedCount) {
      this.safeAdvance("ALL_SUBMITTED");
      this.scheduleNextAlarm();
    }
  }

  private handleHostAdvance(hostId: string) {
    if (this.state.hostId !== hostId) return;
    if (this.state.status !== "playing") return;
    // Ignore a second advance fired right after the first (double-click / the
    // reveal button plus the always-visible Skip button) so a whole phase or
    // round is never skipped in one burst.
    const now = Date.now();
    if (now - this.lastAdvanceAt < HOST_ADVANCE_DEBOUNCE_MS) return;
    this.lastAdvanceAt = now;
    this.safeAdvance("HOST_ADVANCE");
    this.scheduleNextAlarm();
    this.broadcastState();
  }

  private handleUpdateSettings(hostId: string, settings: Record<string, unknown>) {
    if (this.state.hostId !== hostId) return;
    // Whitelist: a raw Object.assign would let a crafted message set the
    // reserved pause keys (paused/pausedAt/pausedRemaining) or anything else.
    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_SETTINGS_KEYS.has(key)) {
        this.state.settings[key] = value;
      }
    }
    this.broadcastState();
  }

  private resetToLobby(clearGameType: boolean) {
    this.state.status = "lobby";
    if (clearGameType) this.state.gameType = undefined;
    this.state.currentPhase = undefined;
    this.state.phaseData = undefined;
    this.state.phaseDeadline = undefined;
    this.state.roundNumber = undefined;
    this.state.totalRounds = undefined;
    this.state.submissions = [];
    for (const p of this.state.players) p.score = 0;
    delete this.state.settings.paused;
    delete this.state.settings.pausedAt;
    delete this.state.settings.pausedRemaining;
  }

  private handleBackToLobby(hostId: string) {
    if (this.state.hostId !== hostId) return;
    this.resetToLobby(true);
    this.broadcastState();
  }

  private handleRestartGame(hostId: string) {
    if (this.state.hostId !== hostId) return;
    this.resetToLobby(false);
    this.broadcastState();
  }

  private handleContinueGame(hostId: string) {
    if (this.state.hostId !== hostId) return;
    if (!this.state.settings.paused) return;

    const remaining = (this.state.settings.pausedRemaining as number) ?? 0;

    // Clear host disconnect deadline when host reconnects and unpauses
    this.state.hostDisconnectDeadline = undefined;
    this.state.hostPauseDeadline = undefined;

    delete this.state.settings.paused;
    delete this.state.settings.pausedAt;
    delete this.state.settings.pausedRemaining;

    if (remaining > 0) {
      this.state.phaseDeadline = Date.now() + remaining;
    } else if (this.state.status === "playing") {
      // Resuming with no time left: an undefined deadline while playing would
      // leave the phase hanging forever — advance it immediately instead.
      this.safeAdvance("TIMER_EXPIRED");
    }

    this.scheduleNextAlarm();
    this.broadcastState();
  }

  private handleKickPlayer(hostId: string, playerId: string) {
    if (this.state.hostId !== hostId) return;
    if (this.state.status !== "lobby") return;

    const idx = this.state.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;

    const player = this.state.players[idx];
    this.state.players.splice(idx, 1);

    // Notify the kicked player's connection
    for (const conn of this.room.getConnections()) {
      if (conn.id === player.sessionId) {
        const msg: ServerMessage = { type: "kicked" };
        conn.send(JSON.stringify(msg));
      }
    }

    this.broadcastState();
  }

  private handleChangeAvatar(sessionId: string, avatarInput: unknown) {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (!player) return;
    const spec = sanitizeAvatarSpec(avatarInput);
    if (!spec) return;
    player.avatarColor = AVATAR_PALETTE[spec.color];
    player.avatar = traitsOf(spec);
    this.broadcastState();
  }

  private handleLeaveRoom(conn: Party.Connection, sessionId: string) {
    const idx = this.state.players.findIndex((p) => p.sessionId === sessionId);
    if (idx !== -1) {
      this.state.players.splice(idx, 1);
      // If the leaver was the last outstanding submitter, advance now instead
      // of making everyone else wait out the full phase timer.
      this.checkAllSubmitted();
      this.broadcastState();
    }
    conn.close();
  }

  private handleMorphAdvanceReveal(hostId: string) {
    if (this.state.hostId !== hostId) return;
    if (this.state.gameType !== "morph") return;
    if (this.state.currentPhase !== "reveal") return;
    const now = Date.now();
    if (now - this.lastAdvanceAt < HOST_ADVANCE_DEBOUNCE_MS) return;
    this.lastAdvanceAt = now;

    const pd = (this.state.phaseData ?? {}) as any;
    const chains: any[] = pd.chains ?? [];
    const chainIndex: number = pd.revealChainIndex ?? 0;
    const stepIndex: number = pd.revealStepIndex ?? 0;
    const chainLength = chains[chainIndex]?.length ?? 0;

    if (stepIndex < chainLength - 1) {
      this.state.phaseData = { ...pd, revealStepIndex: stepIndex + 1 };
    } else if (chainIndex < chains.length - 1) {
      this.state.phaseData = { ...pd, revealChainIndex: chainIndex + 1, revealStepIndex: 0 };
    } else {
      this.state.status = "finished";
      this.state.currentPhase = "finished";
      this.state.phaseDeadline = undefined;
    }

    this.broadcastState();
  }

  private async handleHostConnect(
    conn: Party.Connection,
    sessionId: string,
    hostSecret: string,
    license?: string,
  ) {
    // Claim-beslutningen afgøres på secret'en alene — en medbragt licenskode
    // ignoreres helt ved forkert secret.
    if (this.state.hostSecret && this.state.hostSecret !== hostSecret) {
      conn.send(JSON.stringify({ type: "hostClaimed", success: false }));
      return;
    }
    const isFirstClaim = !this.state.hostSecret;

    // Validér en evt. medbragt kode FÆRDIGT før nogen state-mutation
    // (async-reglen: aldrig mutation → await → mutation).
    let licenseOutcome: LicenseOutcome | null = null;
    if (typeof license === "string" && license.length > 0 && license.length <= 64) {
      licenseOutcome = await this.validateLicense(license, null);
      // En anden connection kan have claimet rummet, mens vi awaitede
      if (this.state.hostSecret && this.state.hostSecret !== hostSecret) {
        conn.send(JSON.stringify({ type: "hostClaimed", success: false }));
        return;
      }
    }

    if (isFirstClaim) this.state.hostSecret = hostSecret;
    this.state.hostId = sessionId;
    this.state.hostConnected = true;
    this.state.hostLastSeen = Date.now();
    this.state.hostDisconnectDeadline = undefined;
    this.state.hostPauseDeadline = undefined;
    // Monotoni: gyldig kode udvider entitlements; ugyldig/manglende rører intet
    if (licenseOutcome?.ok) this.grantEntitlements(licenseOutcome.packs);

    conn.send(JSON.stringify({ type: "hostClaimed", success: true }));
    // licenseResult sendes KUN når en kode faktisk var medsendt — en host uden
    // kode må ikke få et fejl-toast ud af ingenting.
    if (licenseOutcome) {
      const msg: ServerMessage = licenseOutcome.ok
        ? { type: "licenseResult", ok: true, packs: [...this.state.entitlements] }
        : {
            type: "licenseResult",
            ok: false,
            packs: [...this.state.entitlements],
            reason: licenseOutcome.reason,
          };
      conn.send(JSON.stringify(msg));
    }
    if (!isFirstClaim) this.scheduleNextAlarm(); // reschedule without the host disconnect deadline
    this.broadcastState();
  }

  /** ── Licens ── */

  private requiredPack(gameType: string): string {
    // Fail-closed: ukendt spil eller manglende pack-config behandles som
    // betalt — et nyt spil kan aldrig tavst blive gratis.
    if (!hasGameHandlers(gameType)) return LOCKED_PACK;
    return getGameHandlers(gameType).config?.pack ?? LOCKED_PACK;
  }

  private canPlay(gameType: string): boolean {
    const pack = this.requiredPack(gameType);
    return pack === "free" || this.state.entitlements.includes(pack);
  }

  /** Union-skrivning — entitlements er monotone, aldrig `= packs` */
  private grantEntitlements(packs: string[]) {
    for (const pack of packs) {
      if (!this.state.entitlements.includes(pack)) this.state.entitlements.push(pack);
    }
  }

  /**
   * Fælles validering for redeemLicense, onRequest og hostConnect-medbragte
   * koder: cooldown-tjek (sync) → verify (await) → tæller-mutation. Throttlen
   * er pr. throttleKey (se licenseThrottle). throttleKey null (hostConnect) ⇒
   * hverken tjek eller tælling: kilden er secret-gated, og en gemt kode, der
   * auto-medsendes ved hver reconnect, må aldrig kunne brænde værtens forsøg.
   */
  private async validateLicense(code: string, throttleKey: string | null): Promise<LicenseOutcome> {
    const now = Date.now();
    if (this.licenseThrottle.size >= LICENSE_THROTTLE_SWEEP) {
      for (const [key, entry] of this.licenseThrottle) {
        if (!entry.cooldownUntil || now >= entry.cooldownUntil) this.licenseThrottle.delete(key);
      }
    }
    if (throttleKey) {
      const entry = this.licenseThrottle.get(throttleKey);
      if (entry?.cooldownUntil) {
        if (now < entry.cooldownUntil) return { ok: false, reason: "rateLimited" };
        this.licenseThrottle.delete(throttleKey);
      }
    }
    const keyring = keyringFromEnv(this.room.env);
    const denylist = denylistFromEnv(this.room.env);
    const result = await verifyLicense(code, keyring, denylist);
    if (result.ok) {
      if (throttleKey) this.licenseThrottle.delete(throttleKey);
      return { ok: true, packs: result.packs };
    }
    if (throttleKey) {
      const entry = this.licenseThrottle.get(throttleKey) ?? { fails: 0 };
      entry.fails += 1;
      if (entry.fails >= LICENSE_MAX_FAILS) entry.cooldownUntil = now + LICENSE_COOLDOWN_MS;
      this.licenseThrottle.set(throttleKey, entry);
    }
    return { ok: false, reason: result.reason };
  }

  private async handleRedeemLicense(conn: Party.Connection, code: string, requestId?: string) {
    // Ekko kun et velformet requestId — klienten korrelerer sit svar på det,
    // så en samtidig auto-indløsning aldrig kan forveksles med modalens egen.
    const reqId = typeof requestId === "string" && requestId.length <= 64 ? requestId : undefined;
    if (typeof code !== "string" || code.length === 0 || code.length > 64) {
      const msg: ServerMessage = {
        type: "licenseResult",
        ok: false,
        packs: [...this.state.entitlements],
        reason: "invalid",
        requestId: reqId,
      };
      conn.send(JSON.stringify(msg));
      return;
    }
    const result = await this.validateLicense(code, `ws:${conn.id}`);
    if (result.ok) {
      this.grantEntitlements(result.packs);
      const msg: ServerMessage = {
        type: "licenseResult",
        ok: true,
        packs: [...this.state.entitlements],
        requestId: reqId,
      };
      conn.send(JSON.stringify(msg));
      this.broadcastState();
    } else {
      const msg: ServerMessage = {
        type: "licenseResult",
        ok: false,
        packs: [...this.state.entitlements],
        reason: result.reason,
        requestId: reqId,
      };
      conn.send(JSON.stringify(msg));
    }
  }

  /**
   * Cross-device-indløsning (spec §3.2): /tak-siden POST'er rumkoden + koden
   * direkte til rummets DO. Endpointet kan kun TILFØJE entitlements — aldrig
   * fjerne eller læse noget — så det er ufarligt uden auth.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const headers = { ...cors, "Content-Type": "application/json" };
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "methodNotAllowed" }), { status: 405, headers });
    }

    let code: unknown;
    try {
      const body = (await req.json()) as { code?: unknown };
      code = body?.code;
    } catch {
      return new Response(JSON.stringify({ error: "badRequest" }), { status: 400, headers });
    }
    if (typeof code !== "string" || code.length === 0 || code.length > 64) {
      return new Response(JSON.stringify({ error: "badRequest" }), { status: 400, headers });
    }

    // Uclaimet DO = rumkoden findes ikke (tastefejl på /tak)
    if (!this.state.hostSecret) {
      return new Response(JSON.stringify({ error: "roomNotFound" }), { status: 404, headers });
    }

    // Throttle pr. afsender-IP — endpointet er uautentificeret, og en gæst
    // med rumkoden må ikke kunne holde værtens egen indløsning i cooldown.
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const result = await this.validateLicense(code, `http:${ip}`);
    if (result.ok) {
      this.grantEntitlements(result.packs);
      this.broadcastState();
      return new Response(
        JSON.stringify({ ok: true, packs: [...this.state.entitlements] }),
        { status: 200, headers },
      );
    }
    return new Response(JSON.stringify({ ok: false, reason: result.reason }), { status: 200, headers });
  }

  /** ── Broadcasting ── */

  private broadcastState() {
    for (const conn of this.room.getConnections()) {
      this.sendToConnection(conn);
    }
    this.persist();
  }

  /**
   * Persist state so redeploys/evictions don't reset the room. Every state
   * mutation ends in broadcastState(), so this is the single write point.
   * Fire-and-forget: DO output gates coalesce and order the writes.
   */
  private persist() {
    void this.room.storage.put("state", this.state);
  }

  private sendToConnection(conn: Party.Connection) {
    const sessionId = conn.id;
    const snapshot = this.buildSnapshot(sessionId);
    const msg: ServerMessage = { type: "room", data: snapshot };
    conn.send(JSON.stringify(msg));
  }

  private buildSnapshot(sessionId: string): RoomSnapshot {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    const currentPhase = this.state.currentPhase ?? "";

    // Get submissions for current phase to compute hasSubmitted
    const phaseSubmissions = this.state.submissions.filter(
      (s) => s.round === this.state.roundNumber && s.phase === currentPhase,
    );
    const submittedPlayerIds = new Set(phaseSubmissions.map((s) => s.playerId));

    // Filter phaseData per player (hide secrets)
    let filteredPhaseData = this.state.phaseData;
    if (this.state.gameType && this.state.status === "playing") {
      try {
        const handlers = getGameHandlers(this.state.gameType);
        filteredPhaseData = handlers.filterForPlayer(this.state, player ?? null);
      } catch {
        // fallback to raw data
      }
    }

    return {
      _id: this.roomId,
      code: this.state.code,
      hostId: this.state.hostId,
      gameType: this.state.gameType,
      status: this.state.status,
      currentPhase: this.state.currentPhase,
      phaseData: filteredPhaseData,
      phaseDeadline: this.state.phaseDeadline,
      roundNumber: this.state.roundNumber,
      totalRounds: this.state.totalRounds,
      settings: this.state.settings,
      players: this.state.players.map((p) => ({
        _id: p.id,
        name: p.name,
        avatarColor: p.avatarColor,
        avatar: p.avatar,
        score: p.score,
        isConnected: p.isConnected,
        hasSubmitted: submittedPlayerIds.has(p.id),
      })),
      hostConnected: this.state.hostConnected,
      currentPlayerId: player?.id,
      // Whitelist: kun pakke-listen — aldrig failCount/cooldown, aldrig koden
      entitlements: this.state.entitlements,
    };
  }

  private sendError(conn: Party.Connection, message: string) {
    const msg: ServerMessage = { type: "error", message };
    conn.send(JSON.stringify(msg));
  }

  /** ── Alarm scheduling ── */

  private scheduleNextAlarm() {
    const deadlines: number[] = [];
    const now = Date.now();
    if (this.state.phaseDeadline && this.state.phaseDeadline > now) {
      deadlines.push(this.state.phaseDeadline);
    }
    if (this.state.hostDisconnectDeadline && this.state.hostDisconnectDeadline > now) {
      deadlines.push(this.state.hostDisconnectDeadline);
    }
    if (this.state.hostPauseDeadline && this.state.hostPauseDeadline > now) {
      deadlines.push(this.state.hostPauseDeadline);
    }
    if (deadlines.length > 0) {
      this.room.storage.setAlarm(Math.min(...deadlines));
    }
  }
}

DystnServer satisfies Party.Worker;

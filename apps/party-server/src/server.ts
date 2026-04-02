import type * as Party from "partykit/server";
import type {
  RoomState,
  ClientMessage,
  ServerMessage,
  RoomSnapshot,
  Player,
} from "./types";
import { advancePhase, getPhaseDuration } from "./phase";
import { getGameHandlers } from "./registry";
import { getAvatarColor } from "./colors";

// Register all game handlers (must be after registry is loaded)
import "./games/blitz";
import "./games/fusk";
import "./games/scrawl";
import "./games/surge";
import "./games/morph";
import "./games/hunch";

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 1;

/** Generate a 4-char room code from the party room ID */
function roomCodeFromId(id: string): string {
  return id.slice(0, 4).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export default class FestspilServer implements Party.Server {
  state: RoomState;
  private readonly roomId: string;

  constructor(readonly room: Party.Room) {
    this.roomId = room.id;
    this.state = {
      code: roomCodeFromId(room.id),
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
    };
  }

  /** ── Connection lifecycle ── */

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // console.log(`[${this.state.code}] connect: ${conn.id}, players: ${this.state.players.length}, host: ${this.state.hostId || "(none)"}`);

    // Host reconnect (same sessionId from PartySocket)
    if (conn.id === this.state.hostId) {
      this.state.hostConnected = true;
      this.state.hostLastSeen = Date.now();
      // Cancel host disconnect deadline if pending
      if (this.state.hostDisconnectDeadline) {
        this.state.hostDisconnectDeadline = undefined;
      }
    }

    // Reconnecting player — mark as connected
    const player = this.state.players.find((p) => p.sessionId === conn.id);
    if (player) {
      player.isConnected = true;
      player.lastSeen = Date.now();
    }

    // Send current state to the new connection
    this.sendToConnection(conn);
  }

  onClose(conn: Party.Connection) {
    // Host disconnect detection
    if (conn.id === this.state.hostId) {
      this.state.hostConnected = false;
      this.state.hostLastSeen = Date.now();
      // Schedule room cleanup in 5 minutes
      this.state.hostDisconnectDeadline = Date.now() + 5 * 60 * 1000;
      this.scheduleNextAlarm();
      // Auto-pause if playing
      if (this.state.status === "playing" && !this.state.settings.paused && this.state.phaseDeadline) {
        const remaining = Math.max(0, this.state.phaseDeadline - Date.now());
        this.state.settings.paused = true;
        this.state.settings.pausedAt = Date.now();
        this.state.settings.pausedRemaining = remaining;
        this.state.phaseDeadline = undefined;
      }
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

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendError(sender, "Invalid message");
      return;
    }

    // console.log(`[${this.state.code}] ${msg.type} from ${sender.id}`, msg.type === "join" ? msg.name : "");

    try {
      switch (msg.type) {
        case "join":
          this.handleJoin(sender, msg.sessionId, msg.name, msg.avatarImage);
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
          this.handleSubmitAnswer(msg.sessionId, msg.content);
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
          this.handleChangeAvatar(msg.sessionId, msg.avatarImage);
          break;
        case "leaveRoom":
          this.handleLeaveRoom(sender, msg.sessionId);
          break;
        case "morphAdvanceReveal":
          this.handleMorphAdvanceReveal(msg.hostId);
          break;
        case "hostConnect":
          this.handleHostConnect(sender, msg.sessionId, msg.hostSecret);
          break;
      }
    } catch (err) {
      this.sendError(sender, err instanceof Error ? err.message : "Server error");
    }
  }

  /** ── Timer alarm (replaces Convex scheduled functions) ── */

  async onAlarm() {
    const now = Date.now();

    // Check host disconnect timeout
    if (this.state.hostDisconnectDeadline && now >= this.state.hostDisconnectDeadline && !this.state.hostConnected) {
      // Host gone too long — notify all clients and close room
      for (const conn of this.room.getConnections()) {
        conn.send(JSON.stringify({ type: "roomClosed", reason: "Værten har forladt spillet" }));
      }
      this.state.status = "finished";
      this.state.hostDisconnectDeadline = undefined;
      this.broadcastState();
      return;
    }
    // Clear expired deadline
    if (this.state.hostDisconnectDeadline && now >= this.state.hostDisconnectDeadline) {
      this.state.hostDisconnectDeadline = undefined;
    }

    // Existing phase timer logic
    if (this.state.status !== "playing") return;
    if (this.state.settings.paused) return;

    advancePhase(this.state, "TIMER_EXPIRED");
    this.scheduleNextAlarm();
    this.broadcastState();
  }

  /** ── Handlers ── */

  private handleJoin(conn: Party.Connection, sessionId: string, name: string, avatarImage?: string) {
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

    if (this.state.status !== "lobby") throw new Error("Spillet er allerede i gang");
    if (this.state.players.length >= MAX_PLAYERS) throw new Error(`Rummet er fuldt (max ${MAX_PLAYERS})`);

    // Check name uniqueness
    if (this.state.players.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error("Navnet er allerede taget");
    }

    const player: Player = {
      id: generateId(),
      name: trimmedName,
      sessionId,
      avatarColor: getAvatarColor(this.state.players.length),
      avatarImage,
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
    }
  }

  private handleChangeGameType(hostId: string, gameType: string) {
    if (this.state.hostId !== hostId) return;
    this.state.gameType = gameType || undefined;
    this.broadcastState();
  }

  private handleStartGame(hostId: string) {
    if (this.state.hostId !== hostId) throw new Error("Only the host can start");
    if (this.state.status !== "lobby") throw new Error("Game already started");
    if (!this.state.gameType) throw new Error("No game selected");
    if (this.state.players.length < MIN_PLAYERS) throw new Error("Not enough players");

    const handlers = getGameHandlers(this.state.gameType);
    const config = handlers.config ?? {};
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
    this.state.phaseDeadline = Date.now() + duration;

    this.scheduleNextAlarm();
    this.broadcastState();
  }

  private handleSubmitAnswer(sessionId: string, content: unknown) {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (!player) throw new Error("Player not found");
    if (this.state.status !== "playing" || !this.state.gameType) return;

    const phase = this.state.currentPhase ?? "";
    const base = phase.split("_")[0];
    if (!["submit", "vote", "draw", "guess", "write", "commit", "clue"].includes(base)) return;

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

    // Check if all expected players have submitted
    const currentPhase = this.state.currentPhase ?? "";
    const phaseSubmissions = this.state.submissions.filter(
      (s) => s.round === this.state.roundNumber && s.phase === currentPhase,
    );
    const expectedCount = handlers.getExpectedSubmitterCount
      ? handlers.getExpectedSubmitterCount(this.state)
      : this.state.players.length;

    if (phaseSubmissions.length >= expectedCount) {
      advancePhase(this.state, "ALL_SUBMITTED");
      this.scheduleNextAlarm();
    }

    this.broadcastState();
  }

  private handleHostAdvance(hostId: string) {
    if (this.state.hostId !== hostId) return;
    if (this.state.status !== "playing") return;
    advancePhase(this.state, "HOST_ADVANCE");
    this.scheduleNextAlarm();
    this.broadcastState();
  }

  private handleUpdateSettings(hostId: string, settings: Record<string, unknown>) {
    if (this.state.hostId !== hostId) return;
    Object.assign(this.state.settings, settings);
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
    this.state.phaseDeadline = remaining > 0 ? Date.now() + remaining : undefined;

    // Clear host disconnect deadline when host reconnects and unpauses
    this.state.hostDisconnectDeadline = undefined;

    delete this.state.settings.paused;
    delete this.state.settings.pausedAt;
    delete this.state.settings.pausedRemaining;

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

  private handleChangeAvatar(sessionId: string, avatarImage: string) {
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (!player) return;
    player.avatarImage = avatarImage || undefined;
    this.broadcastState();
  }

  private handleLeaveRoom(conn: Party.Connection, sessionId: string) {
    const idx = this.state.players.findIndex((p) => p.sessionId === sessionId);
    if (idx !== -1) {
      this.state.players.splice(idx, 1);
      this.broadcastState();
    }
    conn.close();
  }

  private handleMorphAdvanceReveal(hostId: string) {
    if (this.state.hostId !== hostId) return;
    if (this.state.gameType !== "morph") return;
    if (this.state.currentPhase !== "reveal") return;

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

  private handleHostConnect(conn: Party.Connection, sessionId: string, hostSecret: string) {
    // First host connection (room creation)
    if (!this.state.hostSecret) {
      this.state.hostSecret = hostSecret;
      this.state.hostId = sessionId;
      this.state.hostConnected = true;
      this.state.hostLastSeen = Date.now();
      this.state.hostDisconnectDeadline = undefined;
      conn.send(JSON.stringify({ type: "hostClaimed", success: true }));
      this.broadcastState();
      return;
    }

    // Host rejoin: verify secret
    if (this.state.hostSecret === hostSecret) {
      this.state.hostId = sessionId;
      this.state.hostConnected = true;
      this.state.hostLastSeen = Date.now();
      this.state.hostDisconnectDeadline = undefined;
      conn.send(JSON.stringify({ type: "hostClaimed", success: true }));
      this.scheduleNextAlarm(); // reschedule without the host disconnect deadline
      this.broadcastState();
      return;
    }

    // Wrong secret
    conn.send(JSON.stringify({ type: "hostClaimed", success: false }));
  }

  /** ── Broadcasting ── */

  private broadcastState() {
    for (const conn of this.room.getConnections()) {
      this.sendToConnection(conn);
    }
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
        avatarImage: p.avatarImage,
        score: p.score,
        isConnected: p.isConnected,
        hasSubmitted: submittedPlayerIds.has(p.id),
      })),
      hostConnected: this.state.hostConnected,
      currentPlayerId: player?.id,
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
    if (deadlines.length > 0) {
      this.room.storage.setAlarm(Math.min(...deadlines));
    }
  }
}

FestspilServer satisfies Party.Worker;

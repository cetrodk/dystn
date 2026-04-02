import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Swords, Paintbrush, Phone, Scale, Settings } from "lucide-react";

import { useSessionId } from "@/providers/SessionProvider";
import { PartyProvider, useRoom, useSend } from "@/providers/PartyProvider";
import { da } from "@/lib/da";

/* -- Timer & tab definitions ---------------------------------------- */

interface TimerOption {
  key: string;
  label: string;
  desc: string;
  defaultMs: number;
  min: number;
  max: number;
}

const GENERAL_TIMERS: TimerOption[] = [
  { key: "submitTime", label: "Svartid", desc: "Tid til at skrive svar", defaultMs: 60_000, min: 15, max: 180 },
  { key: "voteTime", label: "Stemmetid", desc: "Tid til at stemme", defaultMs: 15_000, min: 10, max: 60 },
  { key: "revealTime", label: "Afsløring", desc: "Vis det rigtige svar", defaultMs: 60_000, min: 15, max: 90 },
  { key: "scoresTime", label: "Pointvisning", desc: "Vis points mellem runder", defaultMs: 8_000, min: 3, max: 20 },
];

const BLITZ_TIMERS: TimerOption[] = [
  { key: "presentTime", label: "Præsentation", desc: "Vis svar før afstemning", defaultMs: 45_000, min: 10, max: 90 },
];

const DRAW_GUESS_TIMERS: TimerOption[] = [
  { key: "drawTime", label: "Tegnetid", desc: "Tid til at tegne", defaultMs: 90_000, min: 30, max: 180 },
  { key: "guessTime", label: "Gættetid", desc: "Tid til at gætte", defaultMs: 45_000, min: 15, max: 90 },
];

const SCRAWL_TIMERS = DRAW_GUESS_TIMERS;

const MORPH_TIMERS: TimerOption[] = [
  { key: "writeTime", label: "Skrivetid", desc: "Tid til at skrive", defaultMs: 60_000, min: 15, max: 120 },
  ...DRAW_GUESS_TIMERS,
];

const SURGE_TIMERS: TimerOption[] = [
  { key: "commitTime", label: "Valgtid", desc: "Tid til at vælge sandt/falsk", defaultMs: 20_000, min: 5, max: 60 },
];

interface TabDef {
  id: string;
  label: string;
  Icon: typeof Swords;
  color: string;
  timers: TimerOption[];
  hasDifficulty?: { settingsKey: string; gameKey: "scrawl" | "surge" };
}

const TABS: TabDef[] = [
  { id: "general", label: "Generelt", Icon: Settings, color: "var(--color-primary)", timers: GENERAL_TIMERS },
  { id: "blitz", label: "Blitz", Icon: Swords, color: "var(--color-blitz)", timers: BLITZ_TIMERS },
  {
    id: "scrawl",
    label: "Scrawl",
    Icon: Paintbrush,
    color: "var(--color-scrawl)",
    timers: SCRAWL_TIMERS,
    hasDifficulty: { settingsKey: "scrawlDifficulty", gameKey: "scrawl" },
  },
  { id: "morph", label: "Morph", Icon: Phone, color: "var(--color-morph)", timers: MORPH_TIMERS },
  {
    id: "surge",
    label: "Surge",
    Icon: Scale,
    color: "var(--color-surge)",
    timers: SURGE_TIMERS,
    hasDifficulty: { settingsKey: "surgeDifficulty", gameKey: "surge" },
  },
];

/* -- Timer Slider --------------------------------------------------- */

function TimerSlider({
  timer,
  settings,
  onChange,
}: {
  timer: TimerOption;
  settings: Record<string, unknown>;
  onChange: (key: string, seconds: number) => void;
}) {
  const currentMs = typeof settings[timer.key] === "number" ? (settings[timer.key] as number) : timer.defaultMs;
  const currentSec = Math.round(currentMs / 1000);

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-base font-semibold">{timer.label}</span>
        <span className="text-base font-mono font-bold text-[var(--color-primary-light)]">
          {currentSec}s
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-1.5">{timer.desc}</p>
      <input
        type="range"
        min={timer.min}
        max={timer.max}
        value={currentSec}
        onChange={(e) => onChange(timer.key, Number(e.target.value))}
        className="w-full cursor-pointer"
      />
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>{timer.min}s</span>
        <span>{timer.max}s</span>
      </div>
    </div>
  );
}

/* -- Difficulty Selector -------------------------------------------- */

function DifficultySelector({
  gameKey,
  color,
  current,
  onChange,
}: {
  gameKey: "scrawl" | "surge";
  color: string;
  current: number;
  onChange: (level: number) => void;
}) {
  const strings = da[gameKey];

  return (
    <div>
      <span className="text-base font-semibold block mb-2">{strings.difficulty}</span>
      <div className="flex gap-2">
        {[1, 2, 3].map((level) => (
          <button
            key={level}
            onClick={() => onChange(level)}
            className="flex-1 rounded-xl p-3 text-center transition-all cursor-pointer border-2"
            style={{
              backgroundColor: current === level ? color : "var(--color-surface)",
              borderColor: current === level ? color : "transparent",
              color: current === level ? "#fff" : "var(--color-text-muted)",
            }}
          >
            <span className="block text-sm font-bold">{strings.difficultyLevels[level - 1]}</span>
            <span className="block text-xs mt-1 opacity-80">{strings.difficultyDescriptions[level - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -- Settings Inner (inside PartyProvider) -------------------------- */

function HostSettingsInner() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const sessionId = useSessionId();
  const room = useRoom();
  const send = useSend();
  const [activeTab, setActiveTab] = useState("general");

  const settings = (room?.settings ?? {}) as Record<string, unknown>;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleTimerChange = useCallback(
    (key: string, seconds: number) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        send({
          type: "updateSettings",
          hostId: sessionId,
          settings: { [key]: seconds * 1000 },
        });
      }, 150);
    },
    [sessionId, send],
  );

  const handleDifficulty = useCallback(
    (key: string, level: number) => {
      send({
        type: "updateSettings",
        hostId: sessionId,
        settings: { [key]: level },
      });
    },
    [sessionId, send],
  );

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[var(--color-text-muted)] animate-gentle-pulse"
        >
          Indlæser...
        </motion.p>
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <motion.nav
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex w-56 shrink-0 flex-col bg-[var(--color-surface)] border-r border-white/5"
      >
        {/* Back + title */}
        <div className="p-5 pb-4">
          <button
            onClick={() => navigate(`/host/${code}`)}
            className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage
          </button>
          <h1 className="font-display text-2xl font-bold">Indstillinger</h1>
        </div>

        {/* Tab buttons */}
        <div className="flex flex-col gap-1 px-3">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer text-left"
                style={{
                  backgroundColor: isActive ? tab.color : "transparent",
                  color: isActive ? "#fff" : "var(--color-text-muted)",
                }}
              >
                <tab.Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.nav>

      {/* Content area */}
      <main className="flex-1 flex items-center justify-center p-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl"
        >
          {/* Tab heading */}
          <div className="flex items-center gap-3 mb-8">
            <currentTab.Icon className="h-6 w-6" style={{ color: currentTab.color }} />
            <h2 className="font-display text-2xl font-bold" style={{ color: currentTab.color }}>
              {currentTab.label}
            </h2>
          </div>

          {/* Difficulty selector if applicable — full width above timers */}
          {currentTab.hasDifficulty && (
            <div className="mb-8">
              <DifficultySelector
                gameKey={currentTab.hasDifficulty.gameKey}
                color={currentTab.color}
                current={
                  typeof settings[currentTab.hasDifficulty.settingsKey] === "number"
                    ? (settings[currentTab.hasDifficulty.settingsKey] as number)
                    : 1
                }
                onChange={(level) => handleDifficulty(currentTab.hasDifficulty!.settingsKey, level)}
              />
            </div>
          )}

          {/* Timers in a 2-column grid */}
          {currentTab.timers.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {currentTab.timers.map((timer) => (
                <div
                  key={timer.key}
                  className="rounded-2xl bg-[var(--color-surface)] p-5"
                >
                  <TimerSlider
                    timer={timer}
                    settings={settings}
                    onChange={handleTimerChange}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              Ingen unikke indstillinger — se Generelt.
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}

/* -- Exported page (wraps in PartyProvider) ------------------------- */

export function HostSettingsPage() {
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
      <HostSettingsInner />
    </PartyProvider>
  );
}

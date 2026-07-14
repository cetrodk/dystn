import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AnimatedLogo, Chip, Logo, SectionHeader } from "@/components/Brand";
import { unlockGate } from "@/lib/gate";
import { normalizeLicenseInput, setStoredLicense, withDashes } from "@/lib/license";
import { da } from "@/lib/da";

// Firmaoplysninger — CVR-linjen vises først, når værdien er udfyldt.
const COMPANY = {
  name: "Cetro",
  cvr: "33222424",
  email: da.license.supportEmail,
};

const GAMES = [
  { key: "blitz", free: true },
  { key: "fusk", free: false },
  { key: "scrawl", free: true },
  { key: "morph", free: false },
  { key: "surge", free: false },
  { key: "hunch", free: false },
] as const;

const sectionReveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { type: "spring", stiffness: 120, damping: 20 },
} as const;

/**
 * Info-/landingsside med produktpræsentation og firmaoplysninger.
 * I gate-mode (midlertidig launch-gate, se lib/gate.ts) er alle veje
 * ind i selve appen skjult, og der vises "vi åbner snart" i stedet.
 */
export function OmPage({ gate = false }: { gate?: boolean }) {
  useEffect(() => {
    document.title = da.om.pageTitle;
    return () => {
      document.title = da.title;
    };
  }, []);

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-14 px-5 py-8 sm:gap-20 sm:px-8 sm:py-10">
      {/* Topbar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        {gate ? (
          <Logo />
        ) : (
          <Link to="/" aria-label={da.om.backToFront}>
            <Logo />
          </Link>
        )}
        {gate ? (
          <Chip>{da.om.comingSoon.toUpperCase()}</Chip>
        ) : (
          <Link
            to="/"
            className="nb-border nb-press rounded-xl bg-[var(--color-primary)] px-4 py-2 font-display text-sm font-bold text-[var(--color-paper)] nb-shadow-sm"
          >
            {da.om.playNow}
          </Link>
        )}
      </motion.header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-start gap-6"
      >
        <Chip>{da.om.heroTagline.toUpperCase()}</Chip>
        <h1 className="font-display text-4xl leading-[1.05] font-bold sm:text-6xl">
          {da.om.heroTitle}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg">
          {da.om.heroBody}
        </p>
        {gate ? (
          <div className="nb-card w-full max-w-xl rounded-2xl p-5">
            <p className="font-display text-lg font-bold">{da.om.comingSoon}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {da.om.comingSoonBody}{" "}
              <a
                href={`mailto:${COMPANY.email}`}
                className="font-semibold text-[var(--color-text)] underline underline-offset-4"
              >
                {COMPANY.email}
              </a>
            </p>
            <GateCodeForm />
          </div>
        ) : (
          <Link
            to="/"
            className="nb-border nb-press rounded-2xl bg-[var(--color-ink)] px-7 py-4 font-display text-lg font-bold text-[var(--color-paper)] nb-shadow"
          >
            {da.om.playNow} &rarr;
          </Link>
        )}
      </motion.section>

      {/* Sådan virker det */}
      <motion.section {...sectionReveal} className="flex flex-col gap-6">
        <SectionHeader n="01" title={da.om.how.title} sub={da.om.how.sub} />
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {da.om.how.steps.map((step, i) => (
            <li key={step.title} className="nb-card flex flex-col gap-2 rounded-2xl p-5">
              <span
                className="grid h-9 w-9 place-items-center rounded-lg font-display text-lg font-bold text-[var(--color-paper)]"
                style={{ background: "var(--color-primary)", rotate: `${i % 2 === 0 ? -3 : 3}deg` }}
              >
                {i + 1}
              </span>
              <h3 className="font-display text-lg font-bold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{step.body}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Spillene */}
      <motion.section {...sectionReveal} className="flex flex-col gap-6">
        <SectionHeader n="02" title={da.om.games.title} sub={da.om.games.sub} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GAMES.map((game) => {
            const meta = da[game.key];
            return (
              <div key={game.key} className="nb-card flex items-start gap-4 rounded-2xl p-5">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] font-display text-xl font-bold text-white nb-border"
                  style={{
                    background: `var(--color-${game.key})`,
                    boxShadow: "3px 3px 0 var(--color-ink)",
                    rotate: "-3deg",
                  }}
                >
                  {meta.name[0]}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{meta.name}</h3>
                    <span className="rounded-full border-2 border-[var(--color-ink)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em]">
                      {game.free ? da.om.games.free.toUpperCase() : da.om.games.inPack.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
                    {meta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Pris */}
      <motion.section {...sectionReveal} className="flex flex-col gap-6">
        <SectionHeader n="03" title={da.om.pricing.title} sub={da.om.pricing.sub} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="nb-card flex flex-col gap-2 rounded-2xl p-6">
            <h3 className="font-display text-lg font-bold">{da.om.pricing.freeTitle}</h3>
            <p className="font-display text-4xl font-bold">{da.om.pricing.freePrice}</p>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
              {da.om.pricing.freeBody}
            </p>
          </div>
          <div
            className="nb-card flex flex-col gap-2 rounded-2xl p-6"
            style={{ background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))" }}
          >
            <h3 className="font-display text-lg font-bold">{da.license.packName}</h3>
            <p className="font-display text-4xl font-bold">
              {da.license.price}{" "}
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                {da.om.pricing.packPriceSuffix}
              </span>
            </p>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
              {da.om.pricing.packBody}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Kontakt & firmaoplysninger */}
      <motion.section {...sectionReveal} className="flex flex-col gap-6">
        <SectionHeader n="04" title={da.om.contact.title} sub={da.om.contact.sub} />
        <div className="nb-card rounded-2xl p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-mono text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-muted)] uppercase sm:pt-0.5">
              {da.om.contact.runBy}
            </dt>
            <dd className="font-semibold">{COMPANY.name}</dd>
            {COMPANY.cvr && (
              <>
                <dt className="font-mono text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-muted)] uppercase sm:pt-0.5">
                  {da.om.contact.cvrLabel}
                </dt>
                <dd className="font-semibold">{COMPANY.cvr}</dd>
              </>
            )}
            <dt className="font-mono text-[11px] font-bold tracking-[0.16em] text-[var(--color-text-muted)] uppercase sm:pt-0.5">
              {da.om.contact.emailLabel}
            </dt>
            <dd>
              <a
                href={`mailto:${COMPANY.email}`}
                className="font-semibold underline underline-offset-4"
              >
                {COMPANY.email}
              </a>
            </dd>
          </dl>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">{da.om.contact.responseNote}</p>
        </div>
      </motion.section>

      {/* Logo-afslutning + footer */}
      <div className="flex flex-col items-center gap-8 pb-2">
        {gate && <AnimatedLogo fontSize="clamp(28px, 6vw, 48px)" />}
        <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-muted)]/60 uppercase">
          <span>{da.om.footer}</span>
          <span aria-hidden>·</span>
          <span>{COMPANY.name}</span>
          {!gate && (
            <>
              <span aria-hidden>·</span>
              <Link to="/" className="underline underline-offset-4 hover:text-[var(--color-text-muted)]">
                {da.om.backToFront}
              </Link>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * "Jeg har en kode" på gate-siden: en licens-/gavekode i gyldigt format
 * gemmes som licens (spillene låses op ved første rum, hvor serveren
 * dømmer signaturen) og låser samtidig gaten op for denne browser.
 */
function GateCodeForm() {
  const [open, setOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [formatError, setFormatError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const canonical = normalizeLicenseInput(codeInput);
    if (!canonical) {
      setFormatError(true);
      return;
    }
    setStoredLicense(withDashes(canonical));
    unlockGate();
    window.location.assign("/");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="nb-border nb-press mt-4 rounded-xl bg-[var(--color-ink)] px-4 py-2.5 font-display text-sm font-bold text-[var(--color-paper)] nb-shadow-sm cursor-pointer"
      >
        {da.om.code.haveCode}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{da.om.code.hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={codeInput}
          onChange={(e) => {
            setCodeInput(e.target.value);
            setFormatError(false);
          }}
          placeholder={da.license.modal.codePlaceholder}
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="nb-border min-w-0 flex-1 rounded-xl bg-[var(--color-paper)] px-3 py-2.5 font-mono text-sm tracking-wider uppercase placeholder:text-[var(--color-text-muted)]/50 focus:outline-none"
        />
        <button
          type="submit"
          className="nb-border nb-press rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-display text-sm font-bold text-[var(--color-paper)] nb-shadow-sm cursor-pointer"
        >
          {da.om.code.submit}
        </button>
      </div>
      {formatError && (
        <p className="text-sm font-semibold text-[var(--color-danger,#c0392b)]">
          {da.license.errors.badFormat}
        </p>
      )}
    </form>
  );
}

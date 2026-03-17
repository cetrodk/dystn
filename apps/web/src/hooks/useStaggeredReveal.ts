import { useCallback, useEffect, useRef, useState } from "react";

/** Timing constants for staggered reveals (ms) */
export const REVEAL_TIMING = {
  introDelay: 2000,
  itemInterval: 3500,
  drumrollDelay: 1500,
  finalRevealDelay: 1500,
  doneDelay: 3000,
} as const;

export type RevealStage = "intro" | "items" | "drumroll" | "final" | "done";

interface UseStaggeredRevealOptions {
  /** Number of items to reveal one at a time */
  itemCount: number;
  /** Called when each item appears */
  onItemReveal?: (index: number) => void;
  /** Called when drumroll starts */
  onDrumroll?: () => void;
  /** Called when the final item is revealed */
  onFinalReveal?: () => void;
  /** Called when the full reveal is done */
  onDone?: () => void;
}

/**
 * Manages a staggered reveal timeline:
 * intro → items (one by one) → drumroll → final → done
 *
 * All timeouts are tracked and cleaned up on unmount.
 * Callbacks are stored in refs to avoid stale closures.
 */
export function useStaggeredReveal({
  itemCount,
  onItemReveal,
  onDrumroll,
  onFinalReveal,
  onDone,
}: UseStaggeredRevealOptions) {
  const [stage, setStage] = useState<RevealStage>("intro");
  const [visibleItems, setVisibleItems] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep callbacks in refs so the timeline always calls the latest version
  const onItemRevealRef = useRef(onItemReveal);
  const onDrumrollRef = useRef(onDrumroll);
  const onFinalRevealRef = useRef(onFinalReveal);
  const onDoneRef = useRef(onDone);
  onItemRevealRef.current = onItemReveal;
  onDrumrollRef.current = onDrumroll;
  onFinalRevealRef.current = onFinalReveal;
  onDoneRef.current = onDone;

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    schedule(() => {
      setStage("items");
      let shown = 0;

      const revealNext = () => {
        if (shown < itemCount) {
          shown++;
          setVisibleItems(shown);
          onItemRevealRef.current?.(shown - 1);
          schedule(revealNext, REVEAL_TIMING.itemInterval);
        } else {
          setStage("drumroll");
          onDrumrollRef.current?.();
          schedule(() => {
            setStage("final");
            onFinalRevealRef.current?.();
            schedule(() => {
              setStage("done");
              onDoneRef.current?.();
            }, REVEAL_TIMING.doneDelay);
          }, REVEAL_TIMING.finalRevealDelay);
        }
      };

      schedule(revealNext, REVEAL_TIMING.drumrollDelay);
    }, REVEAL_TIMING.introDelay);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // The timeline runs once on mount — itemCount is captured at start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stage, visibleItems, schedule };
}

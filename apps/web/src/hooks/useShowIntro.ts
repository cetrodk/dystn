import { useState, useEffect, useRef } from "react";
import type { RoomSnapshot } from "@/games/registry";

/**
 * Returns true once when a game transitions from lobby to playing
 * and the host has enabled the showIntro setting.
 */
export function useShowIntro(room: RoomSnapshot | null) {
  const [show, setShow] = useState(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const status = room?.status;
  const showIntroSetting = !!(room?.settings as Record<string, unknown> | undefined)?.showIntro;

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "lobby" && status === "playing" && showIntroSetting) {
      setShow(true);
    }
  }, [status, showIntroSetting]);

  return [show, () => setShow(false)] as const;
}

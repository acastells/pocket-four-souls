import { useEffect, useState } from "react";
// Not in TypeScript's DOM lib yet; Android Chrome supports it while fullscreen.
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

/**
 * Fullscreen toggle. Entering also tries to lock landscape, so phones rotate
 * by themselves where the browser allows it (iPhone Safari does not).
 */
export function useFullscreen() {
  const supported =
    typeof document !== "undefined" && !!document.fullscreenEnabled;
  const [active, setActive] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
      await (screen.orientation as LockableOrientation)
        .lock?.("landscape")
        .catch(() => {});
    } catch {
      // Denied or unsupported: the page keeps working as it was.
    }
  }
  return { supported, active, toggle };
}

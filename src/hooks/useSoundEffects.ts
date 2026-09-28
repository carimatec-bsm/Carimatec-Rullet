import { useEffect, useState } from "react";
import { SoundEffects } from "../utils/soundEffects";

export function useSoundEffects() {
  const [sound] = useState(() => new SoundEffects());
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) sound.stop();
    };
    const stop = () => sound.stop();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
      sound.dispose();
    };
  }, [sound]);
  return sound;
}

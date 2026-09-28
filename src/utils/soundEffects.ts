import type { SoundSettings } from "../types";

export const DEFAULT_SOUND: SoundSettings = { enabled: false, volume: 35 };
export const TICK_MIN_INTERVAL = 0.025;
export const WIN_NOTES = [523.25, 659.25, 783.99, 1046.5];
export function soundSettings(value?: SoundSettings): SoundSettings {
  return {
    enabled: value?.enabled === true,
    volume: Number.isFinite(value?.volume)
      ? Math.max(0, Math.min(100, value!.volume))
      : DEFAULT_SOUND.volume,
  };
}

function browserContext(): AudioContext | undefined {
  const Constructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}

// No random draws, networking or data writes: audio cannot affect prize selection.
export class SoundEffects {
  private context?: AudioContext;
  private master?: GainNode;
  private settings = { ...DEFAULT_SOUND };
  private voices = new Map<OscillatorNode, GainNode>();
  private lastTick = -Infinity;
  private generation = 0;

  constructor(
    private createContext: () => AudioContext | undefined = browserContext,
  ) {}

  configure(value: SoundSettings) {
    this.settings = soundSettings(value);
    if (!this.settings.enabled || !this.settings.volume) this.stop();
    try {
      if (this.context && this.master)
        this.master.gain.setTargetAtTime(
          this.settings.enabled ? this.settings.volume / 100 : 0,
          this.context.currentTime,
          0.015,
        );
    } catch {
      /* Audio is optional even on partially supported browsers. */
    }
  }

  // Call directly inside a click/touch handler, before its first await.
  async activate(): Promise<boolean> {
    if (!this.settings.enabled || !this.settings.volume) return true;
    const generation = this.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.createContext();
        if (!this.context) return false;
        this.master = this.context.createGain();
        this.master.gain.value = this.settings.volume / 100;
        this.master.connect(this.context.destination);
      }
      const context = this.context;
      if (context.state !== "running") {
        const resumed = context.resume();
        await Promise.race([
          resumed,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 1500);
          }),
        ]);
      }
      return generation === this.generation && context.state === "running";
    } catch {
      return false;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private playable() {
    return (
      this.settings.enabled &&
      this.settings.volume > 0 &&
      this.context?.state === "running" &&
      (typeof document === "undefined" || !document.hidden)
    );
  }

  private tone(
    frequency: number,
    at: number,
    duration: number,
    level: number,
    type: OscillatorType = "sine",
    endFrequency = frequency,
  ) {
    if (
      !this.playable() ||
      !this.context ||
      !this.master ||
      this.voices.size >= 64
    )
      return;
    try {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      this.voices.set(oscillator, envelope);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        at + duration,
      );
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(level, at + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.01);
    } catch {
      this.stop();
    }
  }

  tick() {
    if (!this.playable() || !this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastTick < TICK_MIN_INTERVAL) return;
    this.lastTick = now;
    this.tone(1300, now, 0.035, 0.18, "triangle", 650);
  }

  celebrate() {
    this.stop();
    if (!this.playable() || !this.context) return;
    const now = this.context.currentTime;
    WIN_NOTES.forEach((note, i) => this.tone(note, now + i * 0.14, 0.55, 0.15));
    [523.25, 659.25, 783.99].forEach((note) =>
      this.tone(note, now + 0.62, 0.85, 0.08),
    );
  }

  previewSpin() {
    this.stop();
    if (!this.playable() || !this.context) return;
    const now = this.context.currentTime;
    // Same quartic deceleration as the wheel, shortened for the preview.
    for (let step = 0; step < 30; step++) {
      const offset = 2.5 * (1 - Math.pow(1 - step / 30, 0.25));
      this.tone(1300, now + offset, 0.035, 0.18, "triangle", 650);
    }
  }

  stop() {
    this.generation++;
    this.lastTick = -Infinity;
    for (const [oscillator, envelope] of this.voices) {
      try {
        oscillator.stop();
        oscillator.disconnect();
        envelope.disconnect();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
  }

  dispose() {
    this.stop();
    try {
      void this.context?.close().catch(() => {});
    } catch {
      /* Unsupported close. */
    }
    this.context = undefined;
    this.master = undefined;
  }
}

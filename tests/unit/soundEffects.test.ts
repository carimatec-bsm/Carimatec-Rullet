import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SoundEffects,
  soundSettings,
  TICK_MIN_INTERVAL,
} from "../../src/utils/soundEffects";
import { cloneConfig } from "../../src/data/defaultConfig";
import { publicSettings } from "../../src/utils/github";
import { validateConfig } from "../../src/utils/validation";

function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const gains: any[] = [],
    oscillators: any[] = [];
  const context = {
    state: "running",
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    createGain: () => {
      const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const osc = {
        frequency: param(),
        type: "sine",
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      oscillators.push(osc);
      return osc;
    },
  };
  return {
    context,
    gains,
    oscillators,
    engine: new SoundEffects(() => context as unknown as AudioContext),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("optional synthesized sound", () => {
  it("defaults to OFF and keeps older event.json files valid", () => {
    expect(soundSettings()).toEqual({ enabled: false, volume: 35 });
    const config = cloneConfig();
    expect(validateConfig(config)).toEqual([]);
    expect(publicSettings(config)).not.toHaveProperty("sound");
    config.sound = { enabled: true, volume: 55 };
    expect(publicSettings(config).sound).toEqual(config.sound);
    expect(validateConfig(config)).toEqual([]);
    config.sound.volume = NaN;
    expect(validateConfig(config).join()).toContain("효과음");
    config.sound.volume = 101;
    expect(validateConfig(config).join()).toContain("효과음");
    expect(soundSettings({ enabled: true, volume: -10 }).volume).toBe(0);
  });
  it("never creates audio until explicitly enabled and activated", async () => {
    const factory = vi.fn(() => undefined);
    const engine = new SoundEffects(factory);
    engine.tick();
    engine.celebrate();
    expect(await engine.activate()).toBe(true);
    expect(factory).not.toHaveBeenCalled();
    engine.configure({ enabled: true, volume: 35 });
    expect(await engine.activate()).toBe(false);
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it("throttles ticks and stops all voices immediately when muted", async () => {
    const { engine, context, oscillators, gains } = fakeContext();
    engine.configure({ enabled: true, volume: 35 });
    await engine.activate();
    engine.tick();
    engine.tick();
    expect(oscillators).toHaveLength(1);
    context.currentTime += TICK_MIN_INTERVAL + 0.001;
    engine.tick();
    expect(oscillators).toHaveLength(2);
    engine.configure({ enabled: false, volume: 35 });
    expect(oscillators.every((o) => o.disconnect.mock.calls.length > 0)).toBe(
      true,
    );
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      context.currentTime,
      0.015,
    );
    engine.tick();
    engine.celebrate();
    expect(oscillators).toHaveLength(2);
  });
  it("generates a bounded celebration without consuming random draws", async () => {
    const { engine, oscillators } = fakeContext();
    engine.configure({ enabled: true, volume: 100 });
    await engine.activate();
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Audio must not draw prize randomness");
    });
    try {
      engine.celebrate();
      expect(oscillators).toHaveLength(7);
    } finally {
      random.mockRestore();
    }
    expect(oscillators.every((o) => o.stop.mock.calls[0][0] <= 11.5)).toBe(
      true,
    );
    engine.dispose();
    expect(oscillators.every((o) => o.disconnect.mock.calls.length > 0)).toBe(
      true,
    );
  });
  it("slows preview tick intervals and cancels scheduled notes", async () => {
    const { engine, oscillators } = fakeContext();
    engine.configure({ enabled: true, volume: 35 });
    await engine.activate();
    engine.previewSpin();
    const starts = oscillators.map((o) => o.start.mock.calls[0][0]);
    expect(starts).toHaveLength(30);
    expect(starts[29] - starts[28]).toBeGreaterThan(starts[1] - starts[0]);
    engine.stop();
    expect(oscillators.every((o) => o.stop.mock.calls.length === 2)).toBe(true);
  });
  it("fails safely on resume rejection, timeout and missing API", async () => {
    const { engine, context } = fakeContext();
    engine.configure({ enabled: true, volume: 35 });
    context.state = "suspended";
    context.resume.mockRejectedValueOnce(new Error("blocked"));
    expect(await engine.activate()).toBe(false);
    vi.useFakeTimers();
    context.resume.mockImplementationOnce(() => new Promise(() => {}));
    const result = engine.activate();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toBe(false);
    const broken = new SoundEffects(() => {
      throw new Error("unsupported");
    });
    broken.configure({ enabled: true, volume: 35 });
    expect(await broken.activate()).toBe(false);
  });
  it("does not emit sounds while hidden or at zero volume", async () => {
    const { engine, oscillators } = fakeContext();
    engine.configure({ enabled: true, volume: 35 });
    await engine.activate();
    vi.stubGlobal("document", { hidden: true });
    engine.tick();
    engine.celebrate();
    expect(oscillators).toHaveLength(0);
    vi.stubGlobal("document", { hidden: false });
    engine.configure({ enabled: true, volume: 0 });
    engine.tick();
    engine.celebrate();
    expect(oscillators).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { cloneConfig, emptyCustomer } from "../../src/data/defaultConfig";
import {
  eligiblePrizes,
  indexAtPointer,
  pickWeighted,
  targetRotation,
  remaining,
  eventStatus,
} from "../../src/utils/rouletteLogic";
import { validateConfig } from "../../src/utils/validation";
import { toCsv } from "../../src/utils/csvExport";
import {
  readStore,
  saveConfig,
  startSpin,
  finishParticipant,
  resetData,
  STORAGE_KEY,
} from "../../src/utils/storage";
import { publicSettings, isNewerRevision } from "../../src/utils/github";

describe("weighted selection and exact visual landing", () => {
  it("respects each probability boundary, including zero and the final bucket", () => {
    const prizes = cloneConfig().prizes;
    for (const [r, id] of [
      [0, "coffee"],
      [0.0499999, "coffee"],
      [0.05, "goods"],
      [0.15, "tumbler"],
      [0.3, "pen"],
      [0.7, "keyring"],
      [0.9999999, "keyring"],
    ] as const)
      expect(pickWeighted(prizes, () => r).id).toBe(id);
    expect(() =>
      pickWeighted(prizes.map((p) => ({ ...p, weight: 0 }))),
    ).toThrow();
  });
  it("matches configured frequencies on 100,000 evenly spaced samples", () => {
    const prizes = cloneConfig().prizes;
    const tally: Record<string, number> = {};
    for (let i = 0; i < 100000; i++) {
      const p = pickWeighted(prizes, () => (i + 0.5) / 100000);
      tally[p.id] = (tally[p.id] || 0) + 1;
    }
    for (const p of prizes) expect(tally[p.id]).toBe(p.weight * 1000);
  });
  it("always stops inside the selected segment for every 2–12 item wheel", () => {
    for (let count = 2; count <= 12; count++)
      for (let i = 0; i < count; i++)
        for (const r of [0, 0.05, 0.5, 0.95, 0.9999999])
          for (const previous of [0, 13.5, 7356]) {
            const target = targetRotation(i, count, () => r, previous);
            expect(target).toBeGreaterThan(previous + 360 * 6);
            expect(indexAtPointer(target, count)).toBe(i);
          }
  });
  it("redistributes exhausted inventory, honors pause mode and unlimited/lose stock", () => {
    const c = cloneConfig();
    const used = { coffee: 50, pen: 300 };
    expect(eligiblePrizes(c, used).map((p) => p.id)).toEqual([
      "goods",
      "tumbler",
      "keyring",
    ]);
    c.behavior.autoExclude = false;
    expect(eligiblePrizes(c, used)).toEqual([]);
    c.prizes[0].unlimited = true;
    expect(remaining(c.prizes[0], used)).toBe(Infinity);
    c.prizes[0].unlimited = false;
    c.prizes[0].isLose = true;
    expect(remaining(c.prizes[0], used)).toBe(Infinity);
  });
  it("checks event date boundaries in Korea", () => {
    const c = cloneConfig();
    c.event.enforceDates = true;
    c.event.startDate = "2026-09-14";
    c.event.endDate = "2026-09-14";
    expect(eventStatus(c, new Date("2026-09-13T14:59:59Z"))).not.toBe("");
    expect(eventStatus(c, new Date("2026-09-13T15:00:00Z"))).toBe("");
    expect(eventStatus(c, new Date("2026-09-14T14:59:59Z"))).toBe("");
    expect(eventStatus(c, new Date("2026-09-14T15:00:00Z"))).not.toBe("");
  });
});
describe("validation and CSV", () => {
  it("never reverts fresh settings to older CDN content", () => {
    expect(isNewerRevision("initial", "2026-09-14T05:00:00Z")).toBe(false);
    expect(
      isNewerRevision("2026-09-14T04:00:00Z", "2026-09-14T05:00:00Z"),
    ).toBe(false);
    expect(
      isNewerRevision("2026-09-14T06:00:00Z", "2026-09-14T05:00:00Z"),
    ).toBe(true);
    expect(isNewerRevision("2026-09-14T06:00:00Z", "local-test")).toBe(false);
  });
  it("publishes only permitted fields, even if imported JSON has unexpected secrets", () => {
    const c = cloneConfig();
    Object.assign(c, { token: "secret", records: ["private"] });
    Object.assign(c.event, { password: "private" });
    const publicData = JSON.stringify(publicSettings(c));
    expect(publicData).not.toContain("secret");
    expect(publicData).not.toContain("private");
    expect(validateConfig(publicSettings(c))).toEqual([]);
  });
  it("rejects invalid sums, duplicate IDs, invalid images, negative stock and missing fields", () => {
    expect(validateConfig(cloneConfig())).toEqual([]);
    let c = cloneConfig();
    c.prizes[0].weight = 4;
    expect(validateConfig(c).length).toBeGreaterThan(0);
    c = cloneConfig();
    c.prizes[0].id = c.prizes[1].id;
    expect(validateConfig(c).length).toBeGreaterThan(0);
    c = cloneConfig();
    c.prizes[0].image = "javascript:alert(1)";
    expect(validateConfig(c).length).toBeGreaterThan(0);
    c = cloneConfig();
    c.prizes[0].initialStock = -1;
    expect(validateConfig(c).length).toBeGreaterThan(0);
    expect(validateConfig({})).not.toEqual([]);
  });
  it("exports UTF-8 BOM, quotes, commas, CRLF and prevents spreadsheet formulas", () => {
    const csv = toCsv([
      {
        ...emptyCustomer,
        id: "a",
        eventId: "e",
        time: "2026-09-14T00:00:00Z",
        name: "=SUM(A1)",
        company: '캐리마텍,"서울"',
        phone: "+821012345678",
        email: "a@b.com",
        prizeId: "p",
        prizeName: "텀블러",
        isLose: false,
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"\'=SUM(A1)"');
    expect(csv).toContain('"캐리마텍,""서울"""');
    expect(csv).toContain("\r\n");
    expect(csv).toContain("'+821012345678");
  });
});
describe("durable inventory transaction", () => {
  let memory: Map<string, string>;
  beforeEach(() => {
    memory = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  });
  it("persists exactly one participant and one stock decrement before spinning, recovers result", async () => {
    const c = cloneConfig();
    c.prizes.forEach((p, i) => (p.weight = i === 0 ? 100 : 0));
    saveConfig(c);
    const result = await startSpin({ ...emptyCustomer, name: "테스트" });
    expect(result.used.coffee).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(readStore().pending?.record.id).toBe(result.records[0].id);
    await expect(startSpin(emptyCustomer)).rejects.toThrow("이전 참여자");
    expect(readStore().records).toHaveLength(1);
    finishParticipant();
    expect(readStore().pending).toBeNull();
    resetData();
    expect(readStore().records).toHaveLength(0);
    expect(readStore().used).toEqual({});
    expect(readStore().config).toEqual(c);
  });
  it("preserves all saved product/event settings and revisions when resetting operations", async () => {
    const config = cloneConfig();
    config.revision = "2026-09-14T08:00:00.000Z";
    config.event.name = "운영 중인 전시회";
    config.prizes[0].name = "운영자가 등록한 특별 경품";
    config.prizes[0].initialStock = 80;
    config.prizes.forEach((p, i) => (p.weight = i === 0 ? 100 : 0));
    saveConfig(config);
    await startSpin(emptyCustomer);
    const pendingState = memory.get(STORAGE_KEY);
    expect(() => resetData()).toThrow("진행 중인 결과");
    expect(memory.get(STORAGE_KEY)).toBe(pendingState);
    finishParticipant();
    const result = resetData();
    expect(result.config).toEqual(config);
    expect(result.records).toEqual([]);
    expect(result.used).toEqual({});
    expect(remaining(result.config.prizes[0], result.used)).toBe(80);
    expect(result.pending).toBeNull();
    expect(resetData()).toEqual(result);
  });
  it("does not partially reset records or stock if storage fails or a spin is starting", async () => {
    saveConfig(cloneConfig());
    await startSpin(emptyCustomer);
    finishParticipant();
    const before = memory.get(STORAGE_KEY);
    memory.set(
      `${STORAGE_KEY}.lock`,
      JSON.stringify({ owner: "other", until: Date.now() + 10000 }),
    );
    expect(() => resetData()).toThrow("참여를 처리 중");
    expect(memory.get(STORAGE_KEY)).toBe(before);
    memory.delete(`${STORAGE_KEY}.lock`);
    localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => resetData()).toThrow("저장 공간");
    expect(memory.get(STORAGE_KEY)).toBe(before);
  });
  it("does not award or decrement when storage is full", async () => {
    saveConfig(cloneConfig());
    const snapshot = memory.get(STORAGE_KEY);
    const original = localStorage.setItem;
    localStorage.setItem = (key, value) => {
      if (key === STORAGE_KEY) throw new Error("QuotaExceededError");
      original(key, value);
    };
    await expect(startSpin(emptyCustomer)).rejects.toThrow("저장 공간");
    expect(memory.get(STORAGE_KEY)).toBe(snapshot);
  });
  it("rejects parallel starts and preserves one pending result", async () => {
    saveConfig(cloneConfig());
    const results = await Promise.allSettled([
      startSpin(emptyCustomer),
      startSpin(emptyCustomer),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(readStore().records).toHaveLength(1);
  });
  it("retains corrupted data rather than silently deleting it", () => {
    memory.set(STORAGE_KEY, "{broken");
    expect(readStore).toThrow("저장 데이터");
    expect(memory.get(STORAGE_KEY)).toBe("{broken");
  });
});

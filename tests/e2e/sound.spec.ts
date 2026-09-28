import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { cloneConfig } from "../../src/data/defaultConfig";

const KEY = "carimatec.roulette.v1";
async function setup(
  page: Page,
  enabled = false,
  unavailable = false,
  lose = false,
) {
  const config = cloneConfig();
  config.sound = { enabled, volume: 35 };
  if (lose)
    config.prizes.forEach((p, i) => {
      p.weight = i === 0 ? 100 : 0;
      p.isLose = i === 0;
    });
  await page.route("https://api.github.com/**", (route) => route.abort());
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.abort(),
  );
  await page.addInitScript(
    ({ config, KEY, unavailable }) => {
      if (!localStorage.getItem(KEY))
        localStorage.setItem(
          KEY,
          JSON.stringify({
            version: 1,
            config: { ...config, revision: "local-test" },
            records: [],
            used: {},
            pending: null,
          }),
        );
      const telemetry = {
        contexts: 0,
        starts: [] as { type: string; at: number }[],
        peak: 0,
      };
      (window as any).__audio = telemetry;
      if (unavailable) {
        Object.defineProperty(window, "AudioContext", {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(window, "webkitAudioContext", {
          value: undefined,
          configurable: true,
        });
        return;
      }
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor() {
          super();
          telemetry.contexts++;
        }
        createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (when = 0) => {
            telemetry.starts.push({ type: oscillator.type, at: when });
            start(when);
          };
          return oscillator;
        }
        createGain() {
          const gain = super.createGain();
          const connect = gain.connect.bind(gain);
          gain.connect = ((destination: AudioNode) => {
            if (destination === this.destination) {
              const analyser = this.createAnalyser();
              analyser.fftSize = 256;
              connect(analyser);
              analyser.connect(destination);
              const data = new Float32Array(256);
              const timer = setInterval(() => {
                if (this.state === "closed") {
                  clearInterval(timer);
                  return;
                }
                analyser.getFloatTimeDomainData(data);
                telemetry.peak = Math.max(
                  telemetry.peak,
                  ...data.map(Math.abs),
                );
              }, 10);
              return destination;
            }
            return connect(destination);
          }) as typeof gain.connect;
          return gain;
        }
      };
    },
    { config, KEY, unavailable },
  );
}
async function start(page: Page) {
  await page.getByRole("button", { name: "룰렛 돌리기", exact: true }).click();
  await page.getByLabel("QR 설문 참여를 완료했습니다.").check();
  await page.getByRole("button", { name: "확인하고 룰렛 돌리기" }).click();
}
async function login(page: Page) {
  await page.goto("/admin.html");
  await page.getByLabel("관리자 PIN", { exact: true }).fill("028877");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "룰렛 디자인", exact: true }).click();
}

test("audio is lazy, tick-synced and celebrates once, never on restored results", async ({
  page,
}) => {
  await setup(page, true);
  await page.goto("/");
  expect(await page.evaluate(() => (window as any).__audio.contexts)).toBe(0);
  await start(page);
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  const audio = await page.evaluate(() => (window as any).__audio);
  const ticks = audio.starts.filter((s: any) => s.type === "triangle");
  expect(ticks.length).toBeGreaterThan(10);
  expect(ticks.at(-1).at - ticks.at(-2).at).toBeGreaterThan(
    ticks[2].at - ticks[1].at,
  );
  expect(audio.starts.filter((s: any) => s.type === "sine")).toHaveLength(7);
  expect(audio.peak).toBeGreaterThan(0.001);
  expect(audio.peak).toBeLessThan(1);
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(state.records).toHaveLength(1);
  expect(state.used[state.pending.prize.id]).toBe(1);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__audio.contexts)).toBe(0);
});

test("visitor mute stops new ticks and suppresses celebration without interrupting spin", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "효과음 켜기", exact: true }).click();
  await start(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__audio.starts.length))
    .toBeGreaterThan(2);
  await page.getByRole("button", { name: "효과음 끄기", exact: true }).click();
  const count = await page.evaluate(
    () => (window as any).__audio.starts.length,
  );
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  expect(await page.evaluate(() => (window as any).__audio.starts.length)).toBe(
    count,
  );
});

test("missing audio support still awards once and displays an actionable notice", async ({
  page,
}) => {
  await setup(page, true, true);
  await page.goto("/");
  await start(page);
  await expect(page.getByRole("alert")).toContainText(
    "소리를 재생하지 못했습니다",
  );
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).records.length,
      KEY,
    ),
  ).toBe(1);
});

test("lose prize does not play a congratulatory melody", async ({ page }) => {
  await setup(page, true, false, true);
  await page.goto("/");
  await start(page);
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  const audio = await page.evaluate(() => (window as any).__audio);
  expect(audio.starts.filter((s: any) => s.type === "sine")).toHaveLength(0);
  expect(audio.starts.length).toBeGreaterThan(2);
});

test("admin previews actual audio and saves volume to local settings and event.json", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await expect(
    page.getByLabel("효과음 사용", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "축하음 미리 듣기", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__audio.peak))
    .toBeGreaterThan(0.001);
  await page
    .getByRole("button", { name: "미리 듣기 중지", exact: true })
    .click();
  await page.getByLabel("효과음 사용", { exact: true }).check();
  await page.getByLabel("효과음 음량", { exact: true }).fill("55");
  await page
    .getByRole("button", { name: "이 기기에 저장", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "룰렛 디자인", exact: true }).click();
  await expect(page.getByLabel("효과음 사용", { exact: true })).toBeChecked();
  await expect(page.getByLabel("효과음 음량", { exact: true })).toHaveValue(
    "55",
  );
  await page
    .getByRole("button", { name: "운영 및 데이터", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "설정 JSON 내보내기", exact: true })
    .click();
  const data = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(data.sound).toEqual({ enabled: true, volume: 55 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "효과음 끄기", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__audio.contexts)).toBe(0);
});

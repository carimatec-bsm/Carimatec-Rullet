import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { cloneConfig } from "../../src/data/defaultConfig";
import { indexAtPointer } from "../../src/utils/rouletteLogic";
import type { Config } from "../../src/types";
test("fresh API settings cannot be overwritten by an older CDN poll", async ({
  page,
}) => {
  const fresh = cloneConfig();
  fresh.revision = "2026-09-14T06:00:00Z";
  fresh.event.name = "최신 공통 설정";
  let rawRequests = 0;
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ json: fresh }),
  );
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    rawRequests++;
    return route.fulfill({ json: cloneConfig() });
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator(".event-badge")).toContainText("최신 공통 설정");
  await page.clock.fastForward(61000);
  await expect.poll(() => rawRequests).toBeGreaterThan(0);
  await expect(page.locator(".event-badge")).toContainText("최신 공통 설정");
});
const KEY = "carimatec.roulette.v1";
async function offline(page: Page) {
  await page.route("https://api.github.com/**", (route) => route.abort());
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.abort(),
  );
}
async function seed(page: Page, config = cloneConfig()) {
  await offline(page);
  await page.addInitScript(
    ({ key, config }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            config: { ...config, revision: "local-test" },
            records: [],
            used: {},
            pending: null,
          }),
        );
    },
    { key: KEY, config },
  );
}
async function login(page: Page) {
  await page.goto("/admin.html");
  await page.getByLabel("관리자 PIN", { exact: true }).fill("028877");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
}
async function initiate(page: Page) {
  await page.getByRole("button", { name: "룰렛 돌리기", exact: true }).click();
  await page.getByLabel("QR 설문 참여를 완료했습니다.").check();
  await page.getByRole("button", { name: "확인하고 룰렛 돌리기" }).click();
}

test("spin lands on the chosen segment, only decrements once and exports CSV", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.screenshot({ path: ".qa/visitor-landscape.png" });
  await initiate(page);
  await expect(page.locator(".spin-button")).toBeDisabled();
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(stored.records.length).toBe(1);
  expect(stored.used[stored.pending.prize.id]).toBe(1);
  expect(
    stored.pending.wheel[
      indexAtPointer(stored.pending.target, stored.pending.wheel.length)
    ].id,
  ).toBe(stored.pending.prize.id);
  const style = await page.locator(".wheel-svg").getAttribute("style");
  const renderedAngle = Number(style!.match(/rotate\(([-\d.]+)deg\)/)![1]);
  expect(renderedAngle).toBeCloseTo(stored.pending.target, 1);
  expect(indexAtPointer(renderedAngle, stored.pending.wheel.length)).toBe(
    indexAtPointer(stored.pending.target, stored.pending.wheel.length),
  );
  await page.screenshot({ path: ".qa/result.png" });
  await page.getByRole("button", { name: "확인 · 다음 참여자" }).click();
  await expect(page.locator(".spin-button")).toBeEnabled();
  await login(page);
  await page.screenshot({ path: ".qa/admin-dashboard.png" });
  await page.getByRole("button", { name: "참여자 목록" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV 다운로드" }).click();
  const file = await download;
  const bytes = await readFile((await file.path())!);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([239, 187, 191]);
  expect(bytes.toString("utf8")).toContain(stored.pending.prize.name);
});
test("refresh during animation restores the same result without a second award", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await initiate(page);
  await expect(page.locator(".spin-button")).toHaveClass(/is-spinning/);
  const original = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).pending.record.id,
    KEY,
  );
  await page.reload();
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible();
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(after.pending.record.id).toBe(original);
  expect(after.records.length).toBe(1);
});
test("admin PIN, required validation, configuration, image upload and refresh persistence", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/admin.html");
  await page.getByLabel("관리자 PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByText("PIN이 올바르지 않습니다.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("관리자 PIN", { exact: true }).fill("028877");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "경품 관리", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "스타벅스 상품권 당첨 확률", exact: true })
    .fill("6");
  await expect(
    page.getByRole("button", { name: "공통 설정 저장", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("spinbutton", { name: "스타벅스 상품권 당첨 확률", exact: true })
    .fill("5");
  await page
    .getByLabel("상품명", { exact: true })
    .first()
    .fill("현장 특별 커피");
  await page
    .getByLabel("현장 특별 커피 이미지 업로드")
    .setInputFiles("public/assets/logo.png");
  await expect(page.locator(".upload-preview img").first()).toHaveAttribute(
    "src",
    /^data:image\//,
  );
  await page
    .getByRole("button", { name: "이 기기에 저장", exact: true })
    .click();
  await page.getByRole("button", { name: "이벤트 설정", exact: true }).click();
  await page.getByLabel("전시회명", { exact: true }).fill("INTRA 2026 SPECIAL");
  await page.getByLabel("행사 시작일").fill("2026-09-14");
  await page.getByLabel("행사 종료일").fill("2026-09-18");
  await page
    .getByRole("button", { name: "이 기기에 저장", exact: true })
    .click();
  await page.reload();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    KEY,
  );
  expect(stored.config.event.name).toBe("INTRA 2026 SPECIAL");
  expect(stored.config.prizes[0].image).toMatch(/^data:image\//);
  expect(stored.config.prizes[0].name).toBe("현장 특별 커피");
  await page.getByRole("button", { name: "경품 관리", exact: true }).click();
  await page.screenshot({ path: ".qa/admin-prizes.png", fullPage: true });
});
test("optional customer form stores participant data and validates required fields", async ({
  page,
}) => {
  const config = cloneConfig();
  config.behavior.collectCustomers = true;
  await seed(page, config);
  await page.goto("/");
  await page.getByRole("button", { name: "룰렛 돌리기", exact: true }).click();
  await page.getByLabel("QR 설문 참여를 완료했습니다.").check();
  await page.getByRole("button", { name: "확인하고 룰렛 돌리기" }).click();
  await expect(
    page.getByRole("dialog", { name: "룰렛 참여 확인" }),
  ).toBeVisible();
  await page.getByLabel("성함").fill("홍길동");
  await page.getByLabel("회사명").fill("캐리마텍");
  await page.getByLabel("연락처").fill("010-1234-5678");
  await page.getByLabel("이메일").fill("test@example.com");
  await page.getByRole("button", { name: "확인하고 룰렛 돌리기" }).click();
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  const record = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).records[0],
    KEY,
  );
  expect(record.name).toBe("홍길동");
  expect(record.company).toBe("캐리마텍");
  expect(record.phone).toBe("010-1234-5678");
});
test("exhaustion stops awards and reset requires confirmation", async ({
  page,
}) => {
  const config = cloneConfig();
  config.prizes.forEach((p, i) => {
    p.weight = i === 0 ? 100 : 0;
    p.initialStock = 1;
  });
  await seed(page, config);
  await page.goto("/");
  await initiate(page);
  await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
    timeout: 8000,
  });
  await page.getByRole("button", { name: "확인 · 다음 참여자" }).click();
  await expect(page.locator(".spin-button")).toBeDisabled();
  await expect(
    page.getByText("준비된 경품이 모두 소진되었습니다.", { exact: false }),
  ).toBeVisible();
  await login(page);
  await page.getByRole("button", { name: "운영 및 데이터" }).click();
  await page
    .getByRole("button", { name: "상품 수량 초기화", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "데이터 초기화 확인" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).used.coffee,
      KEY,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "상품 수량 초기화", exact: true })
    .click();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).used.coffee || 0,
      KEY,
    ),
  ).toBe(0);
});
test("GitHub publish shares only configuration across devices and detects conflicts (API mock)", async ({
  page,
  browser,
}) => {
  let remote: Config = cloneConfig();
  let sent: Record<string, unknown> | undefined;
  const mockRaw = async (p: Page) => {
    await p.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ json: remote }),
    );
    await p.route("https://api.github.com/repos/**/contents/**", (route) =>
      route.fulfill({ json: remote }),
    );
  };
  await mockRaw(page);
  await page.route(
    "https://api.github.com/repos/**/contents/**",
    async (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        sent = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
        remote = sent as unknown as Config;
        await route.fulfill({
          status: 200,
          json: { content: { sha: "new-sha" } },
        });
      } else if (
        route.request().headers().accept === "application/vnd.github.raw+json"
      )
        await route.fulfill({ json: remote });
      else
        await route.fulfill({
          json: {
            sha: "old-sha",
            content: Buffer.from(JSON.stringify(remote)).toString("base64"),
          },
        });
    },
  );
  await login(page);
  await page.getByRole("button", { name: "이벤트 설정", exact: true }).click();
  await page.getByLabel("전시회명", { exact: true }).fill("기기 공유 검증");
  await page
    .getByRole("button", { name: "공통 설정 저장", exact: true })
    .click();
  await page
    .getByLabel("GitHub Fine-grained Token", { exact: true })
    .fill("test-only-fake-token");
  await page
    .getByRole("button", { name: "변경사항 공통 저장", exact: true })
    .click();
  await expect(
    page.getByText("GitHub에 공통 설정을 저장했습니다.", { exact: false }),
  ).toBeVisible();
  expect(sent).not.toHaveProperty("records");
  expect(sent).not.toHaveProperty("token");
  expect(JSON.stringify(sent)).not.toContain("028877");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "test-only-fake-token",
  );
  const context = await browser.newContext();
  const other = await context.newPage();
  await mockRaw(other);
  await other.goto("http://127.0.0.1:4173/");
  await expect(other.locator(".event-badge")).toContainText("기기 공유 검증");
  await context.close();
  remote = { ...remote, revision: "a-newer-edit" };
  await page
    .getByRole("button", { name: "공통 설정 저장", exact: true })
    .click();
  await page
    .getByLabel("GitHub Fine-grained Token", { exact: true })
    .fill("test-only-fake-token");
  await page
    .getByRole("button", { name: "변경사항 공통 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "다른 관리자가 공통 설정을 변경했습니다.",
  );
});
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`touch viewport ${viewport.width}x${viewport.height} fits screen`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    await seed(page);
    await page.goto("http://127.0.0.1:4173/");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await expect(page.locator(".spin-button")).toBeVisible();
    const button = await page.locator(".spin-button").boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(50);
    expect(button!.y + button!.height).toBeLessThanOrEqual(viewport.height);
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.height > viewport.width) {
      const copy = await page.locator(".event-copy").boundingBox();
      const caption = await page.locator(".stage-caption").boundingBox();
      if (caption)
        expect(caption.y).toBeGreaterThanOrEqual(copy!.y + copy!.height);
    }
    await page.screenshot({
      path: `.qa/visitor-${viewport.width}x${viewport.height}.png`,
    });
    await page.locator(".spin-button").tap();
    await expect(
      page.getByRole("dialog", { name: "룰렛 참여 확인" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

for (const count of [2, 12]) {
  test(`${count} prize wheel supports all display options and dark theme`, async ({
    page,
  }) => {
    const config = cloneConfig();
    const original = config.prizes[0];
    config.prizes = Array.from({ length: count }, (_, i) => ({
      ...original,
      id: `item-${i}`,
      name: `긴 상품 이름 테스트 ${i + 1}`,
      label: `긴 상품 이름 테스트 ${i + 1}`,
      weight:
        i === count - 1
          ? 100 - (count - 1) * Math.floor(100 / count)
          : Math.floor(100 / count),
      color: i % 2 ? "#F0E8F7" : "#7030A0",
    }));
    config.display = {
      ...config.display,
      theme: "dark",
      probabilities: true,
      descriptions: true,
    };
    await seed(page, config);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await expect(page.locator("[data-prize-id]")).toHaveCount(count);
    await page.screenshot({ path: `.qa/wheel-${count}-dark.png` });
    await initiate(page);
    await expect(page.getByRole("dialog", { name: "룰렛 결과" })).toBeVisible({
      timeout: 8000,
    });
  });
}

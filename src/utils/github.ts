import { REPOSITORY } from "../data/defaultConfig";
import type { Config } from "../types";
import { assertConfig } from "./validation";
const repo = `${REPOSITORY.owner}/${REPOSITORY.name}`;
const endpoint = `https://api.github.com/repos/${repo}/contents/${REPOSITORY.path}`;
export async function timedFetch(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "서버 응답이 지연되고 있습니다. 저장을 시도했다면 최신 설정을 불러와 반영 여부를 확인해 주세요."
        : "인터넷 연결을 확인하고 다시 시도해 주세요.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function fetchPublishedConfig(fresh = true): Promise<Config> {
  if (fresh) {
    try {
      const response = await timedFetch(
        `${endpoint}?ref=${REPOSITORY.branch}&t=${Date.now()}`,
        { headers: { Accept: "application/vnd.github.raw+json" } },
      );
      if (response.ok) {
        const config: unknown = await response.json();
        assertConfig(config);
        return config;
      }
    } catch {
      /* An offline or rate-limited API can fall back to the public CDN. */
    }
  }
  const url = `https://raw.githubusercontent.com/${repo}/${REPOSITORY.branch}/${REPOSITORY.path}?t=${Date.now()}`;
  const response = await timedFetch(url);
  if (!response.ok)
    throw new Error(
      "공통 설정에 연결하지 못했습니다. 이 기기에 저장된 설정으로 운영합니다.",
    );
  const config: unknown = await response.json();
  assertConfig(config);
  return config;
}
export function isNewerRevision(remote: string, current: string) {
  if (
    remote === current ||
    current.startsWith("local-") ||
    remote === "initial"
  )
    return false;
  if (current === "initial") return true;
  const nextTime = Date.parse(remote),
    currentTime = Date.parse(current);
  return Number.isFinite(nextTime) && Number.isFinite(currentTime)
    ? nextTime > currentTime
    : remote !== current;
}
export async function fetchBundledConfig(): Promise<Config> {
  const response = await timedFetch(
    `${import.meta.env.BASE_URL}data/event.json`,
  );
  if (!response.ok) throw new Error("기본 설정을 불러오지 못했습니다.");
  const config: unknown = await response.json();
  assertConfig(config);
  return config;
}
function encodeUtf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function decodeUtf8(value: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
  );
}
export async function publishConfig(
  config: Config,
  token: string,
  expectedRevision: string,
): Promise<Config> {
  assertConfig(config);
  if (!token.trim())
    throw new Error(
      "이 저장소의 Contents 쓰기 권한이 있는 GitHub 토큰을 입력해 주세요.",
    );
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
  const get = await timedFetch(`${endpoint}?ref=${REPOSITORY.branch}`, {
    headers,
  });
  if (!get.ok && get.status !== 404)
    throw new Error("GitHub 인증 또는 저장소 접근 권한을 확인해 주세요.");
  let sha: string | undefined;
  if (get.ok) {
    const file = await get.json();
    sha = file.sha;
    let remote: Config;
    if (file.encoding === "none" || !file.content) {
      const raw = await timedFetch(`${endpoint}?ref=${REPOSITORY.branch}`, {
        headers: { ...headers, Accept: "application/vnd.github.raw+json" },
      });
      if (!raw.ok)
        throw new Error("GitHub의 기존 설정 파일을 읽지 못했습니다.");
      remote = await raw.json();
    } else {
      remote = JSON.parse(decodeUtf8(file.content));
    }
    assertConfig(remote);
    if (remote.revision !== expectedRevision)
      throw new Error(
        "다른 관리자가 공통 설정을 변경했습니다. 설정을 JSON으로 백업한 뒤 최신 설정을 불러와 다시 수정해 주세요.",
      );
  }
  const next = publicSettings(config);
  const response = await timedFetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Update exhibition settings ${next.event.name}`,
      content: encodeUtf8(JSON.stringify(next, null, 2)),
      branch: REPOSITORY.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409 || response.status === 422
        ? "다른 저장과 충돌했습니다. 최신 설정을 불러온 뒤 다시 저장해 주세요."
        : "GitHub 저장에 실패했습니다. 토큰의 Contents 쓰기 권한을 확인해 주세요.",
    );
  return next;
}
function pick<T extends object, K extends keyof T>(
  value: T,
  keys: K[],
): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}
// Explicit allowlist: imported extra keys must never upload records, PINs or credentials.
export function publicSettings(config: Config): Config {
  return {
    version: 1,
    revision: new Date().toISOString(),
    eventId: config.eventId,
    event: pick(config.event, [
      "name",
      "mainTitle",
      "subTitle",
      "guide",
      "startDate",
      "endDate",
      "enforceDates",
      "surveyUrl",
    ]),
    display: pick(config.display, [
      "theme",
      "layout",
      "names",
      "images",
      "probabilities",
      "descriptions",
    ]),
    behavior: {
      ...pick(config.behavior, [
        "autoExclude",
        "duration",
        "paused",
        "collectCustomers",
      ]),
      required: pick(config.behavior.required, [
        "name",
        "company",
        "phone",
        "email",
      ]),
    },
    prizes: config.prizes.map((p) =>
      pick(p, [
        "id",
        "name",
        "label",
        "description",
        "image",
        "color",
        "weight",
        "active",
        "initialStock",
        "unlimited",
        "isLose",
      ]),
    ),
  };
}

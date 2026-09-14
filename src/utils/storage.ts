import { cloneConfig, defaultConfig } from "../data/defaultConfig";
import type { Config, Customer, Store } from "../types";
import { assertConfig } from "./validation";
import {
  eligiblePrizes,
  eventStatus,
  pickWeighted,
  targetRotation,
} from "./rouletteLogic";
export const STORAGE_KEY = "carimatec.roulette.v1";
const LOCK_KEY = `${STORAGE_KEY}.lock`;
export function newStore(): Store {
  return {
    version: 1,
    config: cloneConfig(),
    records: [],
    used: {},
    pending: null,
  };
}
export function readStore(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return newStore();
  try {
    const data = JSON.parse(raw) as Store;
    assertConfig(data.config);
    if (
      data.version !== 1 ||
      !Array.isArray(data.records) ||
      !data.used ||
      typeof data.used !== "object"
    )
      throw new Error();
    return data;
  } catch {
    throw new Error(
      "저장 데이터를 읽을 수 없습니다. 데이터를 삭제하지 말고 운영자에게 문의해 주세요.",
    );
  }
}
export function writeStore(state: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new Error(
      "기기 저장 공간이 부족하거나 저장이 차단되었습니다. Admin에서 기록을 백업하고 저장 공간을 확인해 주세요.",
    );
  }
  window.dispatchEvent(new Event("carimatec-store"));
  return state;
}
export function saveConfig(config: Config) {
  assertConfig(config);
  const state = readStore();
  if (state.pending)
    throw new Error("진행 중인 룰렛 결과를 확인한 후 설정을 저장해 주세요.");
  if (state.config.eventId !== config.eventId) state.used = {};
  state.config = config;
  return writeStore(state);
}
export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export async function startSpin(customer: Customer): Promise<Store> {
  // Short lease covers browsers without Web Locks. A single booth tab is recommended.
  const owner = makeId();
  const lock = JSON.parse(localStorage.getItem(LOCK_KEY) || "null");
  if (lock && lock.until > Date.now())
    throw new Error(
      "다른 화면에서 참여를 처리 중입니다. 잠시 후 다시 시도해 주세요.",
    );
  localStorage.setItem(
    LOCK_KEY,
    JSON.stringify({ owner, until: Date.now() + 10000 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 90));
  if (JSON.parse(localStorage.getItem(LOCK_KEY) || "null")?.owner !== owner)
    throw new Error("다른 화면에서 참여를 처리 중입니다.");
  try {
    const state = readStore();
    if (state.pending)
      throw new Error("이전 참여자의 결과를 먼저 확인해 주세요.");
    const status = eventStatus(state.config);
    if (status) throw new Error(status);
    assertConfig(state.config);
    const wheel = state.config.prizes.filter((p) => p.active);
    const prize = pickWeighted(eligiblePrizes(state.config, state.used));
    const record = {
      ...customer,
      id: makeId(),
      eventId: state.config.eventId,
      time: new Date().toISOString(),
      prizeId: prize.id,
      prizeName: prize.name,
      isLose: prize.isLose,
    };
    state.records.push(record);
    if (!prize.unlimited && !prize.isLose)
      state.used[prize.id] = (state.used[prize.id] || 0) + 1;
    state.pending = {
      record,
      prize,
      wheel,
      display: state.config.display,
      target: targetRotation(
        wheel.findIndex((p) => p.id === prize.id),
        wheel.length,
      ),
      startedAt: Date.now(),
      duration: state.config.behavior.duration,
    };
    // Record, stock and pending result are one atomic localStorage write BEFORE animation.
    return writeStore(state);
  } finally {
    if (JSON.parse(localStorage.getItem(LOCK_KEY) || "null")?.owner === owner)
      localStorage.removeItem(LOCK_KEY);
  }
}
export function finishParticipant() {
  const state = readStore();
  state.pending = null;
  return writeStore(state);
}
export function resetData(kind: "records" | "stock" | "settings") {
  const state = readStore();
  if (state.pending) throw new Error("진행 중인 결과를 먼저 확인해 주세요.");
  if (kind === "records") state.records = [];
  if (kind === "stock") state.used = {};
  if (kind === "settings") {
    state.config = {
      ...cloneConfig(defaultConfig),
      revision: `local-${makeId()}`,
      baseRevision: state.config.baseRevision || state.config.revision,
    };
  }
  return writeStore(state);
}

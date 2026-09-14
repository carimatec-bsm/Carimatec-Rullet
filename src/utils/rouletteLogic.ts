import type { Config, Prize } from "../types";
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export function remaining(prize: Prize, used: Record<string, number>) {
  return prize.unlimited || prize.isLose
    ? Infinity
    : Math.max(0, prize.initialStock - (used[prize.id] || 0));
}
export function probabilityTotal(prizes: Prize[]) {
  return prizes.filter((p) => p.active).reduce((n, p) => n + p.weight, 0);
}
export function eligiblePrizes(config: Config, used: Record<string, number>) {
  const active = config.prizes.filter((p) => p.active);
  if (
    !config.behavior.autoExclude &&
    active.some((p) => p.weight > 0 && remaining(p, used) === 0)
  )
    return [];
  return active.filter((p) => p.weight > 0 && remaining(p, used) > 0);
}
export function pickWeighted(prizes: Prize[], random = Math.random): Prize {
  const valid = prizes.filter((p) => Number.isFinite(p.weight) && p.weight > 0);
  const total = valid.reduce((sum, p) => sum + p.weight, 0);
  if (!total)
    throw new Error(
      "현재 참여 가능한 상품이 없습니다. 운영자에게 문의해 주세요.",
    );
  const r = Math.max(0, Math.min(1 - Number.EPSILON, random())) * total;
  let cumulative = 0;
  for (const prize of valid) {
    cumulative += prize.weight;
    if (r < cumulative) return prize;
  }
  return valid[valid.length - 1];
}
// SVG segments begin at twelve o'clock. Rotate the chosen center back to twelve.
export function targetRotation(
  index: number,
  count: number,
  random = Math.random,
  previous = 0,
) {
  if (count < 2 || count > 12 || index < 0 || index >= count)
    throw new Error("잘못된 룰렛 영역입니다.");
  const step = 360 / count;
  const offset = (random() - 0.5) * 0.36 * step;
  const destination = mod(-(index + 0.5) * step + offset, 360);
  return previous + 360 * 7 + mod(destination - mod(previous, 360), 360);
}
export function indexAtPointer(rotation: number, count: number) {
  return Math.floor(mod(-rotation, 360) / (360 / count));
}
export function effectiveProbability(
  prize: Prize,
  config: Config,
  used: Record<string, number>,
) {
  const eligible = eligiblePrizes(config, used);
  return eligible.some((p) => p.id === prize.id)
    ? (prize.weight / eligible.reduce((sum, p) => sum + p.weight, 0)) * 100
    : 0;
}
export function eventStatus(config: Config, now = new Date()): string {
  if (config.behavior.paused)
    return "잠시 준비 중입니다. 운영자에게 문의해 주세요.";
  if (!config.event.enforceDates) return "";
  // Dates are interpreted in the exhibition timezone, Asia/Seoul.
  const koreaDate = new Date(now.getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 10);
  if (config.event.startDate && koreaDate < config.event.startDate)
    return "아직 이벤트 시작 전입니다.";
  if (config.event.endDate && koreaDate > config.event.endDate)
    return "이벤트가 종료되었습니다. 참여해 주셔서 감사합니다.";
  return "";
}

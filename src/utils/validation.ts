import type { Config } from "../types";
import { probabilityTotal } from "./rouletteLogic";
export function validateConfig(value: unknown): string[] {
  const c = value as Config;
  if (
    !c ||
    c.version !== 1 ||
    !c.event ||
    !c.display ||
    !c.behavior ||
    !Array.isArray(c.prizes) ||
    !c.behavior.required
  )
    return ["설정 파일 형식이 올바르지 않습니다."];
  const errors: string[] = [];
  if (
    typeof c.revision !== "string" ||
    typeof c.eventId !== "string" ||
    !c.eventId ||
    c.eventId.length > 100
  )
    errors.push("이벤트 ID가 필요합니다.");
  if (c.prizes.length < 2 || c.prizes.length > 12)
    errors.push("상품은 2개에서 12개까지 등록할 수 있습니다.");
  if (c.prizes.filter((p) => p.active).length < 2)
    errors.push("활성 상품은 최소 2개가 필요합니다.");
  if (Math.abs(probabilityTotal(c.prizes) - 100) > 0.001)
    errors.push("전체 당첨 확률의 합계가 100%가 되어야 합니다.");
  if (new Set(c.prizes.map((p) => p.id)).size !== c.prizes.length)
    errors.push("상품 ID가 중복되었습니다.");
  for (const p of c.prizes) {
    if (
      !p.id ||
      typeof p.id !== "string" ||
      ["__proto__", "constructor", "prototype"].includes(p.id)
    )
      errors.push("상품 ID가 올바르지 않습니다.");
    if (
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 80 ||
      typeof p.label !== "string" ||
      !p.label.trim() ||
      p.label.length > 40 ||
      typeof p.description !== "string" ||
      p.description.length > 300
    )
      errors.push("상품명·표시명·설명 길이를 확인해 주세요.");
    if (!Number.isFinite(p.weight) || p.weight < 0 || p.weight > 100)
      errors.push("확률은 0~100 사이 숫자로 입력해 주세요.");
    if (
      p.rankLabel !== undefined &&
      (typeof p.rankLabel !== "string" || p.rankLabel.length > 12)
    )
      errors.push("등수 / 구분은 12자 이내로 입력해 주세요.");
    if (
      !Number.isSafeInteger(p.initialStock) ||
      p.initialStock < 0 ||
      p.initialStock > 1000000
    )
      errors.push("수량은 0~1,000,000 사이 정수로 입력해 주세요.");
    if (typeof p.color !== "string" || !/^#[0-9a-f]{6}$/i.test(p.color))
      errors.push("상품 색상을 확인해 주세요.");
    if (
      typeof p.image !== "string" ||
      p.image.length > 130000 ||
      (p.image &&
        !/^(assets\/[\w.-]+\.(svg|png|jpe?g|webp)|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/.test(
          p.image,
        ))
    )
      errors.push("이미지 형식 또는 용량이 올바르지 않습니다.");
    if ([p.active, p.unlimited, p.isLose].some((x) => typeof x !== "boolean"))
      errors.push("상품 옵션이 올바르지 않습니다.");
  }
  for (const k of [
    "name",
    "mainTitle",
    "subTitle",
    "guide",
    "startDate",
    "endDate",
    "surveyUrl",
  ] as const)
    if (typeof c.event[k] !== "string" || c.event[k].length > 500)
      errors.push("행사 정보가 올바르지 않습니다.");
  if (!c.event.mainTitle?.trim() || !c.event.subTitle?.trim())
    errors.push("메인 제목과 서브 제목을 입력해 주세요.");
  if (
    c.event.mainTitle?.length > 28 ||
    c.event.subTitle?.length > 28 ||
    c.event.name?.length > 50
  )
    errors.push("제목은 28자, 행사명은 50자 이내로 입력해 주세요.");
  if (
    (c.event.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.event.startDate)) ||
    (c.event.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.event.endDate))
  )
    errors.push("행사 날짜 형식을 확인해 주세요.");
  if (
    c.event.startDate &&
    c.event.endDate &&
    c.event.startDate > c.event.endDate
  )
    errors.push("종료일은 시작일 이후여야 합니다.");
  if (c.event.surveyUrl && !/^https:\/\//i.test(c.event.surveyUrl))
    errors.push("설문 주소는 https:// 로 시작해야 합니다.");
  if (
    !["light", "dark", "grid"].includes(c.display.theme) ||
    !["auto", "landscape", "portrait"].includes(c.display.layout)
  )
    errors.push("화면 설정이 올바르지 않습니다.");
  if (
    [
      c.display.names,
      c.display.images,
      c.display.probabilities,
      c.display.descriptions,
      c.behavior.autoExclude,
      c.behavior.paused,
      c.behavior.collectCustomers,
      c.event.enforceDates,
      ...Object.values(c.behavior.required),
    ].some((x) => typeof x !== "boolean")
  )
    errors.push("설정 옵션 형식이 올바르지 않습니다.");
  if (
    !Number.isFinite(c.behavior.duration) ||
    c.behavior.duration < 4000 ||
    c.behavior.duration > 6000
  )
    errors.push("회전 시간은 4~6초로 설정해 주세요.");
  return [...new Set(errors)];
}
export function assertConfig(value: unknown): asserts value is Config {
  const errors = validateConfig(value);
  if (errors.length) throw new Error(errors.join(" "));
}

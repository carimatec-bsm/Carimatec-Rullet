// All dimensions use the SVG viewBox, so they scale with the wheel on every screen.
export const WHEEL_DIAMETER = 480;
export const WHEEL_RADIUS = 228;
export const PRIZE_IMAGE_SIZE_RATIO = 0.22;
export const PRIZE_IMAGE_RADIUS_RATIO = 0.7;
export const PRIZE_TEXT_MIN_RADIUS_RATIO = 0.26;
export const PRIZE_CONTENT_GAP = 5;
export const SECTOR_EDGE_GAP = 3;
export const WHEEL_HUB_SIZE_RATIO = 0.22;

export function splitPrizeLabel(value: string, count: number) {
  const max = count >= 10 ? 4 : count >= 7 ? 5 : 6;
  const characters = Array.from(value.trim().replace(/\s+/g, " "));
  if (characters.length <= max) return [characters.join("")];
  const wordBreak = characters.slice(0, max + 1).lastIndexOf(" ");
  const split = wordBreak > 0 ? wordBreak : max;
  const tail = Array.from(characters.slice(split).join("").trim());
  return [
    characters.slice(0, split).join(""),
    tail.length > max ? tail.slice(0, max - 1).join("") + "…" : tail.join(""),
  ];
}

export function prizeLayout(
  count: number,
  index: number,
  rows: string[],
  showImages: boolean,
) {
  const halfAngle = Math.PI / Math.max(2, count);
  const angle = (index + 0.5) * 2 * halfAngle;
  const imageRadius = WHEEL_RADIUS * PRIZE_IMAGE_RADIUS_RATIO;
  // A square's circumcircle must fit inside both the wedge and outer circle.
  // This remains safe at EVERY wheel angle while the image counter-rotates upright.
  const safeRadius = Math.max(
    0,
    Math.min(imageRadius * Math.sin(halfAngle), WHEEL_RADIUS - imageRadius) -
      SECTOR_EDGE_GAP,
  );
  const imageSize = Math.min(
    WHEEL_DIAMETER * PRIZE_IMAGE_SIZE_RATIO,
    Math.SQRT2 * safeRadius,
  );
  const imageInner = imageRadius - imageSize / Math.SQRT2;
  const textLimit = showImages
    ? imageInner - PRIZE_CONTENT_GAP
    : WHEEL_RADIUS * 0.8;
  const maxCharacters = Math.max(
    1,
    ...rows.map((row) => Array.from(row).length),
  );
  let fontSize = count >= 10 ? 10 : 12;
  let lineHeight = 0,
    textHeight = 0,
    textHalfWidth = 0,
    textInner = 0,
    textOuter = 0;
  do {
    lineHeight = fontSize * 1.2;
    textHeight = Math.max(1, rows.length) * lineHeight;
    textHalfWidth = (maxCharacters * fontSize * 1.05) / 2;
    textInner = Math.max(
      WHEEL_RADIUS * PRIZE_TEXT_MIN_RADIUS_RATIO,
      (textHalfWidth + SECTOR_EDGE_GAP) / Math.tan(halfAngle),
    );
    textOuter = Math.hypot(textInner + textHeight, textHalfWidth);
    if (textOuter <= textLimit) break;
    fontSize -= 0.25;
  } while (fontSize > 5);
  return {
    angle: (angle * 180) / Math.PI,
    imageX: 240 + Math.sin(angle) * imageRadius,
    imageY: 240 - Math.cos(angle) * imageRadius,
    imageSize,
    imageRadius,
    imageInner,
    textRadius: textInner + textHeight / 2,
    textInner,
    textOuter,
    textHalfWidth,
    textHeight,
    fontSize,
    lineHeight,
  };
}

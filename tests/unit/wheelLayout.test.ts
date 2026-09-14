import { describe, it, expect } from "vitest";
import {
  prizeLayout,
  splitPrizeLabel,
  WHEEL_RADIUS,
  PRIZE_CONTENT_GAP,
} from "../../src/utils/wheelLayout";

describe("responsive prize layout", () => {
  it("wraps long Korean names at word boundaries", () => {
    expect(splitPrizeLabel("캐리마텍     타포린 백", 5)).toEqual([
      "캐리마텍",
      "타포린 백",
    ]);
    expect(splitPrizeLabel("대형 곰돌이 인형", 5)).toEqual([
      "대형 곰돌이",
      "인형",
    ]);
  });
  it("enlarges five-prize images by about 1.7 times", () => {
    expect(
      prizeLayout(5, 0, ["대형 곰돌이", "인형"], true).imageSize / 54,
    ).toBeGreaterThanOrEqual(1.7);
  });
  it("keeps upright images, labels, and hub separated for 2–12 sectors", () => {
    for (let count = 2; count <= 12; count++) {
      const lines = splitPrizeLabel("캐리마텍 타포린 백", count);
      for (const rows of [
        lines,
        [...lines, "100.0%"],
        [...lines, "100.0%", "상품설명"],
      ]) {
        for (let i = 0; i < count; i++) {
          const p = prizeLayout(count, i, rows, true);
          const disk = p.imageSize / Math.SQRT2;
          expect(p.imageRadius + disk).toBeLessThanOrEqual(WHEEL_RADIUS - 2.99);
          expect(disk).toBeLessThan(p.imageRadius * Math.sin(Math.PI / count));
          expect(p.textInner).toBeGreaterThanOrEqual(59);
          expect(p.textOuter + PRIZE_CONTENT_GAP).toBeLessThanOrEqual(
            p.imageInner + 0.001,
          );
          expect(p.textHalfWidth + 2.99).toBeLessThanOrEqual(
            p.textInner * Math.tan(Math.PI / count),
          );
          // Check square corners across a full counter-rotation, not just initial positions.
          for (let rotation = 0; rotation < 360; rotation += 5) {
            const a = (rotation * Math.PI) / 180;
            for (const x of [-p.imageSize / 2, p.imageSize / 2]) {
              for (const y of [-p.imageSize / 2, p.imageSize / 2]) {
                const cx = x * Math.cos(a) - y * Math.sin(a);
                const cy = -p.imageRadius + x * Math.sin(a) + y * Math.cos(a);
                expect(Math.hypot(cx, cy)).toBeLessThan(WHEEL_RADIUS);
                expect(Math.abs(Math.atan2(cx, -cy))).toBeLessThan(
                  Math.PI / count,
                );
              }
            }
          }
        }
      }
    }
  });
});

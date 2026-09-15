import { describe, it, expect } from "vitest";
import { cloneConfig } from "../../src/data/defaultConfig";
import { prizeRank } from "../../src/utils/prizeRank";
import { publicSettings } from "../../src/utils/github";
import { validateConfig } from "../../src/utils/validation";

describe("editable prize ranks", () => {
  it("supports existing settings and automatic rank labels", () => {
    const config = cloneConfig();
    expect(validateConfig(config)).toEqual([]);
    expect(config.prizes.map(prizeRank)).toEqual([
      "1등",
      "2등",
      "3등",
      "4등",
      "5등",
    ]);
    expect(prizeRank({ ...config.prizes[0], rankLabel: "  " }, 2)).toBe("3등");
    expect(prizeRank({ ...config.prizes[0], isLose: true }, 0)).toBe("꽝");
    expect(prizeRank({ ...config.prizes[0], rankLabel: " 특별상 " }, 0)).toBe(
      "특별상",
    );
  });

  it("exports custom ranks without changing order, probabilities or stock", () => {
    const config = cloneConfig();
    config.prizes[0].rankLabel = "특별상";
    config.prizes[1].rankLabel = "공동 1등";
    const exported = JSON.parse(JSON.stringify(publicSettings(config)));
    expect(exported.prizes).toEqual(config.prizes);
    expect(validateConfig(exported)).toEqual([]);
  });

  it("rejects invalid labels while allowing blanks and repeated ranks", () => {
    const config = cloneConfig();
    config.prizes.forEach((p) => {
      p.rankLabel = "1등";
    });
    expect(validateConfig(config)).toEqual([]);
    config.prizes[0].rankLabel = "";
    expect(validateConfig(config)).toEqual([]);
    config.prizes[0].rankLabel = "가".repeat(13);
    expect(validateConfig(config).join()).toContain("등수 / 구분");
    const invalid = JSON.parse(JSON.stringify(config));
    invalid.prizes[0].rankLabel = 1;
    expect(validateConfig(invalid).join()).toContain("등수 / 구분");
  });
});

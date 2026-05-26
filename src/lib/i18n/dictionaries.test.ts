import { describe, expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

describe("scanner UI copy", () => {
  it("uses the current 40/40/30 rank score formula", () => {
    expect(dictionaries.en.strategy.scoreWeights).toContain("opportunity 40%");
    expect(dictionaries.en.strategy.scoreWeights).toContain("confirmation 40%");
    expect(dictionaries.en.strategy.scoreWeights).toContain("risk 30%");
    expect(dictionaries.zh.strategy.scoreWeights).toContain("机会分 40%");
    expect(dictionaries.zh.strategy.scoreWeights).toContain("确认分 40%");
    expect(dictionaries.zh.strategy.scoreWeights).toContain("风险分 30%");
  });

  it("states that volume is context, not a standalone signal", () => {
    expect(dictionaries.en.strategy.volumeContext).toContain(
      "not a standalone trade signal",
    );
    expect(dictionaries.zh.strategy.volumeContext).toContain("不是独立交易信号");
  });
});

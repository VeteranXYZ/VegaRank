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
      "not a standalone decision signal",
    );
    expect(dictionaries.zh.strategy.volumeContext).toContain("不是独立交易信号");
  });

  it("localizes compact MACD table labels", () => {
    expect(dictionaries.en.scanner.macdTableImproving).toBe("Imp");
    expect(dictionaries.en.scanner.macdTableCross).toBe("Cross");
    expect(dictionaries.en.scanner.macdTableFade).toBe("Fade");
    expect(dictionaries.en.scanner.macdTableWeak).toBe("Weak");
    expect(dictionaries.en.scanner.macdTableFlat).toBe("Flat");
    expect(dictionaries.zh.scanner.macdTableImproving).toBe("改善");
    expect(dictionaries.zh.scanner.macdTableCross).toBe("金叉");
    expect(dictionaries.zh.scanner.macdTableFade).toBe("转弱");
    expect(dictionaries.zh.scanner.macdTableWeak).toBe("弱");
    expect(dictionaries.zh.scanner.macdTableFlat).toBe("平");
  });
});

import { describe, expect, it } from "vitest";
import { activeScannerCodes } from "./codeRegistry";
import { enScannerCodeDictionary } from "./dictionaries/en";
import { zhScannerCodeDictionary } from "./dictionaries/zh";
import { explainCode } from "./explainCode";

describe("VegaRank research codebook", () => {
  it("covers every active code in the English dictionary", () => {
    expect(activeScannerCodes).not.toHaveLength(0);

    for (const code of activeScannerCodes) {
      expect(enScannerCodeDictionary[code], code).toMatchObject({
        label: expect.any(String),
        short: expect.any(String),
      });
    }
  });

  it("covers every active code in the Chinese dictionary", () => {
    expect(activeScannerCodes).not.toHaveLength(0);

    for (const code of activeScannerCodes) {
      expect(zhScannerCodeDictionary[code], code).toMatchObject({
        label: expect.any(String),
        short: expect.any(String),
      });
    }
  });

  it("explains active codes in English", () => {
    expect(explainCode("GR_201", "en")).toEqual({
      label: "Constructive Watch",
      short: "Constructive evidence is developing, but confirmation remains limited.",
    });
    expect(explainCode("AC_501", "en").label).toBe("Research Watch");
  });

  it("explains active codes in Chinese", () => {
    expect(explainCode("GR_201", "zh")).toEqual({
      label: "建设性观察",
      short: "结构正在改善，但确认仍有限。",
    });
    expect(explainCode("AC_501", "zh").label).toBe("加入研究观察");
  });

  it("falls back safely for unknown codes", () => {
    expect(explainCode("ZZ_999", "en")).toEqual({
      label: "ZZ_999",
      short: "No explanation is available for this code yet.",
    });
    expect(explainCode("ZZ_999", "zh")).toEqual({
      label: "ZZ_999",
      short: "该代码暂无解释。",
    });
  });
});

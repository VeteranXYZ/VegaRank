import { describe, expect, it } from "vitest";
import {
  activeScannerCodes,
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "./codeRegistry";
import {
  enScannerCodeDictionary,
  manualEnglishScannerCodeEntries,
} from "./dictionaries/en";
import {
  generatedChineseBaselineScannerCodeEntries,
  manualChineseScannerCodeEntries,
  zhScannerCodeDictionary,
} from "./dictionaries/zh";

const intentionallyBaselineOnlyChineseCodes: ActiveScannerCode[] = [];

const forbiddenChineseTradingLanguage = [
  /买入/,
  /卖出/,
  /做多/,
  /做空/,
  /开仓/,
  /平仓/,
  /入场/,
  /出场/,
  /止盈/,
  /止损/,
  /抄底/,
  /梭哈/,
  /强烈买入/,
  /完美买点/,
  /交易信号/,
];

const forbiddenChineseHypeLanguage = [
  /暴涨/,
  /暴跌/,
  /起飞/,
  /月球/,
  /拉盘/,
  /稳赚/,
  /必涨/,
  /必跌/,
  /神级/,
  /无脑/,
  /必看/,
];

const forbiddenChineseConfidenceLanguage = [
  /上涨把握/,
  /成功率高/,
  /胜率高/,
  /确定性强/,
  /大概率上涨/,
];

const chineseFormulaDisclosureLanguage = [
  /\bRSI\s*[<>]/i,
  /RSI\s*(大于|小于)/,
  /\bvolumeRank\s*[<>=]/i,
  /\briskPenalty\s*\*/i,
  /阈值\s*=/,
  /私有权重/,
  /公式计算/,
];

describe("Chinese VegaRank codebook quality", () => {
  it("only defines Chinese dictionary keys that exist in the registry", () => {
    for (const code of Object.keys(zhScannerCodeDictionary)) {
      expect(scannerCodeRegistry[code as ActiveScannerCode], code).toBeDefined();
    }
  });

  it("uses manual Chinese copy for every active code unless explicitly exempted", () => {
    for (const code of activeScannerCodes) {
      if (intentionallyBaselineOnlyChineseCodes.includes(code)) {
        continue;
      }

      expect(manualChineseScannerCodeEntries[code], code).toBeDefined();
      expect(zhScannerCodeDictionary[code], code).toEqual(
        manualChineseScannerCodeEntries[code],
      );
    }
  });

  it("keeps Chinese and English dictionary entries structurally compatible", () => {
    for (const code of activeScannerCodes) {
      expect(Object.keys(zhScannerCodeDictionary[code]).sort(), code).toEqual(
        Object.keys(enScannerCodeDictionary[code]).sort(),
      );
    }
  });

  it("requires Chinese manual copy for every active English manual entry", () => {
    for (const code of Object.keys(manualEnglishScannerCodeEntries)) {
      expect(
        manualChineseScannerCodeEntries[code as ActiveScannerCode],
        code,
      ).toBeDefined();
    }
  });

  it("keeps Chinese entries structurally usable", () => {
    for (const [code, entry] of Object.entries(zhScannerCodeDictionary)) {
      expect(entry.label.trim(), `${code} label`).not.toBe("");
      expect(entry.short.trim(), `${code} short`).not.toBe("");
    }
  });

  it("keeps generated Chinese baseline entries available as a fallback", () => {
    expect(generatedChineseBaselineScannerCodeEntries.GR_101).toEqual({
      label: "GR_101",
      short: "该扫描代码已有记录，但暂无详细中文解释。",
    });
  });

  it("does not use trading-command, hype, prediction, or formula language", () => {
    const blockedPatterns = [
      ...forbiddenChineseTradingLanguage,
      ...forbiddenChineseHypeLanguage,
      ...forbiddenChineseConfidenceLanguage,
      ...chineseFormulaDisclosureLanguage,
    ];

    for (const code of activeScannerCodes) {
      const entry = zhScannerCodeDictionary[code];
      const text = `${entry.label} ${entry.short}`;

      for (const pattern of blockedPatterns) {
        expect(text, `${code} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("uses bounded Chinese terminology for eligible and high-priority groups", () => {
    expect(zhScannerCodeDictionary.GR_501.label).toBe("研究合格");
    expect(zhScannerCodeDictionary.GR_601.label).toBe("高优先级复核");
  });
});

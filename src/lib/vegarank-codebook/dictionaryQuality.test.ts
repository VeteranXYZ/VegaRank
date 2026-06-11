import { describe, expect, it } from "vitest";
import {
  activeScannerCodes,
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "./codeRegistry";
import {
  enScannerCodeDictionary,
  generatedEnglishBaselineScannerCodeEntries,
  manualEnglishScannerCodeEntries,
} from "./dictionaries/en";

const intentionallyBaselineOnlyEnglishCodes: ActiveScannerCode[] = [];

const forbiddenTradingLanguage = [
  /\bbuy\b/i,
  /\bsell\b/i,
  /\blong\b/i,
  /\bshort\b/i,
  /\bentry\b/i,
  /\bexit\b/i,
  /take profit/i,
  /stop loss/i,
  /trade now/i,
  /signal to trade/i,
];

const forbiddenHypeLanguage = [
  /\bmoon\b/i,
  /\bpump\b/i,
  /\bexplode\b/i,
  /\bguaranteed\b/i,
  /sure thing/i,
  /perfect setup/i,
  /will go up/i,
  /will crash/i,
  /will dump/i,
  /must buy/i,
  /must sell/i,
];

const formulaDisclosureLanguage = [
  /\bRSI\s*[<>]/i,
  /\bvolumeRank\s*[<>=]/i,
  /\briskPenalty\s*\*/i,
  /\bthreshold\s*=/i,
  /private weight/i,
  /formula says/i,
  /triggered when/i,
];

describe("English VegaRank codebook quality", () => {
  it("only defines English dictionary keys that exist in the registry", () => {
    for (const code of Object.keys(enScannerCodeDictionary)) {
      expect(scannerCodeRegistry[code as ActiveScannerCode], code).toBeDefined();
    }
  });

  it("uses manual English copy for every active code unless explicitly exempted", () => {
    for (const code of activeScannerCodes) {
      if (intentionallyBaselineOnlyEnglishCodes.includes(code)) {
        continue;
      }

      expect(manualEnglishScannerCodeEntries[code], code).toBeDefined();
      expect(enScannerCodeDictionary[code], code).toEqual(
        manualEnglishScannerCodeEntries[code],
      );
    }
  });

  it("requires manual English copy for user-facing research domains", () => {
    const requiredCategories = new Set(["group", "action", "risk", "setup", "quality"]);

    for (const metadata of Object.values(scannerCodeRegistry)) {
      if (!metadata.category || !requiredCategories.has(metadata.category)) {
        continue;
      }

      const code = metadata.code as keyof typeof manualEnglishScannerCodeEntries;
      expect(manualEnglishScannerCodeEntries[code], metadata.code).toBeDefined();
    }
  });

  it("keeps English entries structurally usable", () => {
    for (const [code, entry] of Object.entries(enScannerCodeDictionary)) {
      expect(entry.label.trim(), `${code} label`).not.toBe("");
      expect(entry.short.trim(), `${code} short`).not.toBe("");
    }
  });

  it("keeps generated baseline entries available as a fallback", () => {
    expect(generatedEnglishBaselineScannerCodeEntries.GR_101).toEqual({
      label: "Watch",
      short: "VegaRank research condition code.",
    });
  });

  it("does not use trading-command or hype language in active English copy", () => {
    const blockedPatterns = [
      ...forbiddenTradingLanguage,
      ...forbiddenHypeLanguage,
      ...formulaDisclosureLanguage,
    ];

    for (const code of activeScannerCodes) {
      const entry = enScannerCodeDictionary[code];
      const text = `${entry.label} ${entry.short}`;

      for (const pattern of blockedPatterns) {
        expect(text, `${code} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

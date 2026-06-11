import type { Language } from "@/lib/i18n/dictionaries";
import { enScannerCodeDictionary } from "./dictionaries/en";
import { zhScannerCodeDictionary } from "./dictionaries/zh";
import {
  looksLikeScannerCode,
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "./codeRegistry";
import type {
  ScannerCode,
  ScannerCodeDictionary,
  ScannerCodeExplanation,
} from "./codeTypes";

const dictionaries = {
  en: enScannerCodeDictionary,
  zh: zhScannerCodeDictionary,
} satisfies Record<Language, ScannerCodeDictionary>;

export function explainCode(
  code: string | null | undefined,
  language: Language = "en",
): ScannerCodeExplanation {
  const rawCode = typeof code === "string" && code.trim() ? code.trim() : "NX_801";
  const dictionary: ScannerCodeDictionary = dictionaries[language] ?? dictionaries.en;
  const entry = dictionary[rawCode as ScannerCode];

  if (entry) {
    return entry;
  }

  const registryEntry = scannerCodeRegistry[rawCode as ActiveScannerCode];

  if (registryEntry) {
    return {
      label: rawCode,
      short:
        language === "zh"
          ? "该代码暂无解释。"
          : "No explanation is available for this code yet.",
    };
  }

  return {
    label: rawCode,
    short:
      language === "zh"
        ? "该代码暂无解释。"
        : "No explanation is available for this code yet.",
  };
}

export function explainCodes(
  codes: Array<string | null | undefined> | null | undefined,
  language: Language = "en",
) {
  return [...new Set((codes ?? []).filter(isCodeLike))].map((code) =>
    explainCode(code, language),
  );
}

function isCodeLike(value: string | null | undefined): value is ScannerCode {
  return looksLikeScannerCode(value);
}

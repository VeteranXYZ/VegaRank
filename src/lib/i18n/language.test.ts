import { afterEach, describe, expect, it, vi } from "vitest";
import { dictionaries } from "./dictionaries";
import { formatScanEvaluationNote, formatScannerObservation } from "./formatScannerObservation";
import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_APP_LANGUAGE,
  getInitialAppLanguage,
  isSupportedAppLanguage,
  readSavedAppLanguage,
  saveAppLanguage,
} from "./language";

describe("app language helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to English without a browser window", () => {
    expect(readSavedAppLanguage()).toBe(DEFAULT_APP_LANGUAGE);
    expect(getInitialAppLanguage()).toBe("en");
  });

  it("falls back to English for missing or invalid saved values", () => {
    const storage = makeStorage();

    vi.stubGlobal("window", { localStorage: storage });

    expect(readSavedAppLanguage()).toBe("en");

    storage.setItem(APP_LANGUAGE_STORAGE_KEY, "fr");

    expect(readSavedAppLanguage()).toBe("en");
  });

  it("reads and writes supported languages from localStorage", () => {
    const storage = makeStorage();

    vi.stubGlobal("window", { localStorage: storage });
    saveAppLanguage("zh");

    expect(storage.getItem(APP_LANGUAGE_STORAGE_KEY)).toBe("zh");
    expect(readSavedAppLanguage()).toBe("zh");
    expect(isSupportedAppLanguage("zh")).toBe(true);
    expect(isSupportedAppLanguage("fr")).toBe(false);
  });

  it("renders scanner text from the selected saved language", () => {
    const storage = makeStorage();

    storage.setItem(APP_LANGUAGE_STORAGE_KEY, "zh");
    vi.stubGlobal("window", { localStorage: storage });

    const dictionary = dictionaries[getInitialAppLanguage()];

    expect(
      formatScannerObservation(
        {
          key: "confirmation.reclaimMa50",
          severity: "neutral",
          scope: "confirmation",
        },
        dictionary,
      ),
    ).toBe("价格需要重新收复 MA50。");
    expect(
      formatScanEvaluationNote(
        {
          key: "evaluation.riskOutcomeVerified",
          params: { outcome: "invalidated" },
        },
        dictionary,
      ),
    ).toBe("风险标签观察结果：invalidated。");
  });
});

function makeStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

export type AppLanguage = "en" | "zh";

export const DEFAULT_APP_LANGUAGE: AppLanguage = "en";
export const APP_LANGUAGE_STORAGE_KEY = "trade-scanner.language";

export function isSupportedAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "zh";
}

export function readSavedAppLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_APP_LANGUAGE;
  }

  try {
    const saved = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);

    return isSupportedAppLanguage(saved) ? saved : DEFAULT_APP_LANGUAGE;
  } catch {
    return DEFAULT_APP_LANGUAGE;
  }
}

export function saveAppLanguage(language: AppLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore unavailable storage; the in-memory selection still updates.
  }
}

export function getInitialAppLanguage(): AppLanguage {
  return readSavedAppLanguage();
}

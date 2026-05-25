"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dictionaries,
  languageLabels,
  type Language,
} from "@/lib/i18n/dictionaries";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  dictionary: (typeof dictionaries)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const storageKey = "trade-scanner-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "en" || stored === "zh") {
      // localStorage is client-only; restore after hydration to keep SSR stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(storageKey, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      dictionary: dictionaries[language],
    }),
    [language, setLanguage, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const nextLanguage: Language = language === "en" ? "zh" : "en";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--foreground)]"
    >
      {languageLabels[nextLanguage]}
    </button>
  );
}

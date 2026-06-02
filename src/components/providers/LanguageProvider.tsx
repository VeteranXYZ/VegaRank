"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { dictionaries, type Language } from "@/lib/i18n/dictionaries";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  dictionary: (typeof dictionaries)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const setLanguage = useCallback<LanguageContextValue["setLanguage"]>(
    () => undefined,
    [],
  );

  const toggleLanguage = useCallback(() => {
    return undefined;
  }, []);

  const value = useMemo(
    () => ({
      language: "en" as const,
      setLanguage,
      toggleLanguage,
      dictionary: dictionaries.en,
    }),
    [setLanguage, toggleLanguage],
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
  return null;
}

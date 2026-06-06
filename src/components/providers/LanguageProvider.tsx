"use client";

import type { ReactNode } from "react";
import { dictionaries } from "@/lib/i18n/dictionaries";

const legacyLanguageValue = {
  language: "en" as const,
  setLanguage: () => undefined,
  dictionary: dictionaries.en,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useLanguage() {
  return legacyLanguageValue;
}

export function LanguageToggle() {
  return null;
}

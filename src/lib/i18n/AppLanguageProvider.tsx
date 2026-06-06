"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_APP_LANGUAGE,
  getInitialAppLanguage,
  saveAppLanguage,
  type AppLanguage,
} from "@/lib/i18n/language";

type AppLanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  dictionary: (typeof dictionaries)[AppLanguage];
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);
const defaultAppLanguageContextValue: AppLanguageContextValue = {
  language: DEFAULT_APP_LANGUAGE,
  setLanguage: () => undefined,
  dictionary: dictionaries[DEFAULT_APP_LANGUAGE],
};
const appLanguageListeners = new Set<() => void>();

function emitAppLanguageChange() {
  appLanguageListeners.forEach((listener) => listener());
}

function subscribeAppLanguage(listener: () => void) {
  appLanguageListeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      appLanguageListeners.delete(listener);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === APP_LANGUAGE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    appLanguageListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getAppLanguageSnapshot() {
  return getInitialAppLanguage();
}

function getAppLanguageServerSnapshot() {
  return DEFAULT_APP_LANGUAGE;
}

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeAppLanguage,
    getAppLanguageSnapshot,
    getAppLanguageServerSnapshot,
  );

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    saveAppLanguage(nextLanguage);
    emitAppLanguageChange();
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      dictionary: dictionaries[language],
    }),
    [language, setLanguage],
  );

  return (
    <AppLanguageContext.Provider value={value}>
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage() {
  return useContext(AppLanguageContext) ?? defaultAppLanguageContextValue;
}

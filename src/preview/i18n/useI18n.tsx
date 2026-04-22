import React, { createContext, useContext, useMemo } from 'react';
import { de, en } from './dict.js';
import type { Dict, PersistentStatus } from './dict.js';

export type Locale = 'de' | 'en';

interface I18nContextValue {
  locale: Locale;
  t: Dict;
  /** Map a persistent EN status value to the active-locale label. */
  statusLabel: (status: PersistentStatus) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const DICTS: Record<Locale, Dict> = { de, en };

export function I18nProvider({
  children,
  locale = 'de',
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const t = DICTS[locale] ?? DICTS.de;
    return {
      locale,
      t,
      statusLabel: (status) => {
        if (status === 'open') return t.properties.status_open;
        if (status === 'done') return t.properties.status_done;
        return t.properties.status_blocked;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Fallback: when no provider is mounted (leaf components under test or
  // third-party hosts) DE is the sensible default. Matches the
  // `useTheme()` fallback pattern elsewhere.
  return {
    locale: 'de',
    t: de,
    statusLabel: (status) => {
      if (status === 'open') return de.properties.status_open;
      if (status === 'done') return de.properties.status_done;
      return de.properties.status_blocked;
    },
  };
}

export type { Dict, PersistentStatus };

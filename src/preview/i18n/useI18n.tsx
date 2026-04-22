import React, { createContext, useContext, useMemo } from 'react';
import { de } from './dict.js';
import type { Dict, PersistentStatus } from './dict.js';

// v1.1: DE only. EN shape in dict.ts is ready for the second-locale
// audit; narrowing here prevents the VisoEditor prop from accepting
// 'en' at the type level (kieran-review B1).
export type Locale = 'de';

interface I18nContextValue {
  locale: Locale;
  t: Dict;
  /** Map a persistent EN status value to the active-locale label. */
  statusLabel: (status: PersistentStatus) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const DICTS: Record<Locale, Dict> = { de };

// Module-level const so the fallback path does not allocate a new
// object per `useI18n()` call — downstream consumers memoize cheaply.
const FALLBACK_VALUE: I18nContextValue = {
  locale: 'de',
  t: de,
  statusLabel: (status) => {
    if (status === 'open') return de.properties.status_open;
    if (status === 'done') return de.properties.status_done;
    return de.properties.status_blocked;
  },
};

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
  return ctx ?? FALLBACK_VALUE;
}

export type { Dict, PersistentStatus };

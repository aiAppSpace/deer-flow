import type { Locale } from "@/core/i18n/locale";

let locale: Locale | null = null;
const listeners = new Set<() => void>();

export function getUiLocale() {
  return locale;
}

/** Report the displayed language without loading the authenticated sync runtime. */
export function reportUiLocale(next: Locale) {
  if (locale === next) return;
  locale = next;
  for (const listener of listeners) listener();
}

export function subscribeUiLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

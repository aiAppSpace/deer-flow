import { fetch as apiFetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import type { Locale } from "@/core/i18n/locale";

import { safeLocalStorage, type LocalSettings } from "./local";
import {
  parsePreferences,
  PreferencesSync,
  type Preferences,
} from "./preferences-sync";
import { activatePreferences } from "./store";
import { getUiLocale, subscribeUiLocale } from "./ui-locale";

export const PREFERENCES_KEY_PREFIX = "deerflow.preferences.";
let activeStop: (() => void) | undefined;

/** Retire the authenticated owner before logout changes the shared cookie. */
export function stopUserPreferences() {
  activeStop?.();
}

export { reportUiLocale } from "./ui-locale";

function readJSON(read: () => string | null): Preferences {
  try {
    return parsePreferences(JSON.parse(read() ?? "{}"));
  } catch {
    return {};
  }
}

export function preferencesFromSettings(settings: LocalSettings): Preferences {
  return {
    notification_enabled: settings.notification.enabled,
    model_name: settings.context.model_name ?? null,
    mode: settings.context.mode ?? null,
    reasoning_effort: settings.context.reasoning_effort ?? null,
  };
}

/** Network lifecycle is attached to the authenticated workspace, never render. */
export function startUserPreferences(
  userId: string,
  options: { deferInitialApply?: boolean } = {},
) {
  stopUserPreferences();
  const key = `${PREFERENCES_KEY_PREFIX}${userId}`;
  // sessionStorage is tab-local; a sibling tab cannot overwrite our outbox.
  const outbox = `${key}.pending`;
  const abort = new AbortController();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = 1000;
  let flushing = false;
  const request = async (method: "GET" | "PATCH", value?: Preferences) => {
    const response = await apiFetch(
      `${getBackendBaseURL()}/api/v1/auth/preferences`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Expected-User-Id": userId,
        },
        body: value ? JSON.stringify(value) : undefined,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
        cache: "no-store",
      },
    );
    if (response.status === 409 || response.status === 403) {
      // A cookie can switch accounts in another tab before useAuth updates.
      // Keep this account's outbox, but never retry it under the new identity.
      stop();
    }
    if (!response.ok)
      throw new Error(`Preferences request failed: ${response.status}`);
    return response;
  };
  let apply: (value: Preferences) => void = () => undefined;
  // What the account currently holds (confirmed plus pending edits), whether
  // the server's copy has been read at least once, and whether that Gateway
  // knows the `locale` preference (an older one rejects unknown fields, which
  // would hold every other preference edit in the outbox).
  let effective: Preferences = {};
  let remoteLoaded = false;
  let localeSupported = false;
  // The UI language this session last reconciled with the account.
  let syncedLocale: Locale | null = null;
  const syncLocale = () => {
    const uiLocale = getUiLocale();
    if (stopped || !remoteLoaded || !localeSupported || uiLocale === null)
      return;
    // Once per session (after the first read) and on every language switch.
    // A later read showing another device's language is not written back, so
    // two devices in different languages do not overwrite each other on
    // every focus.
    if (syncedLocale === uiLocale) return;
    syncedLocale = uiLocale;
    if (effective.locale === uiLocale) return;
    sync.edit({ locale: uiLocale });
    wake();
  };
  const cached = readJSON(() => safeLocalStorage.getItem(key));
  const pending = readJSON(() => window.sessionStorage.getItem(outbox));
  const sync = new PreferencesSync(
    {
      read: async () => {
        const body: unknown = await (await request("GET")).json();
        localeSupported =
          typeof body === "object" &&
          body !== null &&
          Object.hasOwn(body, "locale");
        remoteLoaded = true;
        if (!localeSupported) sync.discardPending("locale");
        return parsePreferences(body);
      },
      patch: async (value) => {
        await request("PATCH", value);
      },
      saveConfirmed: (value) => {
        const serialized = JSON.stringify(value);
        if (safeLocalStorage.getItem(key) !== serialized)
          safeLocalStorage.setItem(key, serialized);
      },
      apply: (value) => {
        effective = value;
        apply(value);
        // After the first read: save the UI language if the account differs.
        syncLocale();
      },
      savePending: (value) => {
        try {
          window.sessionStorage.setItem(outbox, JSON.stringify(value));
        } catch {
          // Storage restrictions must not disable the in-memory outbox.
        }
      },
    },
    cached,
    pending,
  );

  const wake = () => {
    if (stopped || flushing) return;
    clearTimeout(timer);
    timer = undefined;
    flushing = true;
    void sync
      .flush()
      .then(() => {
        retryMs = 1000;
      })
      .catch(() => {
        if (stopped) return;
        timer = setTimeout(wake, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
      })
      .finally(() => {
        flushing = false;
        // An edit can arrive after the loop settled but before this continuation.
        if (!stopped && sync.hasPending && timer === undefined) wake();
      });
  };
  const detach = activatePreferences(
    options.deferInitialApply ? {} : { ...cached, ...pending },
    (before, after) => {
      const oldValue = preferencesFromSettings(before);
      const newValue = preferencesFromSettings(after);
      const changes = Object.fromEntries(
        Object.entries(newValue).filter(
          ([field, value]) => oldValue[field as keyof Preferences] !== value,
        ),
      );
      if (Object.keys(changes).length) {
        sync.edit(parsePreferences(changes));
        wake();
      }
    },
  );
  const activate = () => {
    if (stopped) return;
    apply = detach.apply;
    apply(effective);
  };
  if (!options.deferInitialApply) activate();
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) wake();
  };
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    abort.abort();
    sync.stop();
    detach.stop();
    window.removeEventListener("focus", wake);
    window.removeEventListener("online", wake);
    window.removeEventListener("storage", onStorage);
    unsubscribeLocale();
    if (activeStop === stop) activeStop = undefined;
  }
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  window.addEventListener("storage", onStorage);
  const unsubscribeLocale = subscribeUiLocale(syncLocale);
  activeStop = stop;
  wake();
  return Object.assign(stop, { activate });
}

/**
 * Quota cache that survives route switches.
 */

import { create } from 'zustand';
import { getQuotaCacheFileName } from '@/utils/quota/identity';
import type {
  AntigravityQuotaState,
  ClaudeQuotaState,
  CodexQuotaState,
  DevinQuotaState,
  KimiQuotaState,
  MetaQuotaState,
  PluginQuotaState,
  XaiQuotaState,
} from '@/types';

type QuotaUpdater<T> = T | ((prev: T) => T);

interface QuotaStoreState {
  cacheGeneration: number;
  fileGenerations: Record<string, number>;
  antigravityQuota: Record<string, AntigravityQuotaState>;
  claudeQuota: Record<string, ClaudeQuotaState>;
  codexQuota: Record<string, CodexQuotaState>;
  devinQuota: Record<string, DevinQuotaState>;
  kimiQuota: Record<string, KimiQuotaState>;
  metaQuota: Record<string, MetaQuotaState>;
  pluginQuota: Record<string, PluginQuotaState>;
  xaiQuota: Record<string, XaiQuotaState>;
  setAntigravityQuota: (updater: QuotaUpdater<Record<string, AntigravityQuotaState>>) => void;
  setClaudeQuota: (updater: QuotaUpdater<Record<string, ClaudeQuotaState>>) => void;
  setCodexQuota: (updater: QuotaUpdater<Record<string, CodexQuotaState>>) => void;
  setDevinQuota: (updater: QuotaUpdater<Record<string, DevinQuotaState>>) => void;
  setKimiQuota: (updater: QuotaUpdater<Record<string, KimiQuotaState>>) => void;
  setMetaQuota: (updater: QuotaUpdater<Record<string, MetaQuotaState>>) => void;
  setPluginQuota: (updater: QuotaUpdater<Record<string, PluginQuotaState>>) => void;
  setXaiQuota: (updater: QuotaUpdater<Record<string, XaiQuotaState>>) => void;
  hydrateQuotaCache: (apiBase: string) => void;
  clearQuotaCache: (names?: string[]) => void;
}

const resolveUpdater = <T>(updater: QuotaUpdater<T>, prev: T): T => {
  if (typeof updater === 'function') {
    return (updater as (value: T) => T)(prev);
  }
  return updater;
};

/**
 * Persisted quota cache: keeps the last fetched quota display across page
 * reloads, colored state included, until the next manual refresh updates it.
 * Loading snapshots are never persisted, so an interrupted refresh falls back
 * to the idle prompt on the next visit instead of appearing stuck.
 */
const QUOTA_PERSIST_STORAGE_KEY = 'cpamc-quota-cache-v1';
const QUOTA_PERSIST_MAX_BYTES = 2_000_000;

type PersistedQuotaMaps = Pick<
  QuotaStoreState,
  | 'antigravityQuota'
  | 'claudeQuota'
  | 'codexQuota'
  | 'devinQuota'
  | 'kimiQuota'
  | 'metaQuota'
  | 'pluginQuota'
  | 'xaiQuota'
>;

type PersistedQuotaSnapshot = { apiBase: string; maps: PersistedQuotaMaps };

// Server identity the current persisted snapshot belongs to. Set on login
// (hydrateQuotaCache); quota updates are only persisted once bound to a server.
let persistedQuotaApiBase = '';

const omitLoadingEntries = <T extends { status: string }>(
  cache: Record<string, T>
): Record<string, T> => {
  let changed = false;
  const next: Record<string, T> = {};
  for (const [key, quota] of Object.entries(cache)) {
    if (quota && quota.status === 'loading') {
      changed = true;
      continue;
    }
    next[key] = quota;
  }
  return changed ? next : cache;
};

const sanitizePersistedQuotaMaps = (maps: PersistedQuotaMaps): PersistedQuotaMaps => ({
  antigravityQuota: omitLoadingEntries(maps.antigravityQuota),
  claudeQuota: omitLoadingEntries(maps.claudeQuota),
  codexQuota: omitLoadingEntries(maps.codexQuota),
  devinQuota: omitLoadingEntries(maps.devinQuota),
  kimiQuota: omitLoadingEntries(maps.kimiQuota),
  metaQuota: omitLoadingEntries(maps.metaQuota),
  pluginQuota: omitLoadingEntries(maps.pluginQuota),
  xaiQuota: omitLoadingEntries(maps.xaiQuota),
});

const readPersistedQuotaSnapshot = (): PersistedQuotaSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(QUOTA_PERSIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as (Partial<PersistedQuotaMaps> & { apiBase?: unknown }) | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const apiBase = typeof parsed.apiBase === 'string' ? parsed.apiBase : '';
    return {
      apiBase,
      maps: sanitizePersistedQuotaMaps({
        antigravityQuota: parsed.antigravityQuota ?? {},
        claudeQuota: parsed.claudeQuota ?? {},
        codexQuota: parsed.codexQuota ?? {},
        devinQuota: parsed.devinQuota ?? {},
        kimiQuota: parsed.kimiQuota ?? {},
        metaQuota: parsed.metaQuota ?? {},
        pluginQuota: parsed.pluginQuota ?? {},
        xaiQuota: parsed.xaiQuota ?? {},
      }),
    };
  } catch {
    return null;
  }
};

const persistQuotaMaps = (state: QuotaStoreState): void => {
  if (!persistedQuotaApiBase) return;
  try {
    const payload = JSON.stringify({
      apiBase: persistedQuotaApiBase,
      ...sanitizePersistedQuotaMaps({
        antigravityQuota: state.antigravityQuota,
        claudeQuota: state.claudeQuota,
        codexQuota: state.codexQuota,
        devinQuota: state.devinQuota,
        kimiQuota: state.kimiQuota,
        metaQuota: state.metaQuota,
        pluginQuota: state.pluginQuota,
        xaiQuota: state.xaiQuota,
      }),
    });
    if (payload.length > QUOTA_PERSIST_MAX_BYTES) return;
    window.localStorage.setItem(QUOTA_PERSIST_STORAGE_KEY, payload);
  } catch {
    // Storage unavailable or full: the in-memory cache still works.
  }
};

export const useQuotaStore = create<QuotaStoreState>((set) => ({
  cacheGeneration: 0,
  fileGenerations: {},
  antigravityQuota: {},
  claudeQuota: {},
  codexQuota: {},
  devinQuota: {},
  kimiQuota: {},
  metaQuota: {},
  pluginQuota: {},
  xaiQuota: {},
  hydrateQuotaCache: (apiBase) =>
    set(() => {
      persistedQuotaApiBase = apiBase || '';
      if (!persistedQuotaApiBase) return {};
      const snapshot = readPersistedQuotaSnapshot();
      // Reconnect to the same server: restore the last fetched quota display.
      // A different server starts from an empty cache on purpose.
      if (!snapshot || snapshot.apiBase !== persistedQuotaApiBase) return {};
      return snapshot.maps;
    }),
  setAntigravityQuota: (updater) =>
    set((state) => ({
      antigravityQuota: resolveUpdater(updater, state.antigravityQuota),
    })),
  setClaudeQuota: (updater) =>
    set((state) => {
      const next = resolveUpdater(updater, state.claudeQuota);
      let retained = next;
      for (const [key, quota] of Object.entries(next)) {
        const previous = state.claudeQuota[key];
        if (
          previous &&
          quota !== previous &&
          (quota.status === 'loading' || quota.status === 'error') &&
          !quota.observedAt &&
          (previous.observedAt ||
            previous.windows.length ||
            previous.extraUsage ||
            previous.dollarWindows?.length)
        ) {
          if (retained === next) retained = { ...next };
          retained[key] = {
            ...quota,
            windows: previous.windows,
            extraUsage: previous.extraUsage,
            dollarWindows: previous.dollarWindows,
            observedAt: previous.observedAt,
            planType: previous.planType,
            stale: quota.status === 'error' || previous.stale,
          };
        }
      }
      return { claudeQuota: retained };
    }),
  setCodexQuota: (updater) =>
    set((state) => ({
      codexQuota: resolveUpdater(updater, state.codexQuota),
    })),
  setDevinQuota: (updater) =>
    set((state) => ({
      devinQuota: resolveUpdater(updater, state.devinQuota),
    })),
  setKimiQuota: (updater) =>
    set((state) => ({
      kimiQuota: resolveUpdater(updater, state.kimiQuota),
    })),
  setMetaQuota: (updater) =>
    set((state) => ({ metaQuota: resolveUpdater(updater, state.metaQuota) })),
  setPluginQuota: (updater) =>
    set((state) => ({
      pluginQuota: resolveUpdater(updater, state.pluginQuota),
    })),
  setXaiQuota: (updater) =>
    set((state) => ({
      xaiQuota: resolveUpdater(updater, state.xaiQuota),
  })),
  clearQuotaCache: (names) =>
    set((state) => {
      if (names) {
        if (names.length === 0) return state;
        const fileGenerations = { ...state.fileGenerations };
        names.forEach((name) => {
          fileGenerations[name] = (fileGenerations[name] ?? 0) + 1;
        });
        const invalidatedNames = new Set(names);
        const omitNames = <T>(cache: Record<string, T>): Record<string, T> => {
          const keysToDelete = Object.keys(cache).filter((key) =>
            invalidatedNames.has(getQuotaCacheFileName(key))
          );
          if (keysToDelete.length === 0) return cache;
          const next = { ...cache };
          keysToDelete.forEach((key) => delete next[key]);
          return next;
        };
        return {
          fileGenerations,
          antigravityQuota: omitNames(state.antigravityQuota),
          claudeQuota: omitNames(state.claudeQuota),
          codexQuota: omitNames(state.codexQuota),
          devinQuota: omitNames(state.devinQuota),
          kimiQuota: omitNames(state.kimiQuota),
          metaQuota: omitNames(state.metaQuota),
          pluginQuota: omitNames(state.pluginQuota),
          xaiQuota: omitNames(state.xaiQuota),
        };
      }
      return {
        cacheGeneration: state.cacheGeneration + 1,
        fileGenerations: {},
        antigravityQuota: {},
        claudeQuota: {},
        codexQuota: {},
        devinQuota: {},
        kimiQuota: {},
        metaQuota: {},
        pluginQuota: {},
        xaiQuota: {},
      };
    }),
}));

// Mirror every quota cache mutation into localStorage so a page reload keeps
// rendering the last fetched (colored) quota display until the next manual refresh.
useQuotaStore.subscribe((state) => {
  persistQuotaMaps(state);
});

export const captureQuotaCacheGeneration = (name?: string) => {
  const { cacheGeneration, fileGenerations } = useQuotaStore.getState();
  return { cacheGeneration, fileGenerations, name };
};

export const commitIfQuotaCacheCurrent = (
  generation: ReturnType<typeof captureQuotaCacheGeneration>,
  commit: () => void,
  name: string | undefined = generation.name
): boolean => {
  const current = useQuotaStore.getState();
  if (current.cacheGeneration !== generation.cacheGeneration) return false;
  // File-scoped requests survive mutations to unrelated credentials.
  if (name !== undefined) {
    if ((current.fileGenerations[name] ?? 0) !== (generation.fileGenerations[name] ?? 0)) {
      return false;
    }
  } else if (current.fileGenerations !== generation.fileGenerations) {
    return false;
  }
  commit();
  return true;
};

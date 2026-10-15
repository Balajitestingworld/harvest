import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { runWatchChecks, type WatchAlert, type WatchItem } from '@harvest/core';
import { search } from '@/lib/api';
import { loadWatch, saveWatch } from '@/lib/vault-storage';

export const MAX_WATCH = 10;

interface WatchState {
  items: WatchItem[];
  add: (query: string, targetPrice?: number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  remove: (id: string) => Promise<void>;
  /** Re-check every item now. Returns the alerts found. */
  checkNow: () => Promise<{ item: WatchItem; alert: WatchAlert }[]>;
  checking: boolean;
}

const Ctx = createContext<WatchState | null>(null);
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * The watchlist holds only search words and a target price, never card
 * details, so reading it needs no Face ID and background checks can run.
 */
export function WatchProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    loadWatch().then(setItems).catch(() => {});
  }, []);

  const persist = useCallback(async (next: WatchItem[]) => {
    setItems(next);
    await saveWatch(next);
  }, []);

  const add = useCallback<WatchState['add']>(
    async (query, targetPrice) => {
      const q = query.trim();
      if (q.length < 2) return { ok: false, error: 'Type at least 2 characters.' };
      if (items.length >= MAX_WATCH) return { ok: false, error: `You can watch up to ${MAX_WATCH} items.` };
      if (items.some((i) => i.query.toLowerCase() === q.toLowerCase())) {
        return { ok: false, error: 'You are already watching that.' };
      }
      const target = targetPrice && targetPrice > 0 ? Math.round(targetPrice) : null;
      await persist([...items, { id: newId(), query: q, targetPrice: target, createdAt: new Date().toISOString() }]);
      return { ok: true };
    },
    [items, persist],
  );

  const remove = useCallback(async (id: string) => persist(items.filter((i) => i.id !== id)), [items, persist]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const r = await runWatchChecks(items, (q) => search(q));
      await persist(r.items);
      return r.alerts;
    } finally {
      setChecking(false);
    }
  }, [items, persist]);

  const value = useMemo(() => ({ items, add, remove, checkNow, checking }), [items, add, remove, checkNow, checking]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWatch(): WatchState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWatch must be used inside <WatchProvider>');
  return v;
}

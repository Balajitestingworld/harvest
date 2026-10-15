import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { containsPan, PAN_ERROR, type VaultCard } from '@harvest/core';
import { clearVault, loadApps, loadVault, saveApps, saveVault } from '@/lib/vault-storage';
import { unlock as osUnlock } from '@/lib/auth';

const MAX_CARDS = 20;

interface VaultState {
  ready: boolean;
  locked: boolean;
  cards: VaultCard[];
  /** UPI / wallet apps the user has (slugs). Stored on device, never sent. */
  apps: string[];
  toggleApp: (slug: string) => Promise<void>;
  unlock: () => Promise<boolean>;
  addCard: (card: Omit<VaultCard, 'id'>) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeCard: (id: string) => Promise<void>;
  wipe: () => Promise<void>;
}

const Ctx = createContext<VaultState | null>(null);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function VaultProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [cards, setCards] = useState<VaultCard[]>([]);
  const [apps, setApps] = useState<string[]>([]);

  // Cards are only read into memory after the OS unlock succeeds.
  const unlock = useCallback(async () => {
    const ok = await osUnlock();
    if (ok) {
      const [c, a] = await Promise.all([loadVault(), loadApps()]);
      setCards(c);
      setApps(a);
      setLocked(false);
    }
    return ok;
  }, []);

  useEffect(() => {
    // The web vault has no OS lock to ask for, so open it straight away.
    if (Platform.OS === 'web') unlock().finally(() => setReady(true));
    else setReady(true);
  }, [unlock]);

  const addCard = useCallback<VaultState['addCard']>(
    async (card) => {
      if (locked) return { ok: false, error: 'Unlock your cards first.' };
      if (containsPan(card.nickname) || containsPan(card.tier)) return { ok: false, error: PAN_ERROR };
      if (cards.length >= MAX_CARDS) return { ok: false, error: `You can save up to ${MAX_CARDS} cards.` };
      const duplicate = cards.some(
        (c) => c.issuer === card.issuer && c.network === card.network && c.type === card.type && (c.tier ?? '') === (card.tier ?? ''),
      );
      if (duplicate) return { ok: false, error: 'That card is already in your list.' };
      const next = [...cards, { ...card, nickname: card.nickname?.trim() || undefined, id: newId() }];
      await saveVault(next);
      setCards(next);
      return { ok: true };
    },
    [cards, locked],
  );

  const removeCard = useCallback(
    async (id: string) => {
      const next = cards.filter((c) => c.id !== id);
      await saveVault(next);
      setCards(next);
    },
    [cards],
  );

  const toggleApp = useCallback(
    async (slug: string) => {
      if (locked) return;
      const next = apps.includes(slug) ? apps.filter((a) => a !== slug) : [...apps, slug];
      await saveApps(next);
      setApps(next);
    },
    [apps, locked],
  );

  const wipe = useCallback(async () => {
    await clearVault();
    setCards([]);
    setApps([]);
  }, []);

  const value = useMemo(
    () => ({ ready, locked, cards, apps, toggleApp, unlock, addCard, removeCard, wipe }),
    [ready, locked, cards, apps, toggleApp, unlock, addCard, removeCard, wipe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVault(): VaultState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVault must be used inside <VaultProvider>');
  return v;
}

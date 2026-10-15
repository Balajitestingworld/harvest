/**
 * Web storage. Browsers have no Keystore, so everything lives in this
 * browser's localStorage only — still never sent to any server. The vault only
 * ever holds issuer/network/type, never card numbers (R-001).
 */
import type { VaultCard, WatchItem } from '@harvest/core';

function read<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage blocked: data lasts for this session only.
  }
}

export const loadVault = async () => read<VaultCard>('harvest.vault.v1');
export const saveVault = async (cards: VaultCard[]) => write('harvest.vault.v1', cards);
export const loadApps = async () => read<string>('harvest.apps.v1');
export const saveApps = async (apps: string[]) => write('harvest.apps.v1', apps);
export const loadWatch = async () => read<WatchItem>('harvest.watch.v1');
export const saveWatch = async (items: WatchItem[]) => write('harvest.watch.v1', items);

export async function clearVault(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem('harvest.vault.v1');
    globalThis.localStorage?.removeItem('harvest.apps.v1');
  } catch {}
}

export const STORAGE_LABEL = 'Saved in this browser only';

/**
 * Native storage (Android/iOS): Expo SecureStore, which encrypts with Android
 * Keystore / iOS Keychain. The web build uses vault-storage.web.ts.
 * Nothing in here touches the network (ACC-001).
 *
 *  - cards + payment apps: only readable while the phone is unlocked, and the
 *    app asks for Face ID / fingerprint before loading them.
 *  - watchlist: product names and target prices only (no card data). It must be
 *    readable by the background price check, so it uses "after first unlock".
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { VaultCard, WatchItem } from '@harvest/core';

const VAULT: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const BACKGROUND_READABLE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function read<T>(key: string, opts: SecureStore.SecureStoreOptions): Promise<T[]> {
  try {
    const raw = await SecureStore.getItemAsync(key, opts);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const loadVault = () => read<VaultCard>('harvest.vault.v1', VAULT);
export const saveVault = (cards: VaultCard[]) => SecureStore.setItemAsync('harvest.vault.v1', JSON.stringify(cards), VAULT);

export const loadApps = () => read<string>('harvest.apps.v1', VAULT);
export const saveApps = (apps: string[]) => SecureStore.setItemAsync('harvest.apps.v1', JSON.stringify(apps), VAULT);

export const loadWatch = () => read<WatchItem>('harvest.watch.v1', BACKGROUND_READABLE);
export const saveWatch = (items: WatchItem[]) => SecureStore.setItemAsync('harvest.watch.v1', JSON.stringify(items), BACKGROUND_READABLE);

export async function clearVault(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync('harvest.vault.v1', VAULT),
    SecureStore.deleteItemAsync('harvest.apps.v1', VAULT),
  ]);
}

export const STORAGE_LABEL =
  Platform.OS === 'ios' ? 'Encrypted on this iPhone by Keychain' : 'Encrypted on this phone by Android Keystore';

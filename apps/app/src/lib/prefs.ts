/**
 * Tiny non-sensitive flags (e.g. "onboarding seen", "include EMI offers").
 * Kept out of the vault so reading them never needs a biometric prompt.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getFlag(key: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(`harvest.${key}`) === '1';
    return (await SecureStore.getItemAsync(`harvest.${key}`)) === '1';
  } catch {
    return false;
  }
}

export async function setFlag(key: string, on = true): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (on) globalThis.localStorage?.setItem(`harvest.${key}`, '1');
      else globalThis.localStorage?.removeItem(`harvest.${key}`);
    } else if (on) await SecureStore.setItemAsync(`harvest.${key}`, '1');
    else await SecureStore.deleteItemAsync(`harvest.${key}`);
  } catch {}
}

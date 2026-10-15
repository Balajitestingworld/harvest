/**
 * BR-006: OS-level biometric unlock for the vault. Falls back to the device
 * PIN/pattern if no fingerprint/face is enrolled; if the phone has no screen
 * lock at all, the vault opens (there is nothing stronger to ask for).
 */
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export async function unlock(reason = 'Unlock your cards'): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

export const BIOMETRICS_AVAILABLE = true;

/** What to call the lock in buttons: "Face ID" on iPhone, "fingerprint" on Android. */
export const LOCK_NAME = Platform.OS === 'ios' ? 'Face ID' : 'fingerprint';

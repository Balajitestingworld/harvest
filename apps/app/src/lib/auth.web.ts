// Browsers have no biometric vault API we rely on; the web vault is unlocked.
export async function unlock(): Promise<boolean> {
  return true;
}

export const BIOMETRICS_AVAILABLE = false;

export const LOCK_NAME = 'browser';

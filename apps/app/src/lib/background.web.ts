/** Web has no background tasks or push; checks happen when the user taps "Check prices now". */
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export async function registerWatchTask(): Promise<void> {}

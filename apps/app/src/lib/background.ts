/**
 * Background price checks (iOS/Android). The OS decides when to run the task
 * (roughly every few hours at best), so alerts are "soon", not instant.
 * The task reads only the watchlist (search words + target), never the card vault.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { describeAlert, formatINR, runWatchChecks } from '@harvest/core';
import { search } from '@/lib/api';
import { loadWatch, saveWatch } from '@/lib/vault-storage';

const TASK = 'harvest-watch-check';

TaskManager.defineTask(TASK, async () => {
  try {
    const items = await loadWatch();
    if (!items.length) return BackgroundTask.BackgroundTaskResult.Success;
    const r = await runWatchChecks(items, (q) => search(q));
    await saveWatch(r.items);
    for (const { item, alert } of r.alerts) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Price alert', body: describeAlert(item.query, alert, formatINR) },
        trigger: null,
      });
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function registerWatchTask(): Promise<void> {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 6 * 60 });
  } catch {
    // Not available (e.g. Expo Go on some devices): manual checks still work.
  }
}

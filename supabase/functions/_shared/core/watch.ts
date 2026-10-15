import type { SearchResponse } from './types.ts';

/**
 * Price watching, local-first. The watchlist lives on the phone. A check is
 * just an ordinary anonymous search; deciding whether to alert happens here,
 * on the device. The server never learns what anyone is watching.
 *
 * Background checks can't ask for Face ID, so they compare store prices (not
 * card-adjusted ones). Cards only make the real price lower.
 */

export interface WatchItem {
  id: string;
  query: string;
  /** Alert when the lowest store price reaches this. Optional. */
  targetPrice?: number | null;
  /** Lowest store price at the previous check. */
  lastPrice?: number | null;
  lastChecked?: string | null;
  createdAt: string;
}

export interface WatchAlert {
  reason: 'target' | 'drop';
  merchantName: string;
  price: number;
  previous: number | null;
}

export interface WatchCheck {
  update: Pick<WatchItem, 'lastPrice' | 'lastChecked'>;
  alert: WatchAlert | null;
}

/** A drop of at least this much since the last check is worth a notification. */
export const DROP_ALERT_RATIO = 0.97;

export function evaluateWatch(w: WatchItem, res: SearchResponse, now: Date = new Date()): WatchCheck | null {
  const priced = res.listings
    .map((l) => ({ name: l.merchantName, total: l.price + (l.shipping ?? 0) }))
    .filter((l) => Number.isFinite(l.total) && l.total > 0)
    .sort((a, b) => a.total - b.total);
  const best = priced[0];
  if (!best) return null;

  const last = w.lastPrice ?? null;
  const target = w.targetPrice ?? null;
  let alert: WatchAlert | null = null;
  if (target != null && best.total <= target && (last == null || last > target)) {
    alert = { reason: 'target', merchantName: best.name, price: best.total, previous: last };
  } else if (last != null && best.total <= last * DROP_ALERT_RATIO) {
    alert = { reason: 'drop', merchantName: best.name, price: best.total, previous: last };
  }
  return { update: { lastPrice: best.total, lastChecked: now.toISOString() }, alert };
}

/** One line for a notification or list row. */
export function describeAlert(query: string, a: WatchAlert, fmt: (n: number) => string): string {
  const was = a.previous != null ? ` (was ${fmt(a.previous)})` : '';
  return a.reason === 'target'
    ? `${query} reached your target: ${fmt(a.price)} at ${a.merchantName}${was}`
    : `${query} dropped to ${fmt(a.price)} at ${a.merchantName}${was}`;
}

/**
 * Check every item with the given search function. Failures on one item don't
 * stop the others. Returns updated items plus any alerts to show.
 */
export async function runWatchChecks(
  items: WatchItem[],
  search: (query: string) => Promise<SearchResponse>,
  now: Date = new Date(),
): Promise<{ items: WatchItem[]; alerts: { item: WatchItem; alert: WatchAlert }[] }> {
  const alerts: { item: WatchItem; alert: WatchAlert }[] = [];
  const out: WatchItem[] = [];
  for (const item of items) {
    try {
      const check = evaluateWatch(item, await search(item.query), now);
      if (!check) {
        out.push(item);
        continue;
      }
      const next = { ...item, ...check.update };
      out.push(next);
      if (check.alert) alerts.push({ item: next, alert: check.alert });
    } catch {
      out.push(item);
    }
  }
  return { items: out, alerts };
}

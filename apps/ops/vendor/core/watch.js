/** A drop of at least this much since the last check is worth a notification. */
export const DROP_ALERT_RATIO = 0.97;
export function evaluateWatch(w, res, now = new Date()) {
    const priced = res.listings
        .map((l) => ({ name: l.merchantName, total: l.price + (l.shipping ?? 0) }))
        .filter((l) => Number.isFinite(l.total) && l.total > 0)
        .sort((a, b) => a.total - b.total);
    const best = priced[0];
    if (!best)
        return null;
    const last = w.lastPrice ?? null;
    const target = w.targetPrice ?? null;
    let alert = null;
    if (target != null && best.total <= target && (last == null || last > target)) {
        alert = { reason: 'target', merchantName: best.name, price: best.total, previous: last };
    }
    else if (last != null && best.total <= last * DROP_ALERT_RATIO) {
        alert = { reason: 'drop', merchantName: best.name, price: best.total, previous: last };
    }
    return { update: { lastPrice: best.total, lastChecked: now.toISOString() }, alert };
}
/** One line for a notification or list row. */
export function describeAlert(query, a, fmt) {
    const was = a.previous != null ? ` (was ${fmt(a.previous)})` : '';
    return a.reason === 'target'
        ? `${query} reached your target: ${fmt(a.price)} at ${a.merchantName}${was}`
        : `${query} dropped to ${fmt(a.price)} at ${a.merchantName}${was}`;
}
/**
 * Check every item with the given search function. Failures on one item don't
 * stop the others. Returns updated items plus any alerts to show.
 */
export async function runWatchChecks(items, search, now = new Date()) {
    const alerts = [];
    const out = [];
    for (const item of items) {
        try {
            const check = evaluateWatch(item, await search(item.query), now);
            if (!check) {
                out.push(item);
                continue;
            }
            const next = { ...item, ...check.update };
            out.push(next);
            if (check.alert)
                alerts.push({ item: next, alert: check.alert });
        }
        catch {
            out.push(item);
        }
    }
    return { items: out, alerts };
}

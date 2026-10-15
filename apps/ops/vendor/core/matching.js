import { checkPrice } from "./price.js";
/** Round to paise to avoid floating-point noise in displayed prices. */
const r2 = (n) => Math.round(n * 100) / 100;
/**
 * Rule R-003: Discount = MIN(base * pct, max_cap).
 * Flat offers are also clipped by the cap and by the order value itself.
 * Returns 0 when the minimum spend isn't met.
 */
export function offerDiscount(offer, orderValue) {
    if (orderValue <= 0)
        return 0;
    if (offer.minSpend != null && orderValue < offer.minSpend)
        return 0;
    let d = offer.kind === 'percent' ? orderValue * (offer.value / 100) : offer.value;
    if (offer.maxCap != null)
        d = Math.min(d, offer.maxCap);
    return r2(Math.max(0, Math.min(d, orderValue)));
}
/** True when the offer needs no card and no payment app: everyone gets it. */
export function isCardless(offer) {
    return (!offer.issuer &&
        !offer.network &&
        !offer.cardType &&
        !offer.paymentApp &&
        !(offer.tiers && offer.tiers.length));
}
/** Does the given vault card satisfy every condition on the offer? */
export function cardMatches(offer, card) {
    if (offer.paymentApp)
        return false; // app offers are paid with the app, not a card
    if (offer.issuer && offer.issuer !== card.issuer)
        return false;
    if (offer.network && offer.network !== card.network)
        return false;
    if (offer.cardType && offer.cardType !== card.type)
        return false;
    if (offer.tiers && offer.tiers.length) {
        if (!card.tier || !offer.tiers.includes(card.tier))
            return false;
    }
    return true;
}
/** Does paying with this UPI / wallet app unlock the offer? */
export function appMatches(offer, app) {
    if (offer.issuer || offer.network || offer.cardType || (offer.tiers && offer.tiers.length))
        return false;
    return offer.paymentApp === app;
}
function appliesToMerchant(offer, listing) {
    return offer.merchantId == null || offer.merchantId === listing.merchantId;
}
/** Offers outside their validity window are ignored (R-005 for offers). */
export function isLive(offer, now = new Date()) {
    const t = now.getTime();
    if (offer.validFrom && Date.parse(offer.validFrom) > t)
        return false;
    if (offer.validUntil && Date.parse(offer.validUntil) < t)
        return false;
    return true;
}
/**
 * Rule R-004: stacking. One payment = one card or one UPI app. From the offers
 * that payment method unlocks, take at most one per stack group and add them
 * up, unless an offer is marked non-stackable, in which case it can only be
 * used alone. We evaluate both and keep whichever saves more.
 */
export function bestCombination(eligible, orderValue) {
    const scored = eligible
        .map((offer) => ({ offer, discount: offerDiscount(offer, orderValue) }))
        .filter((a) => a.discount > 0);
    // Option A: best stackable offer per group, combined.
    const bestPerGroup = new Map();
    for (const a of scored) {
        if (!a.offer.stackable)
            continue;
        const cur = bestPerGroup.get(a.offer.stackGroup);
        if (!cur || a.discount > cur.discount)
            bestPerGroup.set(a.offer.stackGroup, a);
    }
    let best = [...bestPerGroup.values()];
    let bestTotal = sum(best);
    // Option B: any single offer on its own (covers non-stackable offers).
    for (const a of scored) {
        if (a.discount > bestTotal) {
            best = [a];
            bestTotal = a.discount;
        }
    }
    // Combined discounts can never push the price below zero.
    if (bestTotal > orderValue) {
        const scale = orderValue / bestTotal;
        best = best.map((a) => ({ ...a, discount: r2(a.discount * scale) }));
    }
    return best.sort((a, b) => b.discount - a.discount);
}
const sum = (list) => r2(list.reduce((s, a) => s + a.discount, 0));
/** Compute the best price for one listing given the user's cards and apps. */
export function matchListing(listing, offers, vault, opts = {}) {
    const orderValue = listing.price;
    const now = opts.now ?? new Date();
    const candidates = offers.filter((o) => appliesToMerchant(o, listing) &&
        isLive(o, now) &&
        (opts.includeEmi || !o.emiOnly) &&
        (opts.includeExchange || !o.requiresExchange));
    // Baseline: offers anyone gets (store promos, coupons).
    let bestApplied = bestCombination(candidates.filter(isCardless), orderValue);
    let bestTotal = sum(bestApplied);
    let bestCard = null;
    let bestApp = null;
    for (const card of vault) {
        const eligible = candidates.filter((o) => isCardless(o) || cardMatches(o, card));
        const applied = bestCombination(eligible, orderValue);
        const total = sum(applied);
        if (total > bestTotal) {
            bestTotal = total;
            bestApplied = applied;
            bestCard = card;
            bestApp = null;
        }
    }
    for (const app of opts.paymentApps ?? []) {
        const eligible = candidates.filter((o) => isCardless(o) || appMatches(o, app));
        const applied = bestCombination(eligible, orderValue);
        const total = sum(applied);
        if (total > bestTotal) {
            bestTotal = total;
            bestApplied = applied;
            bestCard = null;
            bestApp = app;
        }
    }
    const basePrice = r2(listing.price + listing.shipping);
    const needsInstrument = bestApplied.some((a) => !isCardless(a.offer));
    return {
        listing,
        basePrice,
        totalDiscount: bestTotal,
        effectivePrice: r2(basePrice - bestTotal),
        card: needsInstrument ? bestCard : null,
        app: needsInstrument ? bestApp : null,
        applied: bestApplied,
        priceCheck: checkPrice(listing),
    };
}
/**
 * The main entry point the app calls after a search. Runs entirely on device.
 * Results are sorted by lowest effective price; ties go to the bigger saving,
 * then alphabetically by merchant for stable ordering.
 */
export function matchSearch(response, vault, opts = {}) {
    return response.listings
        .map((l) => matchListing(l, response.offers, vault, opts))
        .sort((a, b) => a.effectivePrice - b.effectivePrice ||
        b.totalDiscount - a.totalDiscount ||
        a.listing.merchantName.localeCompare(b.listing.merchantName));
}
/** Rule R-005: warn when data is older than 2 hours. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
export function isStale(cachedAt, now = new Date()) {
    const t = Date.parse(cachedAt);
    if (Number.isNaN(t))
        return true;
    return now.getTime() - t > STALE_AFTER_MS;
}

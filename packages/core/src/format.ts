import type { AppliedOffer, MatchedResult } from './types.ts';

/**
 * ₹ formatting with Indian digit grouping (1,23,456.50). Hand-rolled so it
 * behaves the same on Hermes (Android), web and Deno without relying on Intl.
 */
export function formatINR(amount: number): string {
  const negative = amount < 0;
  const abs = Math.abs(Math.round(amount * 100) / 100);
  const [intPart, decPart] = abs.toFixed(2).split('.') as [string, string];
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  const dec = decPart === '00' ? '' : `.${decPart}`;
  return `${negative ? '−' : ''}₹${grouped}${dec}`;
}

/** One line per applied offer, e.g. "10% off · HDFC Bank, max ₹1,500 → −₹1,500". */
export function describeApplied(a: AppliedOffer): string {
  const o = a.offer;
  const what = o.kind === 'percent' ? `${o.value}% off` : `${formatINR(o.value)} off`;
  const cap = o.maxCap != null && o.kind === 'percent' ? `, max ${formatINR(o.maxCap)}` : '';
  return `${what}${cap} → −${formatINR(a.discount)}`;
}

/** Full calculation string for the details view (PRD: Offer Details). */
export function explain(result: MatchedResult): string {
  if (!result.applied.length) return `${formatINR(result.basePrice)} — no card offer applies`;
  const parts = result.applied.map((a) => `${formatINR(a.discount)}`).join(' − ');
  return `${formatINR(result.basePrice)} − ${parts} = ${formatINR(result.effectivePrice)}`;
}

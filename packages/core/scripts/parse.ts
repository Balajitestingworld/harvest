/**
 * Try the offer parser on real banners.
 *   npm run parse -- banners.txt        (one banner per line)
 *   echo "10% off on HDFC cards" | npm run parse
 * Prints what the parser understood and how confident it is, so you can spot
 * wrong readings and turn them into corpus tests.
 */
import { readFileSync } from 'node:fs';
import { parseOfferText } from '../src/index.ts';

const file = process.argv[2];
const input = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
let ok = 0;
let bad = 0;
for (const line of input.split('\n').map((l) => l.trim()).filter(Boolean)) {
  const p = parseOfferText(line);
  if (!p) {
    bad++;
    console.log(`✗ UNREADABLE  ${line}\n`);
    continue;
  }
  ok++;
  const who = [p.issuer, p.network, p.cardType, p.paymentApp, p.portal, p.code && `code ${p.code}`].filter(Boolean).join(' / ') || 'anyone';
  const amt = p.kind === 'percent' ? `${p.value}%` : `₹${p.value}`;
  const extras = [p.maxCap != null && `cap ₹${p.maxCap}`, p.minSpend != null && `min ₹${p.minSpend}`, p.emiOnly && 'EMI only', p.requiresExchange && 'exchange', p.rewardKind !== 'instant' && p.rewardKind, !p.stackable && 'no stacking'].filter(Boolean).join(', ');
  console.log(`✓ ${(p.confidence * 100).toFixed(0).padStart(3)}%  ${amt} for ${who}${extras ? ` (${extras})` : ''}\n        ${line}\n`);
}
console.log(`${ok} parsed, ${bad} unreadable`);

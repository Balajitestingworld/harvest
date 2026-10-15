// Tiny DOM helpers. Everything is built with createElement/textContent, never
// innerHTML: banner text comes from third-party pages and must stay inert.
import { BANKS, NETWORKS, PAYMENT_APPS, PORTALS, bankName, formatINR, networkName, paymentAppName, portalName } from '../vendor/core/index.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const inr = formatINR;

export function timeAgo(iso) {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function shortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function pill(text, tone = '') {
  return h('span', { class: `pill ${tone}` }, text);
}

export function confidencePill(c) {
  if (c == null) return pill('manual');
  const pct = Math.round(c * 100);
  return pill(`${pct}% sure`, pct >= 75 ? 'ok' : pct >= 50 ? 'warn' : 'bad');
}

/** Build a <select> from [value, label] pairs. */
export function select(options, value, onChange, props = {}) {
  const el = h('select', { onchange: onChange && ((e) => onChange(e.target.value)), ...props });
  for (const [v, label] of options) el.append(h('option', { value: v }, label));
  el.value = value ?? '';
  return el;
}

export const BANK_OPTIONS = [['', 'Any / none'], ...BANKS.map((b) => [b.slug, b.name])];
export const NETWORK_OPTIONS = [['', 'Any / none'], ...NETWORKS.map((n) => [n.slug, n.name])];
export const APP_OPTIONS = [['', 'None'], ...PAYMENT_APPS.map((a) => [a.slug, a.name])];
export const PORTAL_OPTIONS = [['', 'None'], ...PORTALS.map((p) => [p.slug, p.name])];

/** Plain-English summary of an offer row: what the shopper would see. */
export function describeRow(r) {
  const amt = r.kind === 'percent' ? `${r.value}%` : inr(Number(r.value));
  const how = r.reward_kind === 'cashback' ? ' cashback' : r.reward_kind === 'points' ? ' in reward points' : ' off';
  const cap = r.kind === 'percent' && r.max_cap != null ? `, up to ${inr(Number(r.max_cap))}` : '';
  const min = r.min_spend != null ? `, min ${inr(Number(r.min_spend))}` : '';
  return `${amt}${how}${cap}${min}`;
}

export function whoText(r) {
  const parts = [];
  if (r.issuer) parts.push(bankName(r.issuer));
  if (r.network && r.network !== r.issuer) parts.push(networkName(r.network));
  if (r.card_type) parts.push(r.card_type === 'credit' ? 'credit cards' : 'debit cards');
  if (r.payment_app) parts.push(`${paymentAppName(r.payment_app)} app`);
  if (r.portal) parts.push(`via ${portalName(r.portal)}`);
  if (r.code) parts.push(`code ${r.code}`);
  return parts.length ? parts.join(' · ') : 'Everyone';
}

export function flagPills(r) {
  return [
    r.emi_only && pill('EMI only'),
    r.requires_exchange && pill('needs exchange'),
    !r.stackable && pill('no stacking'),
  ].filter(Boolean);
}

/** Things a reviewer should double-check before approving. */
export function warningsFor(r) {
  const w = [];
  if (r.kind === 'percent' && Number(r.value) >= 50) w.push(`${r.value}% is unusually high. Check the banner.`);
  if (r.kind === 'percent' && r.max_cap == null) w.push('No maximum discount. Real percentage offers almost always have one.');
  if (r.kind === 'flat' && Number(r.value) >= 20000) w.push(`${inr(Number(r.value))} off is unusually large.`);
  if (r.source === 'llm') w.push('Read by the AI model, not the rules. Compare every field with the banner.');
  if (r.max_cap != null && r.min_spend != null && Number(r.max_cap) > Number(r.min_spend)) w.push('Cap is larger than the minimum spend.');
  return w;
}

let toastBox;
export function toast(text, bad = false) {
  toastBox ??= document.body.appendChild(h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = toastBox.appendChild(h('div', { class: `toast${bad ? ' bad' : ''}` }, text));
  setTimeout(() => t.remove(), bad ? 7000 : 3500);
}

export function empty(text, action) {
  return h('div', { class: 'empty' }, h('p', null, text), action);
}

// Offer editor: one form used for reviewing, editing and adding offers.
import { parseOfferText, stackGroupFor } from '../vendor/core/index.js';
import { APP_OPTIONS, BANK_OPTIONS, NETWORK_OPTIONS, PORTAL_OPTIONS, describeRow, h, select, warningsFor, whoText } from './ui.js';

/** Columns an admin may change. Everything else (ids, timestamps, audit) is left alone. */
const EDITABLE = [
  'merchant_id', 'status', 'kind', 'value', 'max_cap', 'min_spend', 'issuer', 'network', 'card_type', 'tiers', 'payment_app', 'portal',
  'code', 'stack_group', 'stackable', 'emi_only', 'requires_exchange', 'reward_kind', 'label', 'valid_from', 'valid_until',
];
export const pickEditable = (row) => Object.fromEntries(EDITABLE.filter((k) => k in row).map((k) => [k, row[k]]));

const num = (v) => (v === '' || v == null ? null : Number(v));

/** Empty row with sensible defaults. */
export function blankRow(merchantId = null) {
  return {
    merchant_id: merchantId, status: 'live', source: 'manual', kind: 'percent', value: 10, max_cap: null, min_spend: null,
    issuer: null, network: null, card_type: null, tiers: null, payment_app: null, portal: null, code: null,
    stack_group: 'merchant', stackable: true, emi_only: false, requires_exchange: false, reward_kind: 'instant',
    label: '', raw_text: null, confidence: null, valid_from: null, valid_until: null, fingerprint: null,
  };
}

/** Run the rule-based parser over free text and return a row (or null). */
export function rowFromText(text, merchantId) {
  const p = parseOfferText(text);
  if (!p) return null;
  return {
    ...blankRow(merchantId), source: 'regex', kind: p.kind, value: p.value, max_cap: p.maxCap, min_spend: p.minSpend, issuer: p.issuer,
    network: p.network, card_type: p.cardType, payment_app: p.paymentApp, portal: p.portal, code: p.code, stack_group: p.stackGroup,
    stackable: p.stackable, emi_only: p.emiOnly, requires_exchange: p.requiresExchange, reward_kind: p.rewardKind, label: p.label,
    raw_text: text, confidence: p.confidence,
  };
}

/**
 * Editable fields bound to `row` (mutated in place). `onChange` fires after
 * every edit so a preview line can refresh.
 */
export function offerFields(row, merchants, onChange = () => {}) {
  const set = (key, conv = (v) => v) => (v) => {
    row[key] = conv(v);
    row.stack_group = stackGroupFor({ code: row.code, portal: row.portal, paymentApp: row.payment_app, issuer: row.issuer, network: row.network });
    onChange();
  };
  const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
  const text = (key, props = {}) => h('input', { value: row[key] ?? '', oninput: (e) => set(key, (v) => v.trim() || null)(e.target.value), ...props });
  const number = (key, props = {}) =>
    h('input', { type: 'number', min: '0', step: 'any', value: row[key] ?? '', oninput: (e) => set(key, num)(e.target.value), ...props });
  const check = (label, key) =>
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!row[key], onchange: (e) => set(key)(e.target.checked) }), label);

  return h('div', { class: 'grid' },
    field('Store', select([['', 'All stores'], ...merchants.map((m) => [m.id, m.name])], row.merchant_id ?? '', set('merchant_id', (v) => v || null))),
    field('Discount type', select([['percent', 'Percent'], ['flat', 'Flat ₹']], row.kind, set('kind'))),
    field(row.kind === 'percent' ? 'Percent' : 'Amount ₹', number('value', { min: '0.01', required: true })),
    field('Maximum discount ₹', number('max_cap')),
    field('Minimum spend ₹', number('min_spend')),
    field('Bank', select(BANK_OPTIONS, row.issuer ?? '', set('issuer', (v) => v || null))),
    field('Card network', select(NETWORK_OPTIONS, row.network ?? '', set('network', (v) => v || null))),
    field('Card type', select([['', 'Any'], ['credit', 'Credit'], ['debit', 'Debit']], row.card_type ?? '', set('card_type', (v) => v || null))),
    field('UPI / wallet app', select(APP_OPTIONS, row.payment_app ?? '', set('payment_app', (v) => v || null))),
    field('Bank portal', select(PORTAL_OPTIONS, row.portal ?? '', set('portal', (v) => v || null))),
    field('Promo code', text('code', { placeholder: 'e.g. SAVE500', maxlength: '16' })),
    field('How it is paid', select([['instant', 'Instant discount'], ['cashback', 'Cashback'], ['points', 'Reward points']], row.reward_kind, set('reward_kind'))),
    field('Valid until', h('input', { type: 'date', value: row.valid_until ? row.valid_until.slice(0, 10) : '', onchange: (e) => set('valid_until', (v) => (v ? `${v}T23:59:59+05:30` : null))(e.target.value) })),
    h('div', null, check('Can be combined with other offers', 'stackable'), check('Only on EMI', 'emi_only'), check('Needs an old-device exchange', 'requires_exchange')),
  );
}

export function previewLine(row) {
  return `${describeRow(row)} · ${whoText(row)}`;
}

export function warningList(row) {
  const w = warningsFor(row);
  return w.length ? h('ul', { class: 'warnings' }, w.map((t) => h('li', null, t))) : null;
}

/** Check a row before saving. Returns an error string or null. */
export function validateRow(row) {
  if (!(Number(row.value) > 0)) return 'Enter a discount greater than zero.';
  if (row.kind === 'percent' && Number(row.value) > 100) return 'A percentage cannot be more than 100.';
  if (!row.label?.trim()) return 'Add the offer text shown to shoppers.';
  if (row.max_cap != null && Number(row.max_cap) < 0) return 'Maximum discount cannot be negative.';
  if (row.valid_until && Number.isNaN(Date.parse(row.valid_until))) return 'That date is not valid.';
  return null;
}

/** Modal editor. Resolves with the edited row, or null if cancelled. */
export function openOfferEditor({ title, row, merchants, saveLabel = 'Save offer' }) {
  const draft = structuredClone(row);
  return new Promise((resolve) => {
    const dlg = h('dialog', { 'aria-label': title });
    const preview = h('p', { class: 'preview' });
    const warns = h('div');
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const label = h('textarea', { rows: '3', oninput: (e) => (draft.label = e.target.value) });
    label.value = draft.label ?? '';
    const refresh = () => {
      preview.textContent = previewLine(draft);
      warns.replaceChildren(...(warningList(draft) ? [warningList(draft)] : []));
    };
    refresh();
    const close = (v) => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    dlg.append(
      h('div', { class: 'dhead' }, h('h3', null, title)),
      h('div', { class: 'dbody' },
        draft.raw_text ? h('p', { class: 'muted small' }, 'Original text: ', h('i', null, draft.raw_text)) : null,
        preview, warns,
        offerFields(draft, merchants, refresh),
        h('label', { class: 'field' }, h('span', null, 'Offer text shown to shoppers'), label),
        err,
      ),
      h('div', { class: 'dfoot' },
        h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, 'Cancel'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
          const msg = validateRow(draft);
          if (msg) { err.textContent = msg; err.hidden = false; return; }
          close(draft);
        } }, saveLabel),
      ),
    );
    document.body.append(dlg);
    dlg.showModal();
  });
}

import { h, pill, select, shortDate, describeRow, whoText, flagPills, toast, empty } from '../ui.js';
import { blankRow, openOfferEditor, pickEditable } from '../editor.js';

const STATUS = [['', 'Any status'], ['live', 'Live'], ['pending', 'Waiting for review'], ['expired', 'Expired'], ['rejected', 'Rejected']];
const TONE = { live: 'ok', pending: 'warn', expired: '', rejected: 'bad' };

export async function offers({ backend, go, merchants, params }) {
  const filters = { status: params.get('status') ?? '', merchantId: params.get('store') ?? '', search: params.get('q') ?? '' };
  const rows = await backend.listOffers({ status: filters.status || undefined, merchantId: filters.merchantId || undefined, search: filters.search || undefined });
  const name = (id) => (id == null ? 'All stores' : merchants.find((m) => m.id === id)?.name ?? id);

  const apply = (k) => (v) => {
    filters[k] = v;
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.merchantId) p.set('store', filters.merchantId);
    if (filters.search) p.set('q', filters.search);
    go('offers', p);
  };

  const act = (row, patch, msg) => async () => {
    try { await backend.saveOffer(row.id, patch); toast(msg); go('offers', params); } catch (e) { toast(e.message, true); }
  };

  const edit = (row) => async () => {
    const out = await openOfferEditor({ title: 'Edit offer', row, merchants });
    if (!out) return;
    try { await backend.saveOffer(row.id, pickEditable(out)); toast('Saved.'); go('offers', params); } catch (e) { toast(e.message, true); }
  };

  const add = async () => {
    const out = await openOfferEditor({ title: 'Add an offer', row: blankRow(filters.merchantId && filters.merchantId !== '*' ? filters.merchantId : null), merchants, saveLabel: 'Add offer' });
    if (!out) return;
    try { await backend.createOffer(out); toast('Added. It is live now.'); go('offers', params); } catch (e) { toast(e.message, true); }
  };

  const search = h('input', { type: 'search', placeholder: 'Search offer text or code', value: filters.search, 'aria-label': 'Search offers' });
  search.addEventListener('keydown', (e) => e.key === 'Enter' && apply('search')(search.value));

  const table = rows.length
    ? h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Store', 'Offer', 'Who gets it', 'Status', 'Until', ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map((r) => h('tr', null,
          h('td', null, name(r.merchant_id)),
          h('td', null, h('div', null, describeRow(r)), h('div', { class: 'muted small' }, r.label), h('div', { class: 'row' }, flagPills(r))),
          h('td', null, whoText(r)),
          h('td', null, pill(r.status, TONE[r.status]), ' ', h('span', { class: 'muted small' }, r.source)),
          h('td', null, shortDate(r.valid_until) || h('span', { class: 'muted' }, 'No end date')),
          h('td', null, h('div', { class: 'row' },
            h('button', { class: 'btn btn-sm', onclick: edit(r) }, 'Edit'),
            r.status !== 'live' && h('button', { class: 'btn btn-sm', onclick: act(r, { status: 'live' }, 'Now live.') }, 'Go live'),
            r.status === 'live' && h('button', { class: 'btn btn-sm btn-danger', onclick: act(r, { status: 'expired' }, 'Taken down.') }, 'Take down'),
          )),
        ))),
      ))
    : empty('No offers match these filters.');

  return h('div', null,
    h('div', { class: 'row' }, h('h1', null, 'Offers'), h('span', { class: 'spacer' }), h('button', { class: 'btn btn-primary', onclick: add }, 'Add an offer')),
    h('div', { class: 'row' },
      select(STATUS, filters.status, apply('status'), { 'aria-label': 'Status' }),
      select([['', 'All stores'], ['*', 'Offers for every store'], ...merchants.map((m) => [m.id, m.name])], filters.merchantId, apply('merchantId'), { 'aria-label': 'Store' }),
      search,
    ),
    h('p', { class: 'muted small' }, `${rows.length} shown${rows.length === 300 ? ' (first 300)' : ''}`),
    table,
  );
}

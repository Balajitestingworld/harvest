import { h, timeAgo, toast } from '../ui.js';

export async function overview({ backend, go }) {
  const [s, merchants] = await Promise.all([backend.stats(), backend.listMerchants()]);
  const tile = (n, text, href, tone = '') => h('a', { class: `tile ${n > 0 ? tone : ''}`, href }, h('b', null, n), h('span', { class: 'muted' }, text));

  const btn = h('button', { class: 'btn btn-primary', onclick: async () => {
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    try {
      const r = await backend.refresh();
      toast(r.added ? `Found ${r.added} offer${r.added === 1 ? '' : 's'}. Check the review queue.` : 'Refreshed. Nothing new on the stores.');
      go('overview');
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false;
      btn.textContent = 'Refresh offers from all stores';
    }
  } }, 'Refresh offers from all stores');

  return h('div', null,
    h('h1', null, 'Overview'),
    h('p', { class: 'muted' }, 'What needs a person today.'),
    h('div', { class: 'tiles' },
      tile(s.pending, 'offers waiting for review', '#/review', 'warn'),
      tile(s.failures, 'banners nobody could read', '#/banners', 'warn'),
      tile(s.storesWithErrors, 'stores with a problem', '#/stores', 'bad'),
      tile(s.live, 'offers live in the app', '#/offers?status=live'),
    ),
    h('div', { class: 'row' }, btn, h('span', { class: 'muted small' }, 'Reads each store\'s offer page and sorts what it finds into the review queue.')),
    h('h2', null, 'Stores'),
    h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Store', 'Status', 'Last good refresh', 'Problem'].map((t) => h('th', null, t)))),
      h('tbody', null, merchants.map((m) => h('tr', null,
        h('td', null, h('a', { href: '#/stores' }, m.name)),
        h('td', null, m.enabled ? h('span', { class: 'pill ok' }, 'on') : h('span', { class: 'pill' }, 'off')),
        h('td', null, timeAgo(m.last_ok_at)),
        h('td', null, m.last_error ? h('span', { class: 'pill bad' }, m.last_error) : h('span', { class: 'muted' }, 'None')),
      ))),
    )),
  );
}

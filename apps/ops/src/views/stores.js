import { h, pill, select, timeAgo, toast } from '../ui.js';

const ADAPTERS = [['mock', 'Demo data'], ['flipkart', 'Flipkart Affiliate API'], ['amazon_in', 'Amazon Creators API']];
const AUTO = [['', 'Never. Review everything'], ['0.9', 'Above 90% sure'], ['0.8', 'Above 80% sure'], ['0.7', 'Above 70% sure']];

export async function stores({ backend, go }) {
  const merchants = await backend.listMerchants();

  const rowFor = (m) => {
    const draft = { ...m };
    const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
    const save = h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
      try {
        await backend.saveMerchant(m.id, {
          name: draft.name, enabled: draft.enabled, adapter: draft.adapter, affiliate_tag: draft.affiliate_tag || null,
          cache_minutes: Number(draft.cache_minutes) || 90, offer_page_url: draft.offer_page_url || null,
          auto_publish_min: draft.auto_publish_min === '' || draft.auto_publish_min == null ? null : Number(draft.auto_publish_min),
          allowed_hosts: String(draft.allowed_hosts_text ?? m.allowed_hosts.join(',')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        });
        toast(`${m.name} saved.`);
      } catch (e) { toast(e.message, true); }
    } }, 'Save');
    const refresh = h('button', { class: 'btn btn-sm', onclick: async () => {
      refresh.disabled = true;
      try {
        const r = await backend.refresh(m.id);
        toast(`${m.name}: ${r.added ? `${r.added} offer${r.added === 1 ? '' : 's'} found` : 'nothing new'}.`);
        go('stores');
      } catch (e) { toast(e.message, true); refresh.disabled = false; }
    } }, 'Refresh offers');

    return h('article', { class: 'card' },
      h('div', { class: 'row' },
        h('h3', null, m.name), h('span', { class: 'muted small' }, m.id),
        m.last_error ? pill(m.last_error, 'bad') : pill(`last good refresh ${timeAgo(m.last_ok_at)}`, m.last_ok_at ? 'ok' : ''),
        h('span', { class: 'spacer' }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: m.enabled, onchange: (e) => (draft.enabled = e.target.checked) }), 'Shown to shoppers'),
      ),
      h('div', { class: 'grid', 'aria-label': `${m.name} settings` },
        field('Display name', h('input', { value: m.name, oninput: (e) => (draft.name = e.target.value) })),
        field('Where prices come from', select(ADAPTERS, m.adapter, (v) => (draft.adapter = v))),
        field('Affiliate tag / ID', h('input', { value: m.affiliate_tag ?? '', oninput: (e) => (draft.affiliate_tag = e.target.value.trim()) })),
        field('Keep results for (minutes)', h('input', { type: 'number', min: '1', max: '1440', value: m.cache_minutes, oninput: (e) => (draft.cache_minutes = e.target.value) })),
        field('Offers page to read', h('input', { type: 'url', placeholder: 'https://…', value: m.offer_page_url ?? '', oninput: (e) => (draft.offer_page_url = e.target.value.trim()) })),
        field('Publish without review', select(AUTO, m.auto_publish_min == null ? '' : String(m.auto_publish_min), (v) => (draft.auto_publish_min = v))),
        field('Allowed link hosts', h('input', { value: m.allowed_hosts.join(', '), placeholder: 'amazon.in, www.amazon.in', oninput: (e) => (draft.allowed_hosts_text = e.target.value) })),
      ),
      h('div', { class: 'row end', }, refresh, save),
    );
  };

  const newId = h('input', { placeholder: 'id, e.g. croma', pattern: '[a-z0-9_]{2,40}', 'aria-label': 'New store ID' });
  const newName = h('input', { placeholder: 'Name, e.g. Croma', 'aria-label': 'New store name' });
  const add = h('button', { class: 'btn', onclick: async () => {
    const id = newId.value.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(id) || !newName.value.trim()) return toast('Use a short ID with a-z, 0-9 or _, and a name.', true);
    try { await backend.createMerchant({ id, name: newName.value.trim(), adapter: 'mock', enabled: false, allowed_hosts: [] }); toast('Store added, switched off until you finish setting it up.'); go('stores'); } catch (e) { toast(e.message, true); }
  } }, 'Add store');

  return h('div', null,
    h('h1', null, 'Stores'),
    h('p', { class: 'muted' }, 'Switch a store off if its data goes wrong. Changes apply within a minute, with no redeploy.'),
    h('div', { class: 'review' }, merchants.map(rowFor)),
    h('h2', null, 'Add a store'),
    h('div', { class: 'row' }, newId, newName, add),
    h('p', { class: 'muted small' }, 'A new store uses demo data until someone writes its adapter, then pick it above.'),
  );
}

import { h, confidencePill, describeRow, whoText, flagPills, empty } from '../ui.js';
import { rowFromText } from '../editor.js';

export async function parser() {
  const box = h('textarea', { rows: '6', placeholder: 'Paste offer banners from a store, one per line.\n10% Instant Discount up to ₹1,500 on HDFC Bank Credit Cards. Min purchase ₹5,000', 'aria-label': 'Banners to test' });
  const out = h('div');

  const run = () => {
    const lines = box.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return out.replaceChildren(empty('Paste at least one banner.'));
    const rows = lines.map((text) => ({ text, row: rowFromText(text, null) }));
    const ok = rows.filter((r) => r.row).length;
    out.replaceChildren(
      h('p', { class: 'muted' }, `${ok} of ${rows.length} read by the rules.`),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Banner', 'Understood as', 'Sure?'].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map(({ text, row }) => h('tr', null,
          h('td', null, text),
          row
            ? h('td', null, h('b', null, describeRow(row)), h('div', null, whoText(row)), h('div', { class: 'row' }, flagPills(row)))
            : h('td', { class: 'muted' }, 'Not understood. This would go to the AI model, then to Unreadable banners.'),
          h('td', null, row ? confidencePill(row.confidence) : '—'),
        ))),
      )),
    );
  };

  return h('div', null,
    h('h1', null, 'Parser test'),
    h('p', { class: 'muted' }, 'See how the rules read a banner before it reaches the review queue. Runs in your browser; nothing is saved.'),
    box,
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', onclick: run }, 'Read these banners')),
    out,
  );
}

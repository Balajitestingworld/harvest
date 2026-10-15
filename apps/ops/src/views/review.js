import { h, confidencePill, pill, toast, empty } from '../ui.js';
import { offerFields, pickEditable, previewLine, validateRow, warningList } from '../editor.js';

export async function review({ backend, go, merchants }) {
  const rows = (await backend.listOffers({ status: 'pending' })).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const name = (id) => merchants.find((m) => m.id === id)?.name ?? 'All stores';
  const list = h('div', { class: 'review' });

  const card = (row) => {
    const draft = structuredClone(row);
    const preview = h('p', { class: 'preview' });
    const warns = h('div');
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const label = h('input', { value: draft.label, 'aria-label': 'Offer text shown to shoppers', oninput: (e) => (draft.label = e.target.value) });
    const refresh = () => {
      preview.textContent = previewLine(draft);
      const w = warningList(draft);
      warns.replaceChildren(...(w ? [w] : []));
    };
    refresh();

    const finish = async (action, patch) => {
      err.hidden = true;
      if (action === 'approve') {
        const msg = validateRow(draft);
        if (msg) { err.textContent = msg; err.hidden = false; return; }
      }
      try {
        await backend.saveOffer(row.id, action === 'approve' ? { ...pickEditable(draft), ...patch } : patch);
        el.remove();
        toast(action === 'approve' ? 'Approved. It is live in the app.' : 'Rejected.');
        if (!list.children.length) go('review');
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
      }
    };

    const el = h('article', { class: 'rcard' },
      h('header', null, h('b', null, name(row.merchant_id)), confidencePill(row.confidence), pill(row.source === 'llm' ? 'read by AI' : 'read by rules')),
      h('blockquote', null, row.raw_text ?? row.label),
      h('div', { class: 'body' },
        preview, warns,
        offerFields(draft, merchants, refresh),
        h('label', { class: 'field' }, h('span', null, 'Offer text shown to shoppers'), label),
        err,
      ),
      h('footer', null,
        h('button', { class: 'btn btn-primary', onclick: () => finish('approve', { status: 'live' }) }, 'Approve and publish'),
        h('button', { class: 'btn btn-danger', onclick: () => finish('reject', { status: 'rejected' }) }, 'Reject'),
        h('span', { class: 'muted small' }, 'Fix any field above first. Your edits are saved with the approval.'),
      ),
    );
    return el;
  };

  rows.forEach((r) => list.append(card(r)));
  return h('div', null,
    h('h1', null, 'Review queue'),
    h('p', { class: 'muted' }, 'Compare each reading with the original banner. Nothing reaches shoppers until you approve it. Most confident first.'),
    rows.length ? list : empty('Nothing waiting. New offers appear here after a refresh.'),
  );
}

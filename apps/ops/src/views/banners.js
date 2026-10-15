import { h, toast, empty } from '../ui.js';
import { blankRow, openOfferEditor, rowFromText } from '../editor.js';

export async function banners({ backend, go, merchants }) {
  const rows = await backend.listFailures();
  const name = (id) => merchants.find((m) => m.id === id)?.name ?? id;

  const create = (f) => async () => {
    const row = rowFromText(f.raw_text, f.merchant_id) ?? { ...blankRow(f.merchant_id), label: f.raw_text, raw_text: f.raw_text };
    const out = await openOfferEditor({ title: 'Turn this banner into an offer', row, merchants, saveLabel: 'Publish offer' });
    if (!out) return;
    try {
      await backend.createOffer(out);
      await backend.resolveFailure(f.id);
      toast('Published.');
      go('banners');
    } catch (e) { toast(e.message, true); }
  };
  const dismiss = (f) => async () => { await backend.resolveFailure(f.id); go('banners'); };

  return h('div', null,
    h('h1', null, 'Unreadable banners'),
    h('p', { class: 'muted' }, 'Neither the rules nor the AI model could find a discount in these. Most are not offers (free delivery, EMI plans). Turn real ones into offers, and send examples of ones that should have worked to your developer so the rules improve.'),
    rows.length
      ? h('div', { class: 'review' }, rows.map((f) => h('article', { class: 'rcard' },
          h('header', null, h('b', null, name(f.merchant_id))),
          h('blockquote', null, f.raw_text),
          h('footer', null,
            h('button', { class: 'btn btn-primary btn-sm', onclick: create(f) }, 'Make it an offer'),
            h('button', { class: 'btn btn-sm', onclick: dismiss(f) }, 'Not an offer'),
          ),
        )))
      : empty('Nothing here. Every banner was read or ignored.'),
  );
}

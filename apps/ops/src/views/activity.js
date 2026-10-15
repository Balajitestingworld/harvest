import { h, empty } from '../ui.js';

const PERIODS = [[1, '24 hours'], [7, '7 days'], [30, '30 days']];
const SVG_NS = 'http://www.w3.org/2000/svg';

export async function activity({ backend, go, merchants, params }) {
  const asked = Number(params.get('days'));
  const days = PERIODS.some(([n]) => n === asked) ? asked : 7;
  const a = await backend.insights(days);
  const name = (id) => merchants.find((m) => m.id === id)?.name ?? id;
  const compare = days === 1 ? 'vs the day before' : `vs the previous ${days} days`;
  const showSpark = days > 1;

  const picker = h('div', { class: 'seg', role: 'group', 'aria-label': 'Time period' },
    PERIODS.map(([n, label]) => h('button', {
      class: 'btn btn-sm', 'aria-pressed': String(n === days),
      onclick: () => go('activity', `days=${n}`),
    }, label)));

  const headline = (title, s) => h('div', { class: 'tile' },
    h('span', { class: 'muted small' }, title),
    h('b', null, s.current.toLocaleString('en-IN')),
    h('div', { class: 'row' }, delta(s.current, s.previous, compare), showSpark && spark(s.daily, `${title} per day`)),
  );

  const searches = a.searches.current;
  const clicks = a.clicks.current;
  const per100 = searches ? Math.round((clicks / searches) * 100) : 0;

  const topQuery = a.queries[0];
  const topMerchant = a.merchants[0];
  const totalClicks = a.clicks.current || 1;
  const share = (n) => pctOf(n, totalClicks);
  const lows = a.merchants.filter((m) => a.merchants.length > 1 && m.clicks > 0 && share(m.clicks) < 10);

  return h('div', null,
    h('div', { class: 'page-head' },
      h('div', null,
        h('h1', null, 'Activity'),
        h('p', { class: 'muted' }, 'Anonymous counts only: the search text and the store clicked, never who.'),
      ),
      picker,
    ),

    searches === 0 && clicks === 0
      ? empty(`Nothing in the last ${days === 1 ? '24 hours' : `${days} days`} yet.`)
      : h('div', null,
        h('div', { class: 'tiles' },
          headline('Searches', a.searches),
          headline('Store clicks', a.clicks),
          h('div', { class: 'tile' },
            h('span', { class: 'muted small' }, 'Clicks per 100 searches'),
            h('b', null, per100),
            h('span', { class: 'muted small' }, `${clicks.toLocaleString('en-IN')} clicks from ${searches.toLocaleString('en-IN')} searches`),
          ),
        ),
        h('p', { class: 'small muted' },
          'Clicks are not tied to one search, so the ratio is a rough signal, not a conversion rate.'),

        h('h2', null, 'What people search for'),
        a.queries.length
          ? list(a.queries, {
            label: (q) => q.query,
            value: (q) => q.searches,
            previous: (q) => q.previous,
            daily: (q) => q.daily,
            total: a.searches.current,
            showSpark,
            describe: (q) => `${q.searches} searches, ${pctOf(q.searches, a.searches.current)}% of total`,
            heading: ['Search', 'Searches'],
          })
          : empty('No searches yet.'),
        topQuery ? note(`Top search: “${topQuery.query}”, ${pctOf(topQuery.searches, a.searches.current)}% of all searches.`) : null,

        h('h2', null, 'Clicks to each store'),
        a.merchants.length
          ? list(a.merchants, {
            label: (m) => name(m.merchant_id),
            value: (m) => m.clicks,
            previous: (m) => m.previous,
            daily: (m) => m.daily,
            total: a.clicks.current,
            showSpark,
            describe: (m) => `${m.clicks} clicks, ${share(m.clicks)}% of clicks`,
            heading: ['Store', 'Clicks'],
          })
          : empty('No clicks yet.'),
        topMerchant && a.clicks.current > 0 ? note(`${name(topMerchant.merchant_id)} gets ${share(topMerchant.clicks)}% of clicks.`) : null,
        lows.map((m) => note(`${name(m.merchant_id)} gets only ${share(m.clicks)}% of clicks. Check whether its offers are live and competitive.`, true)),
      ),
  );
}

/** Share of a total, as a whole percentage. */
function pctOf(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

/** ▲/▼ change against the previous period. The colour is paired with the arrow and words. */
function delta(now, before, compare) {
  if (!before) return h('span', { class: 'delta muted' }, now ? 'New in this period' : 'No change');
  const p = Math.round(((now - before) / before) * 100);
  if (p === 0) return h('span', { class: 'delta muted' }, `No change ${compare}`);
  const up = p > 0;
  return h('span', { class: `delta ${up ? 'up' : 'down'}` }, `${up ? '▲' : '▼'} ${Math.abs(p)}% ${compare}`);
}

/** Tiny trend line. Values are oldest first. Decorative for AT; the totals carry the meaning. */
function spark(values, label) {
  const w = 96;
  const ht = 28;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(ht - 2 - (v / max) * (ht - 4)).toFixed(1)}`).join(' ');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${ht}`);
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(ht));
  svg.setAttribute('class', 'spark');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}: ${values.join(', ')}`);
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', points);
  svg.append(line);
  return svg;
}

/** A ranked list with bars scaled to the top item (stated on screen), share, change and trend. */
function list(items, o) {
  const max = Math.max(1, ...items.map(o.value));
  const head = h('div', { class: `arow arow-head${o.showSpark ? '' : ' no-spark'}`, 'aria-hidden': 'true' },
    h('span', null, o.heading[0]), h('span', null, `${o.heading[1]} (bar = share of top item)`), h('span', { class: 'num' }, 'Count'),
    h('span', { class: 'num' }, 'Share'), h('span', null, 'vs previous'), o.showSpark ? h('span', null, 'Trend') : null);
  return h('div', { class: 'alist', role: 'list' }, head, items.map((i) => {
    const v = o.value(i);
    const bar = h('i', { 'aria-hidden': 'true' });
    bar.style.setProperty('--w', String((v / max) * 100));
        return h('div', { class: `arow${o.showSpark ? '' : ' no-spark'}`, role: 'listitem', 'aria-label': `${o.label(i)}: ${o.describe(i)}` },
      h('span', { class: 'lbl' }, o.label(i)),
      h('span', { class: 'barcell' }, bar),
      h('span', { class: 'num' }, v.toLocaleString('en-IN')),
      h('span', { class: 'num muted' }, `${pctOf(v, o.total)}%`),
      delta(v, o.previous(i), 'vs prev.'),
      o.showSpark ? spark(o.daily(i), `${o.label(i)} per day`) : null,
    );
  }));
}

function note(text, warn = false) {
  return h('p', { class: `callout${warn ? ' warn' : ''}` }, text);
}

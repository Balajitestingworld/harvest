import { loadBackend, wantsDemo } from './backend.js';
import { h, toast } from './ui.js';
import { overview } from './views/overview.js';
import { review } from './views/review.js';
import { offers } from './views/offers.js';
import { stores } from './views/stores.js';
import { banners } from './views/banners.js';
import { parser } from './views/parser.js';
import { activity } from './views/activity.js';

// Sidebar groups, in order. Each route has a one-line hint so the names make sense without the domain.
const GROUPS = [
  ['Insights', ['overview', 'activity']],
  ['Catalog', ['offers', 'stores']],
  ['Quality', ['review', 'banners', 'parser']],
];

const ROUTES = {
  overview: { label: 'Overview', view: overview, hint: 'What needs a person today' },
  activity: { label: 'Activity', view: activity, hint: 'What shoppers search and click' },
  offers: { label: 'Offers', view: offers, hint: 'Live and expired bank offers' },
  stores: { label: 'Stores', view: stores, hint: 'Store settings and refresh status' },
  review: { label: 'Review queue', view: review, badge: 'pending', hint: 'Offers waiting for approval' },
  banners: { label: 'Unreadable banners', view: banners, badge: 'failures', hint: 'Offer text the parser could not read' },
  parser: { label: 'Parser test', view: parser, hint: 'Try a banner against the rules' },
};

const app = document.getElementById('app');
let backend;
let user;

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { route: ROUTES[path] ? path : 'overview', params: new URLSearchParams(query) };
}

function go(route, params) {
  const next = `#/${route}${params && String(params) ? `?${params}` : ''}`;
  if (location.hash === next) render();
  else location.hash = next;
}

function loginScreen(message) {
  const email = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', 'aria-label': 'Your email', required: true });
  const err = h('p', { class: 'error', role: 'alert', hidden: !message }, message ?? '');
  const sent = h('p', { hidden: true }, 'Check your email for a sign-in link, then come back to this tab.');
  const form = h('form', { class: 'card login-card', onsubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    try {
      const r = await backend.signIn(email.value.trim());
      if (r.emailSent) { sent.hidden = false; return; }
      user = await backend.session();
      render();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  } },
    h('div', { class: 'login-brand' }, 'Harvest', h('small', null, 'Ops')),
    h('h1', null, 'Sign in'),
    h('p', { class: 'muted' }, wantsDemo
      ? 'Demo mode: sample data only. Nothing you do is saved.'
      : 'Review offers, stores and activity. Admins only.'),
    h('label', { class: 'field' }, h('span', null, 'Email'), email),
    h('p', { class: 'hint' }, wantsDemo
      ? 'Any email works in demo mode. Leave it blank to continue.'
      : 'We email you a one-time sign-in link. There is no password.'),
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, wantsDemo ? 'Open the demo' : 'Email me a sign-in link'),
    err, sent,
  );
  if (wantsDemo) email.required = false;
  app.replaceChildren(h('main', { class: 'login' }, form));
}

function notAdminScreen(email) {
  app.replaceChildren(h('main', { class: 'login' },
    h('h1', null, 'Not on the admin list'),
    h('p', null, `${email} is signed in but is not allowed to use Harvest Ops.`),
    h('p', { class: 'muted small' }, 'Ask an existing admin to run this in the Supabase SQL editor:'),
    h('pre', null, `insert into public.admins (email) values ('${email.toLowerCase()}');`),
    h('button', { class: 'btn', onclick: async () => { await backend.signOut(); user = null; render(); } }, 'Sign out'),
  ));
}

async function render() {
  if (!user) return loginScreen();
  if (user.notAdmin) return notAdminScreen(user.email);
  const { route, params } = parseHash();
  let stats = { pending: 0, failures: 0 };
  let merchants = [];
  try {
    [stats, merchants] = await Promise.all([backend.stats(), backend.listMerchants()]);
  } catch (e) { toast(e.message, true); }

  const link = (key) => {
    const r = ROUTES[key];
    return h('a', { href: `#/${key}`, 'aria-current': key === route ? 'page' : null },
      h('span', { class: 'lnk' }, h('span', null, r.label), h('small', null, r.hint)),
      r.badge && stats[r.badge] > 0 ? h('span', { class: 'count', 'aria-label': `${stats[r.badge]} waiting` }, stats[r.badge]) : null);
  };
  const nav = h('nav', { 'aria-label': 'Sections', class: 'side' },
    h('div', { class: 'brand' }, 'Harvest', h('small', null, 'Ops')),
    GROUPS.map(([title, keys]) => h('div', { class: 'group' }, h('div', { class: 'group-title' }, title), keys.map(link))),
    h('div', { class: 'who' }, h('span', null, user.email),
      h('button', { class: 'signout', onclick: async () => { await backend.signOut(); user = null; render(); } }, 'Sign out')),
  );
  const main = h('main', { class: 'main', id: 'main' });
  if (backend.mode === 'demo') main.append(h('div', { class: 'banner-demo' }, 'Demo mode. This is sample data and nothing you do is saved. Fill in config.js to use your real project.'));
  app.replaceChildren(h('div', { class: 'shell' }, nav, main));
  try {
    main.append(await ROUTES[route].view({ backend, go, merchants, params }));
  } catch (e) {
    main.append(h('div', { class: 'card' }, h('h3', null, 'Could not load this page'), h('p', { class: 'error' }, e.message), h('button', { class: 'btn', onclick: render }, 'Try again')));
  }
  document.title = `${ROUTES[route].label} · Harvest Ops`;
}

addEventListener('hashchange', render);

try {
  backend = await loadBackend();
  user = await backend.session();
} catch (e) {
  app.replaceChildren(h('main', { class: 'login' }, h('h1', null, 'Could not start'), h('p', { class: 'error' }, e.message)));
  throw e;
}
render();

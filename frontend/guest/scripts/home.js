/**
 * The public landing page.
 *
 * Data flow, in one direction and nowhere else:
 *
 *     /api/public/assessments, /api/public/groups, /api/public/site
 *        -> one view each (shared/ui/view.js)
 *        -> the three regions declared in guest/index.html
 *
 * There is no card in the markup and no sample row in this file: every tile
 * below exists because the API returned it.
 */
import { bootChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { escapeHtml, svg, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { loadSession } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';

/* Admin preview: /?preview=visitor renders the page exactly as a visitor receives
   it. Nothing is impersonated and no permission is bypassed. */
const preview = new URLSearchParams(window.location.search).get('preview') === 'visitor';

if (!preview) {
  /* A visitor who is already signed in has no use for "Sign in", so each role is
     sent to the area it owns. The explicit ?preview=visitor link is left alone -
     that is how staff inspect this page. */
  const { user, permissions } = await loadSession({ force: true });
  if (user) window.location.replace(permissions?.isAdmin ? '/admin/dashboard/' : '/user/');
}

await bootChrome({ area: 'guest', active: 'home', preview });

if (preview) {
  document.getElementById('previewBanner').innerHTML =
    `<div class="notice notice--info" role="status">${svg('eye')}
      <p class="notice__body">${escapeHtml(t('guest.previewNotice'))}</p></div>`;
  /* The landing hero only exists to ask a visitor to sign in, so it would
     contradict the staff header a signed-in previewer already has. */
  loadSession({ force: true }).then(({ user }) => {
    if (user) document.getElementById('guestHero')?.setAttribute('hidden', '');
  });
}

/* ------------------------------------------------------------ assessments */

createView('#publicAssessments', {
  load: () => api.get('/api/public/assessments'),
  isEmpty: (data) => !(data?.assessments || []).length,
  empty: { icon: 'list-checks', titleKey: 'msg.empty', bodyKey: 'msg.emptyBody' },
  skeleton: () => '<p class="skeleton skeleton--block"></p><p class="skeleton skeleton--block"></p>',
  render: (data) => {
    const rows = (data.assessments || []).slice(0, 5);
    return `<ul class="rows card card--flush">${rows
      .map(
        (item) => `<li class="row">
        <span class="tile__icon tile__icon--info">${svg('list-checks')}</span>
        <span class="row__main">
          <span class="row__title">${escapeHtml(item.title)}</span>
          ${item.summary ? `<span class="row__sub">${escapeHtml(item.summary)}</span>` : ''}
        </span>
        <span class="row__meta">
          ${item.group ? `<span class="badge">${escapeHtml(item.group)}</span>` : ''}
          ${item.kind ? `<span class="badge badge--outline">${escapeHtml(item.kind)}</span>` : ''}
          ${item.dueDate ? `<span class="badge badge--warning">${escapeHtml(formatDate(item.dueDate))}</span>` : ''}
        </span>
      </li>`
      )
      .join('')}</ul>`;
  },
}).reload();

/* ----------------------------------------------------------------- groups */

createView('#publicGroups', {
  load: () => api.get('/api/public/groups'),
  isEmpty: (data) => !(data?.groups || []).length,
  empty: { icon: 'users', titleKey: 'msg.empty', bodyKey: 'msg.emptyBody' },
  render: (data) =>
    data.groups
      .map(
        (group) => `<article class="card">
      <h3>${escapeHtml(group.name)}</h3>
      ${group.description ? `<p class="muted small">${escapeHtml(group.description)}</p>` : ''}
      <div class="card__foot">
        <a class="btn btn--secondary btn--sm" href="/user/signin/">${svg('arrow-right')}
          <span>${escapeHtml(t('nav.signin'))}</span></a>
      </div>
    </article>`
      )
      .join(''),
}).reload();

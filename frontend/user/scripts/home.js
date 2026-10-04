/**
 * The student dashboard.
 *
 * Four regions, four endpoints, no overlap between them:
 *   #dashStats    /api/user/profile            - the account's own numbers
 *   #myRecords    /api/user/records            - published content for this group
 *   #libraryPeek  /api/public/material-library - a read-only glimpse of the index
 *
 * The library peek is four subject tiles with a link out. It is deliberately NOT
 * the explorer: the explorer lives at /user/library/ and owns that page, so no
 * view here can ever duplicate it.
 */
import { bootChrome } from '/shared/shell.js';
import { api, getQuiet } from '/shared/api.js';
import { escapeHtml, svg, formatDate, initials } from '/shared/ui.js';
import { t, kindLabel } from '/shared/i18n.js';
import { requireSignIn, currentUser } from '/shared/session.js';
import { createView, statGrid } from '/shared/ui/view.js';

await bootChrome({ area: 'user', active: 'home' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

const user = currentUser();

const banner = document.getElementById('userBanner');
if (new URLSearchParams(window.location.search).get('denied') === '1') {
  banner.innerHTML = `<div class="notice notice--danger" role="alert">${svg('lock')}
    <p class="notice__body">${escapeHtml(t('msg.denied'))}</p></div>`;
} else if (user && !user.confirmed) {
  banner.innerHTML = `<div class="notice notice--warning" role="status">${svg('clock')}
    <p class="notice__body">${escapeHtml(t('user.pendingNotice'))}</p></div>`;
}

document.getElementById('homeLead').textContent = `${t('field.group')}: ${user?.group || '-'}`;

/* ------------------------------------------------------------- the stats */

createView('#dashStats', {
  load: () => api.get('/api/user/profile'),
  render: (data) => `<div class="stack">
      <div class="card">
        <div class="cluster">
          <span class="avatar avatar--lg">${escapeHtml(initials(user?.name))}</span>
          <div>
            <p class="card__title">${escapeHtml(data.user.rosterName || data.user.name || '-')}</p>
            <p class="tiny subtle break" dir="ltr">${escapeHtml(data.user.email)}</p>
          </div>
          <span class="spacer"></span>
          <span class="badge ${data.user.confirmed ? 'badge--success' : 'badge--warning'}">
            ${escapeHtml(data.user.confirmed ? t('state.confirmed') : t('state.pending'))}
          </span>
        </div>
      </div>
      ${statGrid([
        [String(data.recordCount ?? 0), t('user.statContent'), 'accent'],
        [String(data.user.group || '-'), t('field.group')],
        [data.user.studentId ? String(data.user.studentId) : '-', t('field.studentId')],
      ])}
    </div>`,
}).reload();

/* ------------------------------------------------------ published content */

createView('#myRecords', {
  load: () => api.get('/api/user/records'),
  isEmpty: (data) => !(data?.records || []).length,
  empty: { icon: 'list-checks', titleKey: 'user.noContentTitle', bodyKey: 'user.noContentBody' },
  render: (data) => {
    const rows = data.records || [];
    const counter = document.getElementById('recordCount');
    if (counter) counter.textContent = String(rows.length);
    return `<ul class="rows card card--flush">${rows
      .map(
        (record) => `<li class="row">
        <span class="tile__icon">${svg('list-checks')}</span>
        <span class="row__main">
          <span class="row__title">${escapeHtml(record.title)}</span>
          ${record.summary || record.body
            ? `<span class="row__sub">${escapeHtml(record.summary || record.body)}</span>`
            : ''}
        </span>
        <span class="row__meta">
          ${record.kind ? `<span class="badge">${escapeHtml(kindLabel(record.kind))}</span>` : ''}
          ${record.dueDate
            ? `<span class="badge badge--warning">${svg('calendar-days')}${escapeHtml(formatDate(record.dueDate))}</span>`
            : ''}
        </span>
      </li>`
      )
      .join('')}</ul>`;
  },
}).reload();

/* --------------------------------------------------------- library glimpse */

/* Optional read: a failure here must not take the dashboard down. */
const index = await getQuiet('/api/public/material-library');
const peek = document.getElementById('libraryPeek');
if (!index || index.available === false) {
  peek.innerHTML = `<div class="notice notice--neutral">${svg('database')}
    <p class="notice__body">${escapeHtml(t('library.notGeneratedTitle'))}</p></div>`;
} else {
  const subjects = (index.subjects || []).slice(0, 4);
  peek.innerHTML = subjects.length
    ? `<div class="grid-auto">${subjects
        .map(
          (subject) => `<a class="tile" href="/user/library/?p=${encodeURIComponent(subject.name)}">
        <span class="tile__icon">${svg('book-open')}</span>
        <span class="tile__title">${escapeHtml(subject.name)}</span>
        <span class="tile__meta">${escapeHtml(t('library.folderWeeks', { count: (subject.weeks || []).length }))}</span>
      </a>`
        )
        .join('')}</div>`
    : `<p class="muted small">${escapeHtml(t('msg.emptyBody'))}</p>`;
}

/**
 * /admin/notifications/ - system and security events, prioritised.
 *
 * The feed is derived from the recorded activity log, which the server already
 * scopes to what this administrator may read. Security events sort above
 * administrative ones, which sort above sign-in and content notices, because that
 * is the order in which an administrator needs to read them.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { escapeHtml, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';
import { staffNotifications, LEVEL_TONE, seenAt, markAllSeen, isUnread } from '/shared/notifications.js';

const session = await bootAdmin({ active: 'notifications' });
if (!session) throw new Error('redirecting');

let level = '';

const view = createView('#adminNotifications', {
  load: () => staffNotifications({ limit: 60 }),
  isEmpty: () => level !== '',
  empty: { icon: 'bell', titleKey: 'notif.none', bodyKey: 'notif.noneBody' },
  render: (items) => {
    const rows = level ? items.filter((item) => item.level === level) : items;
    const counter = document.getElementById('adminNotifCount');
    if (counter) counter.textContent = String(rows.length);

    if (!rows.length) return '';
    const seen = seenAt();

    return `<ul class="rows card card--flush">${rows
      .map((item) => {
        const tone = LEVEL_TONE[item.level] || LEVEL_TONE.info;
        const unread = isUnread(item, seen);
        const toneClass = tone.badge === 'muted' ? 'info' : tone.badge;
        return `<li class="row ${unread ? 'row--unread' : ''}">
        <span class="tile__icon tile__icon--${toneClass}">
          <svg viewBox="0 0 24 24" width="1.15rem" height="1.15rem" aria-hidden="true" focusable="false">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"></path>
          </svg>
        </span>
        <span class="row__main">
          <span class="row__title">${escapeHtml(item.title)}</span>
          ${item.body ? `<span class="row__sub">${escapeHtml(item.body)}</span>` : ''}
          <span class="row__meta">
            <span class="badge badge--${tone.badge}">${escapeHtml(t(tone.key))}</span>
            ${item.at ? `<time datetime="${escapeHtml(item.at)}">${escapeHtml(formatDate(item.at, 'full'))}</time>` : ''}
            ${unread ? `<span class="badge badge--primary">${escapeHtml(t('notif.unread'))}</span>` : ''}
          </span>
        </span>
        ${
          item.href
            ? `<span class="row__actions"><a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">
                 ${escapeHtml(t('action.open'))}</a></span>`
            : ''
        }
      </li>`;
      })
      .join('')}</ul>`;
  },
}).reload();

document.getElementById('adminNotifFilter').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (!button) return;
  level = button.dataset.level;
  for (const other of document.querySelectorAll('#adminNotifFilter [data-level]')) {
    const active = other === button;
    other.classList.toggle('is-active', active);
    other.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  view.refresh();
});

document.getElementById('adminNotifRefresh').addEventListener('click', () => view.reload());

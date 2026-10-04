/**
 * /user/notifications/ - the student's notification centre.
 *
 * The feed is built by shared/notifications.js from endpoints the student can
 * already call. There is no seeded or demo notification: if the server has
 * nothing for this account, the empty state says so and nothing else.
 */
import { bootChrome } from '/shared/shell.js';
import { escapeHtml, svg, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { requireSignIn } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';
import {
  studentNotifications,
  LEVEL_TONE,
  seenAt,
  markAllSeen,
  isUnread,
} from '/shared/notifications.js';

await bootChrome({ area: 'user', active: 'notifications' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

let level = '';

const view = createView('#notificationList', {
  load: () => studentNotifications(),
  isEmpty: () => level !== '',
  empty: { icon: 'bell', titleKey: 'notif.none', bodyKey: 'notif.noneBody' },
  render: (items) => {
    const rows = level ? items.filter((item) => item.level === level) : items;
    const seen = seenAt();
    const counter = document.getElementById('notifCount');
    if (counter) counter.textContent = String(rows.length);

    if (!rows.length) return '';

    return `<ul class="rows card card--flush">${rows
      .map((item) => {
        const tone = LEVEL_TONE[item.level] || LEVEL_TONE.info;
        const unread = isUnread(item, seen);
        return `<li class="row ${unread ? 'row--unread' : ''}">
        <span class="tile__icon tile__icon--${tone.badge === 'muted' ? 'info' : tone.badge}">${svg(tone.icon)}</span>
        <span class="row__main">
          <span class="row__title">${escapeHtml(item.title)}</span>
          ${item.body ? `<span class="row__sub">${escapeHtml(item.body)}</span>` : ''}
          <span class="row__meta">
            <span class="badge badge--${tone.badge}">${escapeHtml(t(tone.key))}</span>
            ${item.meta ? `<span class="truncate">${escapeHtml(item.meta)}</span>` : ''}
            ${item.at ? `<span>${escapeHtml(formatDate(item.at))}</span>` : ''}
            ${unread ? `<span class="badge badge--primary">${svg('dot')}${escapeHtml(t('notif.unread'))}</span>` : ''}
          </span>
        </span>
        ${
          item.href
            ? `<span class="row__actions"><a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">
                 ${svg('arrow-up-right')}<span>${escapeHtml(t('action.open'))}</span></a></span>`
            : ''
        }
      </li>`;
      })
      .join('')}</ul>`;
  },
}).reload();

/* The filter only re-renders what is already in memory. */
document.getElementById('notifFilter').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level]');
  if (!button) return;
  level = button.dataset.level;
  for (const other of document.querySelectorAll('#notifFilter [data-level]')) {
    const active = other === button;
    other.classList.toggle('is-active', active);
    other.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  view.refresh();
});

document.getElementById('notifRefresh').addEventListener('click', () => view.reload());

document.getElementById('notifMarkRead').addEventListener('click', () => {
  markAllSeen();
  view.refresh();
});

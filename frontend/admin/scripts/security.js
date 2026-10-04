/**
 * /admin/security/ - sign-in and security events only.
 *
 * A focused view over the same activity log, filtered to the levels that matter
 * for security review. It reuses the notification feed rather than adding a
 * second reader, so the two pages can never report different numbers.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { createView, statGrid } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'security' });
if (!session) throw new Error('redirecting');

/** The log endpoint answers both a single level and "all"; asking for both
 *  security-relevant levels and merging is clearer than two round trips. */
async function loadSecurityEvents() {
  const [security, auth] = await Promise.all([
    api.get('/api/admin/activity?level=security&limit=200'),
    api.get('/api/admin/activity?level=auth&limit=200'),
  ]);
  const pick = (payload) => payload?.activity || payload?.events || [];
  return [...pick(security), ...pick(auth)].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

const statsView = createView('#securityStats', {
  load: loadSecurityEvents,
  render: (rows) => {
    const day = 24 * 60 * 60 * 1000;
    const recent = rows.filter((row) => Date.now() - Date.parse(row.createdAt || 0) < day).length;
    const actors = new Set(rows.map((row) => row.actor).filter(Boolean)).size;
    return statGrid([
      [String(rows.length), t('admin.securityTotal'), 'accent'],
      [String(recent), t('admin.securityLast24h'), recent ? 'warning' : 'success'],
      [String(actors), t('admin.securityActors')],
    ]);
  },
});
statsView.reload();

const eventsView = createView('#securityEvents', {
  load: loadSecurityEvents,
  isEmpty: (rows) => !rows.length,
  empty: { icon: 'shield-check', titleKey: 'admin.noSecurityEvents', bodyKey: 'admin.noSecurityEventsBody' },
  render: (rows) => {
    const counter = document.getElementById('securityCount');
    if (counter) counter.textContent = String(rows.length);
    const lead = document.getElementById('securityLead');
    if (lead) lead.textContent = t('admin.securityNote');

    return `<ul class="rows card card--flush">${rows
      .map(
        (row) => `<li class="row">
      <span class="tile__icon tile__icon--${row.level === 'security' ? 'danger' : 'info'}">
        <svg viewBox="0 0 24 24" width="1.15rem" height="1.15rem" aria-hidden="true" focusable="false">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"></path>
        </svg>
      </span>
      <span class="row__main">
        <span class="row__title">${escapeHtml(row.action)}</span>
        <span class="row__meta">
          <span class="badge badge--${row.level === 'security' ? 'danger' : 'info'}">${escapeHtml(t(`level.${row.level}`))}</span>
          <span>${escapeHtml(row.actor || '-')}</span>
          <time datetime="${escapeHtml(row.createdAt || '')}">${escapeHtml(formatDate(row.createdAt, 'full'))}</time>
        </span>
      </span>
      ${
        row.page && String(row.page).startsWith('/')
          ? `<span class="row__actions"><a class="btn btn--ghost btn--sm" href="${escapeHtml(row.page)}">
               ${escapeHtml(t('action.open'))}</a></span>`
          : ''
      }
    </li>`
      )
      .join('')}</ul>`;
  },
});
eventsView.reload();

/**
 * /admin/activity/ - the recorded event log.
 *
 * The same rows that feed the notification bell, rendered as a filterable list
 * with a details dialog. Filters apply to data already in memory, so changing
 * one never re-requests and never blanks the page.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'activity' });
if (!session) throw new Error('redirecting');

const whoSelect = document.getElementById('activityWho');
const actorSelect = document.getElementById('activityActor');
const levelSelect = document.getElementById('activityLevel');

const LEVEL_BADGE = { security: 'danger', auth: 'info', admin: 'warning', info: 'muted' };
let rows = [];

function visible() {
  const who = whoSelect?.value || '';
  const actor = actorSelect?.value || '';
  const level = levelSelect?.value || '';
  return rows.filter((row) => {
    if (level && row.level !== level) return false;
    /* Staff events carry a privileged actorRole; student events carry 'user'. */
    const isStaffRow = Boolean(row.actorRole) && row.actorRole !== 'user';
    if (who === 'admin' && !isStaffRow) return false;
    if (who === 'user' && isStaffRow) return false;
    if (actor && row.actor !== actor) return false;
    return true;
  });
}

function paint() {
  const list = visible();
  const counter = document.getElementById('activityCount');
  if (counter) counter.textContent = String(list.length);

  if (!list.length) {
    host.innerHTML = `<div class="state" role="status">
        <p class="state__title">${escapeHtml(t('msg.empty'))}</p>
        <p class="state__body">${escapeHtml(t('admin.noActivityBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = `<ul class="rows card card--flush">${list
    .map(
      (row) => `<li class="row">
      <span class="tile__icon tile__icon--${LEVEL_BADGE[row.level] === 'danger' ? 'danger' : LEVEL_BADGE[row.level] === 'muted' ? 'info' : LEVEL_BADGE[row.level]}">
        <svg viewBox="0 0 24 24" width="1.15rem" height="1.15rem" aria-hidden="true" focusable="false">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      </span>
      <span class="row__main">
        <span class="row__title">${escapeHtml(row.action)}</span>
        <span class="row__meta">
          <span class="badge badge--${LEVEL_BADGE[row.level] || 'muted'}">${escapeHtml(t(`level.${row.level}`))}</span>
          <span>${escapeHtml(row.actor || '-')}</span>
          <time datetime="${escapeHtml(row.createdAt || '')}">${escapeHtml(formatDate(row.createdAt, 'full'))}</time>
        </span>
      </span>
      <span class="row__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-event="${escapeHtml(row.id || '')}"
                data-actor="${escapeHtml(row.actor || '')}" data-action="${escapeHtml(row.action)}"
                data-page="${escapeHtml(row.page || '')}" data-level="${escapeHtml(row.level || '')}"
                data-role="${escapeHtml(row.actorRole || '')}"
                data-time="${escapeHtml(formatDate(row.createdAt, 'full'))}">
          ${escapeHtml(t('admin.eventDetails'))}</button>
      </span>
    </li>`
    )
    .join('')}</ul>`;
}

const view = createView('#activityList', {
  load: () => api.get('/api/admin/activity?limit=500'),
  render: (data) => {
    rows = data.activity || data.events || [];
    const actors = [...new Set(rows.map((row) => row.actor).filter(Boolean))].sort();
    const current = actorSelect?.value;
    if (actorSelect) {
      actorSelect.innerHTML =
        `<option value="">${escapeHtml(t('admin.allActors'))}</option>` +
        actors.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      actorSelect.value = actors.includes(current) ? current : '';
    }
    const lead = document.getElementById('activityLead');
    if (lead) lead.textContent = t('admin.logNote');
    return paint();
  },
  isEmpty: (data) => !(data?.activity || data?.events || []).length,
  empty: { icon: 'activity', titleKey: 'msg.empty', bodyKey: 'admin.noActivityBody' },
}).reload();

for (const select of [whoSelect, actorSelect, levelSelect]) select?.addEventListener('change', paint);

/* ------------------------------------------------------------ the dialog */

const dialog = document.getElementById('eventDialog');
const body = document.getElementById('eventBody');

document.getElementById('activityList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-event]');
  if (!button) return;
  const fact = (label, value) =>
    `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '-')}</dd>`;
  body.innerHTML = [
    fact(t('field.actor'), button.dataset.actor),
    fact(t('field.level'), t(`level.${button.dataset.level || 'info'}`)),
    fact(t('field.actions'), button.dataset.action),
    fact(t('field.page'), button.dataset.page),
    fact(t('field.role'), button.dataset.role ? t(`role.${button.dataset.role}`) : '-'),
    fact(t('field.time'), button.dataset.time),
  ].join('');
  dialog.showModal();
});

document.getElementById('eventClose').addEventListener('click', () => dialog.close());
/* Clicking the backdrop closes, as a dialog is expected to. */
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

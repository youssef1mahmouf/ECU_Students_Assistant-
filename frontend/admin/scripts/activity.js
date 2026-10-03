import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, mount } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'activity' });

const byId = (id) => document.getElementById(id);
let rows = [];

/** Date + time, in the language of the page. */
function stamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(document.documentElement.lang || 'ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Rows stay concise: only the actor, the action and a Details button are listed. */
function render() {
  mount(
    '#activityList',
    rows.length
      ? rows
          .map(
            (item, index) => `<li class="level-${escapeHtml(item.level || 'info')}">
          <span class="who">${escapeHtml(item.actor || '-')}</span>
          <span>${escapeHtml(item.action || '')}</span>
          <span class="badge ${item.level === 'security' ? 'danger' : item.level === 'admin' ? 'warn' : 'muted'}">
            ${escapeHtml(t(`level.${item.level || 'info'}`))}
          </span>
          <button class="btn secondary small" type="button" data-details="${index}">${escapeHtml(t('action.details'))}</button>
        </li>`
          )
          .join('')
      : `<li>${escapeHtml(t('msg.empty'))}</li>`
  );
}

function openDetails(index) {
  const item = rows[index];
  if (!item) return;
  mount(
    '#eventBody',
    `<dt>${escapeHtml(t('admin.detailWho'))}</dt><dd>${escapeHtml(item.actor || '-')}</dd>
     <dt>${escapeHtml(t('admin.detailWhen'))}</dt><dd>${escapeHtml(stamp(item.createdAt))}</dd>
     <dt>${escapeHtml(t('admin.detailWhat'))}</dt><dd>${escapeHtml(item.action || '')}</dd>
     <dt>${escapeHtml(t('admin.detailWhere'))}</dt><dd>${escapeHtml(item.page || '-')}</dd>
     <dt>${escapeHtml(t('admin.detailType'))}</dt><dd>${escapeHtml(
       item.kind === 'pageview' ? t('admin.kindPageview') : t('admin.kindAction')
     )} · ${escapeHtml(t(`level.${item.level || 'info'}`))}</dd>`
  );
  byId('eventDialog').showModal();
}

async function loadActivity() {
  const params = new URLSearchParams({ limit: byId('activityLimit').value });
  if (byId('activityWho').value) params.set('who', byId('activityWho').value);
  if (byId('activityActor').value) params.set('actor', byId('activityActor').value);
  const data = await api.getQuiet(`/api/admin/activity?${params}`);
  rows = (data?.activity || []).filter(
    (item) => !byId('activityLevel').value || item.level === byId('activityLevel').value
  );

  const actorSelect = byId('activityActor');
  const selectedActor = actorSelect.value;
  const actors = data?.actors || [];
  actorSelect.innerHTML = `<option value="">${escapeHtml(t('admin.allActors'))}</option>${actors
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('')}`;
  // The server answers the actor list for the current filter, so a stale choice falls back.
  actorSelect.value = actors.includes(selectedActor) ? selectedActor : '';

  render();
}

if (session) {
  byId('eventClose').addEventListener('click', () => byId('eventDialog').close());
  byId('activityWho').addEventListener('change', () => {
    byId('activityActor').value = '';
    void loadActivity();
  });
  byId('activityActor').addEventListener('change', () => void loadActivity());
  byId('activityLevel').addEventListener('change', () => render());
  byId('activityLimit').addEventListener('change', () => void loadActivity());
  byId('refreshActivity').addEventListener('click', () => void loadActivity());
  byId('activityList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-details]');
    if (button) openDetails(Number(button.dataset.details));
  });
  await loadActivity();
  onLanguageChange(() => {
    void loadActivity();
  });
}

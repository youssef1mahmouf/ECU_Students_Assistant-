import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount, showMessage, toast, confirmDialog } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { requireSignIn } from '/shared/session.js';

await bootChrome({ area: 'user', active: 'groups' });
const session = await requireSignIn({ redirectTo: '/user/signin/' });

if (session) {
  const user = session.user;

  if (!user.confirmed) {
    mount('#userBanner', `<div class="banner" role="status">${escapeHtml(t('user.pendingNotice'))}</div>`);
  }

  /* The server only answers /api/user/groups with the caller's own group, so the list of
     joinable group names comes from the deliberately public endpoint (names + description
     only - notes, subjects and members are never public). */
  const [mine, catalogue] = await Promise.all([
    api.getQuiet('/api/user/groups'),
    api.getQuiet('/api/public/groups'),
  ]);
  const currentGroup = mine?.currentGroup || '';
  const mineNames = new Set((mine?.groups || []).map((group) => group.name));
  const groups = catalogue?.groups || [];

  mount(
    '#groupCards',
    groups.length
      ? groups
          .map(
            (group) => `<article class="group-card${mineNames.has(group.name) ? ' is-mine' : ''}">
          <h3 dir="auto">${escapeHtml(group.name)}</h3>
          <p>${escapeHtml(group.description || '')}</p>
          ${
            mineNames.has(group.name)
              ? `<span class="badge ok">${user.confirmed ? escapeHtml(t('state.confirmed')) : escapeHtml(t('state.pending'))}</span>`
              : group.name === currentGroup
                ? `<span class="badge warn">${escapeHtml(t('state.pending'))}</span>`
                : `<button class="btn secondary small" type="button" data-join="${escapeHtml(group.name)}">${escapeHtml(t('action.join'))}</button>`
          }
        </article>`
          )
          .join('')
      : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
  );

  document.getElementById('groupCards').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-join]');
    if (!button) return;
    const group = button.dataset.join;
    if (!confirmDialog(t('confirm.joinGroup', { group }))) return;
    button.disabled = true;
    try {
      const result = await api.post('/api/user/group-request', { group });
      showMessage('groupMessage', result.message, 'success');
      toast(result.message, 'success');
    } catch (error) {
      showMessage('groupMessage', error.message, 'error');
      button.disabled = false;
    }
  });

  if (user.permissions?.canReadGroupContent) {
    const records = await api.getQuiet('/api/user/records');
    const rows = records?.records || [];
    mount(
      '#groupRecords',
      rows.length
        ? rows
            .map(
              (record) => `<article class="list-row">
            <div class="row-main">
              <strong>${escapeHtml(record.title)}</strong>
              <small>${escapeHtml(record.body || record.summary || '')}</small>
            </div>
            <div class="row-actions">
              ${record.kind ? `<span class="badge">${escapeHtml(record.kind)}</span>` : ''}
              ${record.dueDate ? `<span class="badge warn">${escapeHtml(formatDate(record.dueDate))}</span>` : ''}
            </div>
          </article>`
            )
            .join('')
        : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
    );
  } else {
    mount('#groupRecords', `<p class="empty">${escapeHtml(t('user.pendingNotice'))}</p>`);
  }
}

import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { confirmDialog, escapeHtml, formatDate, mount, showMessage, toast } from '/shared/ui.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'accounts' });
const GROUPS = new Set();

function statusBadges(user) {
  const badges = [];
  if (user.protected) badges.push(`<span class="badge danger">${escapeHtml(t('state.protected'))}</span>`);
  if (user.role !== 'user') badges.push(`<span class="badge">${escapeHtml(t(`role.${user.role}`))}</span>`);
  if (user.active === false) badges.push(`<span class="badge danger">${escapeHtml(t('msg.disabled'))}</span>`);
  else if (user.role === 'user' && !user.confirmed) badges.push(`<span class="badge warn">${escapeHtml(t('state.pending'))}</span>`);
  else if (user.confirmed) badges.push(`<span class="badge ok">${escapeHtml(t('state.confirmed'))}</span>`);
  return badges.join(' ') || `<span class="badge muted">${escapeHtml(t('state.active'))}</span>`;
}

function groupCell(user) {
  if (user.role !== 'user') return `<span dir="ltr">${escapeHtml(user.group || '-')}</span>`;
  return `<select data-group-for="${escapeHtml(user.id)}" aria-label="${escapeHtml(t('field.group'))}">
      <option value="">${escapeHtml(user.group || t('msg.noGroup'))}</option>
      ${[...GROUPS].map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}
    </select>`;
}

function actionCell(user, isSuper) {
  /* The protected owner account shows no Password / Disable / Delete buttons at all.
     The server blocks those actions too, so this is display-only hardening. */
  if (user.protected) return `<span class="badge danger">${escapeHtml(t('state.protected'))}</span>`;
  return `<div class="row-actions">
      ${
        user.role === 'user' && !user.confirmed
          ? `<button class="btn small" type="button" data-approve="${escapeHtml(user.id)}">${escapeHtml(t('action.approve'))}</button>`
          : ''
      }
      <button class="btn secondary small" type="button" data-reset="${escapeHtml(user.id)}" data-name="${escapeHtml(user.name)}">${escapeHtml(t('action.resetPassword'))}</button>
      <button class="btn ${user.active === false ? '' : 'secondary'} small" type="button"
              data-active="${escapeHtml(user.id)}" data-next="${user.active === false ? 'true' : 'false'}">
        ${user.active === false ? escapeHtml(t('action.enable')) : escapeHtml(t('action.disable'))}
      </button>
      ${
        isSuper || user.role === 'user'
          ? `<button class="btn danger small" type="button" data-delete="${escapeHtml(user.id)}" data-name="${escapeHtml(user.name)}">${escapeHtml(t('action.delete'))}</button>`
          : ''
      }
    </div>`;
}

async function loadAccounts() {
  const data = await api.getQuiet('/api/admin/users');
  const users = data?.users || [];
  const isSuper = Boolean(session.permissions.isSuperAdmin);

  mount(
    '#accountRows',
    users.length
      ? users
          .map(
            (user) => `<tr>
          <th scope="row"><span>${escapeHtml(user.name)}</span>
            <small class="row-sub">${escapeHtml(formatDate(user.lastLoginAt) || t('msg.neverSignedIn'))}</small></th>
          <td dir="ltr">${escapeHtml(user.email)}</td>
          <td>${groupCell(user)}</td>
          <td>${statusBadges(user)}</td>
          <td>${actionCell(user, isSuper)}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" class="empty">${escapeHtml(t('msg.empty'))}</td></tr>`
  );
}

async function patchUser(id, patch) {
  try {
    await api.patch(`/api/admin/users/${encodeURIComponent(id)}`, patch);
    toast(t('msg.updated'), 'success');
    await loadAccounts();
    return true;
  } catch (error) {
    showMessage('accountMessage', serverText(error.message), 'error');
    return false;
  }
}

if (!session) {
  /* bootAdmin already redirected a visitor without admin rights. */
} else {
  const groups = await api.getQuiet('/api/admin/groups');
  for (const group of groups?.groups || []) GROUPS.add(group.name);

  const roleSelect = document.getElementById('createRole');
  if (!session.permissions.isSuperAdmin) for (const option of roleSelect.options) if (option.value !== 'user') option.disabled = true;
  document.getElementById('createGroup').innerHTML = [...GROUPS]
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join('');

  await loadAccounts();

  const rows = document.getElementById('accountRows');

  rows.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.approve) return patchUser(button.dataset.approve, { confirmed: true });
    if (button.dataset.active) return patchUser(button.dataset.active, { active: button.dataset.next === 'true' });

    if (button.dataset.reset) {
      const password = window.prompt(t('msg.promptNewPassword', { name: button.dataset.name }));
      if (password === null) return;
      try {
        await api.post(`/api/admin/users/${encodeURIComponent(button.dataset.reset)}/password`, { password });
        showMessage('accountMessage', t('msg.passwordSet'), 'success');
        toast(t('msg.passwordSet'), 'success');
      } catch (error) {
        showMessage('accountMessage', serverText(error.message), 'error');
      }
      return;
    }

    if (button.dataset.delete) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.name }))) return;
      try {
        await api.del(`/api/admin/users/${encodeURIComponent(button.dataset.delete)}`);
        toast(t('msg.accountDeleted'), 'success');
        await loadAccounts();
      } catch (error) {
        showMessage('accountMessage', serverText(error.message), 'error');
      }
    }
  });

  rows.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-group-for]');
    if (!select || !select.value) return;
    await patchUser(select.dataset.groupFor, { group: select.value });
  });

  document.getElementById('createForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      const result = await api.post('/api/admin/users', {
        name: String(data.name || '').trim(),
        email: String(data.email || '').trim().toLowerCase(),
        password: data.password,
        role: data.role,
        ...(data.role === 'user' ? { group: data.group } : {}),
      });
      event.target.reset();
      showMessage('createMessage', `${t('msg.accountCreated')} ${result.user.email}`, 'success');
      toast(t('msg.accountCreated'), 'success');
      await loadAccounts();
    } catch (error) {
      showMessage('createMessage', serverText(error.message), 'error');
    }
  });

  /* Rebuild the table on a language switch: badges and buttons come from t(). */
  onLanguageChange(() => {
    void loadAccounts();
  });
}

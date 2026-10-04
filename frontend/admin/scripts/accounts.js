/**
 * /admin/accounts/ - the account list and the per-account actions.
 *
 * Everything the buttons do goes through a guarded API call and then invalidates
 * the account-scoped reads, so the table below always shows what the server now
 * holds rather than what the browser hoped it changed. The server refuses the
 * privileged actions regardless of what this page renders.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { escapeHtml, formatDate, showMessage, setBusy, toast, confirmDialog } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';
import { permissions } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'accounts' });
if (!session) throw new Error('redirecting');

const caps = permissions();
let accounts = [];

const searchInput = document.getElementById('accountSearch');
const statusSelect = document.getElementById('accountStatus');
const toolbar = document.getElementById('accountsToolbar');

function visible() {
  const needle = (searchInput?.value || '').trim().toLowerCase();
  const status = statusSelect?.value || '';
  return accounts.filter((row) => {
    if (status === 'staff' && row.role === 'user') return false;
    if (status === 'pending' && row.confirmed) return false;
    if (status === 'confirmed' && !row.confirmed) return false;
    if (!needle) return true;
    return `${row.name} ${row.email} ${row.group || ''}`.toLowerCase().includes(needle);
  });
}

function render() {
  const rows = visible();
  const counter = document.getElementById('accountCount');
  if (counter) counter.textContent = String(rows.length);
  if (toolbar) toolbar.hidden = accounts.length === 0;
  if (!rows.length) {
    host.innerHTML = `<div class="state" role="status">
        <span class="state__icon">
          <svg viewBox="0 0 24 24" width="1.4rem" height="1.4rem" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
          </svg>
        </span>
        <p class="state__title">${escapeHtml(t('msg.searchNoResults'))}</p>
        <p class="state__body">${escapeHtml(t('msg.searchNoResultsBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('admin.accountList'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.name'))}</th>
            <th scope="col">${escapeHtml(t('field.email'))}</th>
            <th scope="col">${escapeHtml(t('field.group'))}</th>
            <th scope="col">${escapeHtml(t('field.role'))}</th>
            <th scope="col">${escapeHtml(t('field.status'))}</th>
            <th scope="col">${escapeHtml(t('field.actions'))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const canManage = row.role === 'user' || caps.isSuperAdmin;
              const guarded = !canManage || row.protected;
              return `<tr>
              <th scope="row" data-label="${escapeHtml(t('field.name'))}">
                <span class="table__primary">${escapeHtml(row.name)}</span>
                <small class="table__sub">${escapeHtml(t('admin.joinedOn', { date: formatDate(row.createdAt) }))}</small>
              </th>
              <td data-label="${escapeHtml(t('field.email'))}" dir="ltr" class="break">${escapeHtml(row.email)}</td>
              <td data-label="${escapeHtml(t('field.group'))}">${escapeHtml(row.group || '-')}</td>
              <td data-label="${escapeHtml(t('field.role'))}"><span class="badge">${escapeHtml(t(`role.${row.role}`))}</span></td>
              <td data-label="${escapeHtml(t('field.status'))}">
                <span class="badge ${row.confirmed ? 'badge--success' : 'badge--warning'}">${
                  escapeHtml(row.confirmed ? t('state.confirmed') : t('state.pending'))
                }</span>
              </td>
              <td data-label="${escapeHtml(t('field.actions'))}">
                ${
                  guarded
                    ? `<span class="tiny subtle">${escapeHtml(t('admin.managedByOwner'))}</span>`
                    : `<div class="table__actions">
                        ${
                          row.confirmed
                            ? ''
                            : `<button class="btn btn--secondary btn--sm" type="button" data-approve="${escapeHtml(row.id)}">
                                 ${escapeHtml(t('action.approve'))}</button>`
                        }
                        <button class="btn btn--secondary btn--sm" type="button" data-disable="${escapeHtml(row.id)}"
                                data-next="${row.active === false ? 'true' : 'false'}">
                          ${escapeHtml(row.active === false ? t('action.enable') : t('action.disable'))}</button>
                        <button class="btn btn--danger btn--sm" type="button" data-delete-account="${escapeHtml(row.id)}"
                                data-name="${escapeHtml(row.name)}">${escapeHtml(t('action.delete'))}</button>
                      </div>`
                }
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
}

const view = createView('#accountRows', {
  load: () => api.get('/api/admin/users'),
  render: (data) => {
    accounts = data.users || [];
    return render();
  },
  isEmpty: (data) => !(data?.users || []).length,
  empty: { icon: 'users', titleKey: 'admin.noAccounts', bodyKey: 'admin.noAccountsBody' },
});

view.reload();

searchInput?.addEventListener('input', render);
statusSelect?.addEventListener('change', render);

document.getElementById('accountRows').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.approve) {
      await api.patch(`/api/admin/users/${encodeURIComponent(button.dataset.approve)}`, { confirmed: true });
      toast(t('msg.accountApproved'), 'success');
    } else if (button.dataset.disable) {
      await api.patch(`/api/admin/users/${encodeURIComponent(button.dataset.disable)}`, {
        active: button.dataset.next === 'true',
      });
      toast(t('msg.saved'), 'success');
    } else if (button.dataset.deleteAccount) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/users/${encodeURIComponent(button.dataset.deleteAccount)}`);
      toast(t('msg.deleted'), 'success');
    } else {
      return;
    }
    /* The server changed account data: drop the account-scoped reads and re-read,
       so the table and the bell agree without a manual reload. */
    invalidateApi(['/api/admin/users', '/api/admin/overview', '/api/admin/activity']);
    showMessage('accountMessage', '');
    await view.reload();
  } catch (error) {
    showMessage('accountMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

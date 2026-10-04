/** /admin/problems/ - the problem reports students submitted. */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { escapeHtml, formatDate, showMessage, toast } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';
import { permissions } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'problems' });
if (!session) throw new Error('redirecting');

const canManage = permissions().capabilities?.includes('problemsManage');
const statusSelect = document.getElementById('problemStatusFilter');
let rows = [];

function visible() {
  const status = statusSelect?.value || '';
  return status ? rows.filter((row) => row.status === status) : rows;
}

function paint() {
  const list = visible();
  const counter = document.getElementById('problemCount');
  if (counter) counter.textContent = String(list.length);

  if (!list.length) {
    host.innerHTML = `<div class="state" role="status">
        <p class="state__title">${escapeHtml(t('msg.empty'))}</p>
        <p class="state__body">${escapeHtml(t('admin.noProblemsBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('admin.problemList'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('admin.problemReporter'))}</th>
            <th scope="col">${escapeHtml(t('admin.problemTime'))}</th>
            <th scope="col">${escapeHtml(t('admin.problemCategory'))}</th>
            <th scope="col">${escapeHtml(t('admin.problemDescription'))}</th>
            <th scope="col">${escapeHtml(t('admin.problemPage'))}</th>
            <th scope="col">${escapeHtml(t('admin.problemStatus'))}</th>
            ${canManage ? `<th scope="col">${escapeHtml(t('field.actions'))}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (row) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('admin.problemReporter'))}">
              <span class="table__primary">${escapeHtml(row.reporterName || '-')}</span>
              <small class="table__sub" dir="ltr">${escapeHtml(row.reporterEmail || '')}</small>
            </th>
            <td data-label="${escapeHtml(t('admin.problemTime'))}">${escapeHtml(formatDate(row.createdAt, 'full'))}</td>
            <td data-label="${escapeHtml(t('admin.problemCategory'))}"><span class="badge">${
              escapeHtml(t(`problems.category${row.category.charAt(0).toUpperCase()}${row.category.slice(1)}`))
            }</span></td>
            <td data-label="${escapeHtml(t('admin.problemDescription'))}" class="break">${escapeHtml(row.description)}</td>
            <td data-label="${escapeHtml(t('admin.problemPage'))}" dir="ltr" class="truncate">${
              escapeHtml(row.page || '-')
            }</td>
            <td data-label="${escapeHtml(t('admin.problemStatus'))}">
              <span class="badge ${row.status === 'resolved' ? 'badge--success' : 'badge--warning'}">${
                escapeHtml(t(row.status === 'resolved' ? 'state.resolved' : 'state.open'))
              }</span>
            </td>
            ${
              canManage
                ? `<td data-label="${escapeHtml(t('field.actions'))}">
                    <div class="table__actions">
                      <button class="btn btn--secondary btn--sm" type="button" data-resolve="${escapeHtml(row.id)}"
                              data-next="${row.status === 'resolved' ? 'open' : 'resolved'}">
                        ${escapeHtml(row.status === 'resolved' ? t('state.open') : t('state.resolved'))}</button>
                    </div>
                  </td>`
                : ''
            }
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

const view = createView('#problemRows', {
  load: () => api.get('/api/admin/problems'),
  render: (data) => {
    rows = data.problems || [];
    return paint();
  },
  isEmpty: (data) => !(data?.problems || []).length,
  empty: { icon: 'circle-help', titleKey: 'admin.noProblems', bodyKey: 'admin.noProblemsBody' },
}).reload();

statusSelect?.addEventListener('change', paint);

document.getElementById('problemRows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-resolve]');
  if (!button) return;
  try {
    await api.patch(`/api/admin/problems/${encodeURIComponent(button.dataset.resolve)}`, {
      status: button.dataset.next,
    });
    toast(t('msg.saved'), 'success');
    invalidateApi(['/api/admin/problems']);
    await view.reload();
  } catch (error) {
    showMessage('problemMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

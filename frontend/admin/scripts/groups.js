/**
 * /admin/groups/ - group cards, group content, and the "new content" form.
 *
 * One page, three jobs, three regions: #groupRows (groups), #contentRows (the
 * published and draft content of the selected group) and #recordForm (create).
 * Each is filled by one renderer from one endpoint, so nothing overlaps.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { escapeHtml, formatDate, showMessage, setBusy, toast, confirmDialog } from '/shared/ui.js';
import { t, serverText, kindLabel } from '/shared/i18n.js';
import { permissions } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'groups' });
if (!session) throw new Error('redirecting');

const caps = permissions();
const contentGroup = document.getElementById('contentGroup');

let groups = [];
let records = [];

/** Suggested due date: one week out, as the old form did, but editable. */
function suggestDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ groups */

function paintGroups() {
  if (!groups.length) {
    host.innerHTML = `<div class="state" role="status">
        <span class="state__icon">
          <svg viewBox="0 0 24 24" width="1.4rem" height="1.4rem" aria-hidden="true" focusable="false">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
          </svg>
        </span>
        <p class="state__title">${escapeHtml(t('msg.empty'))}</p>
        <p class="state__body">${escapeHtml(t('admin.noGroupsBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = groups
    .map((group) => {
      const editable = caps.capabilities?.includes('groupsManage');
      return `<article class="card">
        <div class="card__head">
          <h3 class="card__title" dir="auto">${escapeHtml(group.name)}</h3>
          <span class="count-pill">${escapeHtml(String(group.memberCount ?? 0))}</span>
        </div>
        ${group.description ? `<p class="muted small">${escapeHtml(group.description)}</p>` : ''}
        ${
          group.notes
            ? `<p class="small" style="color:var(--color-warning)">${escapeHtml(group.notes)}</p>`
            : ''
        }
        ${
          editable
            ? `<div class="card__foot">
                <button class="btn btn--secondary btn--sm" type="button" data-rename="${escapeHtml(group.name)}">
                  ${escapeHtml(t('action.rename'))}</button>
                <button class="btn btn--danger btn--sm" type="button" data-delete-group="${escapeHtml(group.name)}">
                  ${escapeHtml(t('action.delete'))}</button>
              </div>`
            : ''
        }
      </article>`;
    })
    .join('');
}

const groupsView = createView('#groupRows', {
  load: () => api.get('/api/admin/groups'),
  render: (data) => {
    groups = data.groups || [];

    const names = groups.map((group) => group.name);
    for (const select of [contentGroup, document.getElementById('recordGroups')]) {
      if (!select) continue;
      const current = [...select.selectedOptions].map((option) => option.value);
      select.innerHTML = names
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join('');
      for (const option of select.options) option.selected = current.includes(option.value);
    }
    return paintGroups();
  },
  isEmpty: (data) => !(data?.groups || []).length,
  empty: () => ({ icon: 'users', titleKey: 'msg.empty', bodyKey: 'admin.noGroupsBody' }),
}).reload();

/* ----------------------------------------------------------------- content */

function paintRecords() {
  if (!records.length) {
    host.innerHTML = `<div class="state" role="status">
        <p class="state__title">${escapeHtml(t('msg.empty'))}</p>
        <p class="state__body">${escapeHtml(t('admin.noRecordsBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('admin.recordList'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.title'))}</th>
            <th scope="col">${escapeHtml(t('field.group'))}</th>
            <th scope="col">${escapeHtml(t('field.kind'))}</th>
            <th scope="col">${escapeHtml(t('field.dueDate'))}</th>
            <th scope="col">${escapeHtml(t('field.status'))}</th>
            <th scope="col">${escapeHtml(t('field.actions'))}</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('field.title'))}">
              <span class="table__primary">${escapeHtml(record.title)}</span>
              ${record.summary ? `<small class="table__sub">${escapeHtml(record.summary)}</small>` : ''}
            </th>
            <td data-label="${escapeHtml(t('field.group'))}">${escapeHtml(
              (record.groups || [record.group]).filter(Boolean).join(', ') || '-'
            )}</td>
            <td data-label="${escapeHtml(t('field.kind'))}">${escapeHtml(kindLabel(record.kind))}</td>
            <td data-label="${escapeHtml(t('field.dueDate'))}">${
              record.dueDate ? escapeHtml(formatDate(record.dueDate)) : '-'
            }</td>
            <td data-label="${escapeHtml(t('field.status'))}">
              <span class="badge ${record.published ? 'badge--success' : 'badge--outline'}">${
                escapeHtml(record.published ? t('documents.published') : t('documents.draft'))
              }</span>
            </td>
            <td data-label="${escapeHtml(t('field.actions'))}">
              <div class="table__actions">
                <button class="btn btn--secondary btn--sm" type="button" data-publish="${escapeHtml(record.id)}"
                        data-next="${record.published ? 'false' : 'true'}">
                  ${escapeHtml(record.published ? t('action.unpublish') : t('action.publish'))}</button>
                <button class="btn btn--danger btn--sm" type="button" data-delete-record="${escapeHtml(record.id)}"
                        data-name="${escapeHtml(record.title)}">${escapeHtml(t('action.delete'))}</button>
              </div>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

const recordsView = createView('#contentRows', {
  load: () => api.get('/api/admin/records'),
  render: (data) => {
    const selected = contentGroup?.value || '';
    records = (data.records || []).filter((record) => !selected || record.group === selected);
    return paintRecords();
  },
  isEmpty: () => false,
}).reload();

contentGroup?.addEventListener('change', () => recordsView.reload());

/* -------------------------------------------------------------- mutations */

document.getElementById('groupRows').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.deleteGroup) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.deleteGroup }))) return;
      const target = groups.find((group) => group.name === button.dataset.deleteGroup);
      await api.del(`/api/admin/groups/${encodeURIComponent(target.id)}`);
      toast(t('msg.deleted'), 'success');
      invalidateApi(['/api/admin/groups', '/api/admin/records', '/api/public/groups']);
      await groupsView.reload();
      await recordsView.reload();
    }
  } catch (error) {
    showMessage('groupMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

document.getElementById('contentRows').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.publish) {
      await api.patch(`/api/admin/records/${encodeURIComponent(button.dataset.publish)}`, {
        published: button.dataset.next === 'true',
      });
      toast(t('msg.saved'), 'success');
    } else if (button.dataset.deleteRecord) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/records/${encodeURIComponent(button.dataset.deleteRecord)}`);
      toast(t('msg.deleted'), 'success');
    } else {
      return;
    }
    invalidateApi(['/api/admin/records', '/api/public/assessments']);
    await recordsView.reload();
  } catch (error) {
    showMessage('contentMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

const recordForm = document.getElementById('recordForm');
document.getElementById('recordDueDate').value = suggestDueDate();

recordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('recordSubmit');
  const data = new FormData(recordForm);
  const selected = [...document.getElementById('recordGroups').selectedOptions].map((option) => option.value);

  if (!selected.length) return showMessage('recordMessage', t('msg.groupRequired'), 'error');

  setBusy(button, true, t('msg.saving'));
  showMessage('recordMessage', '');
  try {
    await api.post('/api/admin/records', {
      groups: selected,
      title: String(data.get('title') || '').trim(),
      kind: String(data.get('kind') || '').trim(),
      dueDate: String(data.get('dueDate') || ''),
      summary: String(data.get('summary') || '').trim(),
      body: String(data.get('body') || '').trim(),
      published: data.get('published') === 'on',
    });
    recordForm.reset();
    document.getElementById('recordDueDate').value = suggestDueDate();
    toast(t('msg.saved'), 'success');
    invalidateApi(['/api/admin/records', '/api/public/assessments']);
    await recordsView.reload();
  } catch (error) {
    showMessage('recordMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

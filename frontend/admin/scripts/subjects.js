/**
 * /admin/subjects/ - the subject catalogue.
 *
 * Subjects are the second half of a document's storage path, so their reference
 * (slug) is fixed at creation. The edit dialog therefore shows the reference as a
 * read-only fact rather than an input that would suggest it can change.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { escapeHtml, showMessage, setBusy, toast, confirmDialog } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';
import { permissions } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'subjects' });
if (!session) throw new Error('redirecting');

const canManage = permissions().capabilities?.includes('subjectsManage');

const view = createView('#subjectRows', {
  load: () => api.get('/api/admin/subjects'),
  isEmpty: (data) => !(data?.subjects || []).length,
  empty: { icon: 'book-open', titleKey: 'admin.noSubjects', bodyKey: 'admin.noSubjectsBody' },
  render: (data) => `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('admin.subjectList'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.nameEn'))}</th>
            <th scope="col">${escapeHtml(t('field.nameAr'))}</th>
            <th scope="col">${escapeHtml(t('field.code'))}</th>
            <th scope="col">${escapeHtml(t('field.reference'))}</th>
            <th scope="col">${escapeHtml(t('field.files'))}</th>
            <th scope="col">${escapeHtml(t('field.status'))}</th>
            ${canManage ? `<th scope="col">${escapeHtml(t('field.actions'))}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${data.subjects
            .map(
              (subject) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('field.nameEn'))}">
              <span class="table__primary">${escapeHtml(subject.nameEn)}</span>
              ${subject.description ? `<small class="table__sub">${escapeHtml(subject.description)}</small>` : ''}
            </th>
            <td data-label="${escapeHtml(t('field.nameAr'))}" dir="auto">${escapeHtml(subject.nameAr || '-')}</td>
            <td data-label="${escapeHtml(t('field.code'))}" dir="ltr">${escapeHtml(subject.code || '-')}</td>
            <td data-label="${escapeHtml(t('field.reference'))}" dir="ltr"><code>${escapeHtml(subject.slug)}</code></td>
            <td data-label="${escapeHtml(t('field.files'))}" class="numeric">${escapeHtml(String(subject.documentCount ?? 0))}</td>
            <td data-label="${escapeHtml(t('field.status'))}">
              <span class="badge ${subject.active === false ? 'badge--outline' : 'badge--success'}">${
                escapeHtml(subject.active === false ? t('state.inactive') : t('state.active'))
              }</span>
            </td>
            ${
              canManage
                ? `<td data-label="${escapeHtml(t('field.actions'))}">
                    <div class="table__actions">
                      <button class="btn btn--secondary btn--sm" type="button" data-edit="${escapeHtml(subject.id)}">
                        ${escapeHtml(t('action.rename'))}</button>
                      <button class="btn btn--danger btn--sm" type="button" data-delete-subject="${escapeHtml(subject.id)}"
                              data-name="${escapeHtml(subject.nameEn)}">${escapeHtml(t('action.delete'))}</button>
                    </div>
                  </td>`
                : ''
            }
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`,
}).reload();

document.getElementById('subjectRows').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.deleteSubject) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/subjects/${encodeURIComponent(button.dataset.deleteSubject)}`);
      toast(t('msg.deleted'), 'success');
      invalidateApi(['/api/admin/subjects', '/api/admin/documents']);
      await view.reload();
    }
  } catch (error) {
    showMessage('subjectMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

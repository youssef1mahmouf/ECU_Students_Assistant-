/**
 * /user/documents/ - files an administrator uploaded for the caller's group.
 *
 * ONE data source: GET /api/documents, which the server already scopes to the
 * caller's group and to published rows only. The shared material index is a
 * different data set with a different page (/user/library/), so this screen can
 * no longer show two competing lists of "resources".
 *
 * The old version of this file tried to render into #userDocumentList and read
 * from #userSubjectFilter, neither of which existed in the page markup, while
 * #userSubjectCards and #userPackageList sat in the HTML painted by nothing.
 * Every id below now exists in the markup above and is filled by exactly one
 * renderer.
 */
import { bootChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { escapeHtml, svg, formatBytes, formatDate } from '/shared/ui.js';
import { t, language } from '/shared/i18n.js';
import { requireSignIn } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';
import { documentViewerHref } from '/shared/data/library.js';

await bootChrome({ area: 'user', active: 'documents' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

const subjectSelect = document.getElementById('documentSubject');
const searchInput = document.getElementById('documentSearch');
const toolbar = document.getElementById('documentsToolbar');
const counter = document.getElementById('documentCount');

const subjectLabel = (subject) =>
  (language() === 'en' ? subject.nameEn || subject.nameAr : subject.nameAr || subject.nameEn) || subject.slug;

let allDocuments = [];

function visibleRows() {
  const subject = subjectSelect?.value || '';
  const needle = (searchInput?.value || '').trim().toLowerCase();
  return allDocuments.filter((row) => {
    if (subject && row.subject !== subject) return false;
    if (!needle) return true;
    return String(row.displayName || '').toLowerCase().includes(needle);
  });
}

function renderTable(rows) {
  const subjects = allDocuments
    .map((row) => row.subject)
    .filter((slug, index, all) => slug && all.indexOf(slug) === index)
    .map((slug) => ({ slug, label: slug }));

  if (subjectSelect) {
    const current = subjectSelect.value;
    subjectSelect.innerHTML =
      `<option value="">${escapeHtml(t('documents.filterSubject'))}</option>` +
      subjects.map((row) => `<option value="${escapeHtml(row.slug)}">${escapeHtml(row.label)}</option>`).join('');
    subjectSelect.value = subjects.some((row) => row.slug === current) ? current : '';
    toolbar.hidden = allDocuments.length === 0;
  }
  if (counter) counter.textContent = String(rows.length);

  if (!rows.length) {
    return `<div class="state" role="status">
        <span class="state__icon">${svg('file-text')}</span>
        <p class="state__title">${escapeHtml(t('documents.emptyTitle'))}</p>
        <p class="state__body">${escapeHtml(t('documents.emptyBody'))}</p>
        <div class="state__actions">
          <a class="btn btn--secondary" href="/user/library/">${svg('library')}
            <span>${escapeHtml(t('documents.openLibrary'))}</span></a>
        </div>
      </div>`;
  }

  return `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('documents.title'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.fileName'))}</th>
            <th scope="col">${escapeHtml(t('field.subject'))}</th>
            <th scope="col">${escapeHtml(t('documents.size'))}</th>
            <th scope="col">${escapeHtml(t('documents.published'))}</th>
            <th scope="col">${escapeHtml(t('documents.uploadedBy'))}</th>
            <th scope="col">${escapeHtml(t('field.actions'))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('field.fileName'))}">
              <span class="table__primary" dir="auto">${escapeHtml(row.displayName)}</span>
              ${row.folderPath ? `<small class="table__sub" dir="ltr">${escapeHtml(row.folderPath)}</small>` : ''}
            </th>
            <td data-label="${escapeHtml(t('field.subject'))}">${escapeHtml(row.subjectName || row.subject || '-')}</td>
            <td data-label="${escapeHtml(t('documents.size'))}" dir="ltr">${escapeHtml(formatBytes(row.size))}</td>
            <td data-label="${escapeHtml(t('documents.published'))}">
              <span class="badge ${row.published ? 'badge--success' : 'badge--outline'}">${
                escapeHtml(row.published ? t('documents.published') : t('documents.draft'))
              }</span>
            </td>
            <td data-label="${escapeHtml(t('documents.uploadedBy'))}">${escapeHtml(row.uploaderName || '-')}</td>
            <td data-label="${escapeHtml(t('field.actions'))}">
              <div class="table__actions">
                <a class="btn btn--secondary btn--sm" href="${documentViewerHref(row.id)}">${svg('eye')}
                  <span>${escapeHtml(t('action.openInViewer'))}</span></a>
                <a class="btn btn--ghost btn--sm" href="${escapeHtml(row.url)}" download>${svg('download')}
                  <span>${escapeHtml(t('action.download'))}</span></a>
              </div>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

const view = createView('#userDocuments', {
  load: () => api.get('/api/documents'),
  render: (data) => {
    allDocuments = data.documents || [];
    if (data.group) {
      document.getElementById('documentsLead').textContent =
        `${t('documents.subtitle')} (${data.group})`;
    }
    return renderTable(visibleRows());
  },
  isEmpty: (data) => !(data?.documents || []).length,
  empty: () => ({
    icon: 'file-text',
    titleKey: 'documents.emptyTitle',
    bodyKey: 'documents.emptyBody',
    actions: `<a class="btn btn--secondary" href="/user/library/">${svg('library')}
        <span>${escapeHtml(t('documents.openLibrary'))}</span></a>`,
  }),
});

subjectSelect?.addEventListener('change', () => view.refresh());
searchInput?.addEventListener('input', () => view.refresh());

view.reload();

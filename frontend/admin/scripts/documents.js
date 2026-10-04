/**
 * /admin/documents/ - upload and manage the files uploaded for a group.
 *
 * The upload target is a real <label> over a real file input (see the markup), so
 * it works with a click, with Enter and with drag-and-drop. Every chosen file is
 * sent individually because the server decides the destination folder from each
 * file's content type; the response lists exactly where each one landed, so a
 * multi-file upload is never a silent success.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { escapeHtml, formatBytes, formatDate, showMessage, setBusy, toast, confirmDialog } from '/shared/ui.js';
import { t, serverText, language } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';
import { documentViewerHref } from '/shared/data/library.js';

const session = await bootAdmin({ active: 'documents' });
if (!session) throw new Error('redirecting');

let documents = [];
let subjects = [];

const groupSelect = document.getElementById('documentGroup');
const subjectFilter = document.getElementById('documentSubject');

const subjectLabel = (subject) =>
  (language() === 'en' ? subject.nameEn || subject.nameAr : subject.nameAr || subject.nameEn) || subject.slug;

/** base64 in chunks: a large video blows the call stack if converted in one go. */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('msg.readFailed')));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

function visible() {
  const group = groupSelect?.value || '';
  const subject = subjectFilter?.value || '';
  return documents.filter((row) => {
    if (group && !(row.groups || [row.group]).includes(group)) return false;
    if (subject && row.subject !== subject) return false;
    return true;
  });
}

function paint() {
  const rows = visible();
  const counter = document.getElementById('documentCount');
  if (counter) counter.textContent = String(rows.length);

  if (!rows.length) {
    host.innerHTML = `<div class="state" role="status">
        <p class="state__title">${escapeHtml(t('msg.empty'))}</p>
        <p class="state__body">${escapeHtml(t('admin.noDocumentsBody'))}</p>
      </div>`;
    return;
  }

  host.innerHTML = `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('admin.documentList'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.fileName'))}</th>
            <th scope="col">${escapeHtml(t('field.group'))}</th>
            <th scope="col">${escapeHtml(t('field.subject'))}</th>
            <th scope="col">${escapeHtml(t('field.folder'))}</th>
            <th scope="col">${escapeHtml(t('documents.size'))}</th>
            <th scope="col">${escapeHtml(t('field.status'))}</th>
            <th scope="col">${escapeHtml(t('field.actions'))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('field.fileName'))}">
              <span class="table__primary" dir="auto">${escapeHtml(row.displayName)}</span>
              <small class="table__sub" dir="ltr">${escapeHtml(row.mimeType)}</small>
            </th>
            <td data-label="${escapeHtml(t('field.group'))}" dir="auto">${
              escapeHtml((row.groups || [row.group]).filter(Boolean).join(', ') || '-')
            }</td>
            <td data-label="${escapeHtml(t('field.subject'))}">${escapeHtml(row.subjectName || row.subject || '-')}</td>
            <td data-label="${escapeHtml(t('field.folder'))}"><code class="truncate" dir="ltr">${
              escapeHtml(row.folderPath || '-')
            }</code></td>
            <td data-label="${escapeHtml(t('documents.size'))}" dir="ltr">${escapeHtml(formatBytes(row.size))}</td>
            <td data-label="${escapeHtml(t('field.status'))}">
              <span class="badge ${row.published ? 'badge--success' : 'badge--outline'}">${
                escapeHtml(row.published ? t('documents.published') : t('documents.draft'))
              }</span>
            </td>
            <td data-label="${escapeHtml(t('field.actions'))}">
              <div class="table__actions">
                <a class="btn btn--secondary btn--sm" href="${documentViewerHref(row.id)}">${escapeHtml(
                  t('action.openInViewer')
                )}</a>
                <button class="btn btn--secondary btn--sm" type="button" data-publish="${escapeHtml(row.id)}"
                        data-next="${row.published ? 'false' : 'true'}">
                  ${escapeHtml(row.published ? t('action.unpublish') : t('action.publish'))}</button>
                <button class="btn btn--danger btn--sm" type="button" data-delete-document="${escapeHtml(row.id)}"
                        data-name="${escapeHtml(row.displayName)}">${escapeHtml(t('action.delete'))}</button>
              </div>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

const view = createView('#documentRows', {
  load: () => api.get('/api/admin/documents'),
  render: (data) => {
    documents = data.documents || [];
    subjects = data.subjects || [];

    const groupOptions = [...new Set(documents.flatMap((row) => row.groups || [row.group]).filter(Boolean))];
    const currentGroup = groupSelect?.value;
    if (groupSelect) {
      groupSelect.innerHTML =
        `<option value="">${escapeHtml(t('filter.all'))}</option>` +
        groupOptions.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      groupSelect.value = groupOptions.includes(currentGroup) ? currentGroup : '';
    }
    const currentSubject = subjectFilter?.value;
    if (subjectFilter) {
      subjectFilter.innerHTML =
        `<option value="">${escapeHtml(t('documents.filterSubject'))}</option>` +
        subjects
          .map((subject) => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subjectLabel(subject))}</option>`)
          .join('');
      subjectFilter.value = subjects.some((subject) => subject.slug === currentSubject) ? currentSubject : '';
    }

    const uploadGroup = document.getElementById('uploadGroup');
    if (uploadGroup) {
      const chosen = [...uploadGroup.selectedOptions].map((option) => option.value);
      uploadGroup.innerHTML = groupOptions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join('');
      for (const option of uploadGroup.options) option.selected = chosen.includes(option.value);
    }
    const uploadSubject = document.getElementById('uploadSubject');
    if (uploadSubject) {
      uploadSubject.innerHTML = subjects
        .map((subject) => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subjectLabel(subject))}</option>`)
        .join('');
    }

    return paint();
  },
  isEmpty: (data) => !(data?.documents || []).length,
  empty: () => ({ icon: 'file-text', titleKey: 'msg.empty', bodyKey: 'admin.noDocumentsBody' }),
}).reload();

groupSelect?.addEventListener('change', paint);
subjectFilter?.addEventListener('change', paint);

/* ------------------------------------------------------------- the dropzone */

const dropzone = document.getElementById('uploadDropzone');
const fileInput = document.getElementById('uploadFiles');
const fileList = document.getElementById('uploadFileList');

function paintChosenFiles() {
  const files = [...(fileInput?.files || [])];
  if (!fileList) return;
  fileList.innerHTML = files
    .map((file) => `<li dir="auto">${escapeHtml(file.name)} &middot; ${escapeHtml(formatBytes(file.size))}</li>`)
    .join('');
}

fileInput?.addEventListener('change', paintChosenFiles);

if (dropzone) {
  for (const type of ['dragenter', 'dragover']) {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    dropzone.addEventListener(type, () => dropzone.classList.remove('is-dragging'));
  }
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    if (!fileInput) return;
    /* DataTransfer is how a drop reaches a real input; nothing is read here. */
    fileInput.files = event.dataTransfer?.files || null;
    paintChosenFiles();
  });
}

/* ----------------------------------------------------------------- upload */

const uploadForm = document.getElementById('uploadForm');

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const chosen = [...(fileInput?.files || [])];
  const button = document.getElementById('uploadSubmit');

  if (!chosen.length) return showMessage('uploadMessage', t('msg.pickFileFirst'), 'error');

  const data = new FormData(uploadForm);
  const selectedGroups = [...document.getElementById('uploadGroup').selectedOptions].map((option) => option.value);
  if (!selectedGroups.length) return showMessage('uploadMessage', t('msg.groupRequired'), 'error');

  const folder = {
    weekNumber: String(data.get('weekNumber') || '1'),
    sessionKind: String(data.get('sessionKind') || 'lecture'),
    lectureNumber: String(data.get('lectureNumber') || '1'),
  };

  setBusy(button, true, t('msg.uploading'));
  const saved = [];
  let replaced = 0;
  try {
    for (const file of chosen) {
      const result = await api.post('/api/admin/documents', {
        groups: selectedGroups,
        subject: String(data.get('subject') || ''),
        displayName: String(data.get('displayName') || '').trim() || file.name,
        published: data.get('published') === 'on',
        ...folder,
        fileName: file.name,
        fileBase64: await toBase64(file),
      });
      if (result?.replaced) replaced += 1;
      saved.push(result?.document?.folderPath || '?');
    }

    uploadForm.reset();
    paintChosenFiles();
    showMessage('uploadMessage',
      `${t('msg.documentsSaved')} (${saved.length})` + (replaced ? ` - ${replaced} ${t('msg.replacedSlot')}` : ''),
      'success');
    document.getElementById('uploadSaved').innerHTML =
      `<ul class="rows card card--flush">${saved
        .map((path) => `<li class="row"><span class="row__main"><code dir="ltr">${escapeHtml(path)}</code></span></li>`)
        .join('')}</ul>`;

    /* The student's document list is scoped to their group; drop it so the next
       read is the fresh one, with no manual refresh anywhere. */
    invalidateApi(['/api/documents', '/api/admin/documents', '/api/admin/subjects']);
    await view.reload();
  } catch (error) {
    showMessage('uploadMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

/* -------------------------------------------------------------- mutations */

document.getElementById('documentRows').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.publish) {
      await api.patch(`/api/admin/documents/${encodeURIComponent(button.dataset.publish)}`, {
        published: button.dataset.next === 'true',
      });
      toast(t('msg.saved'), 'success');
    } else if (button.dataset.deleteDocument) {
      if (!confirmDialog(t('msg.confirmDelete', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/documents/${encodeURIComponent(button.dataset.deleteDocument)}`);
      toast(t('msg.deleted'), 'success');
    } else {
      return;
    }
    invalidateApi(['/api/documents', '/api/admin/documents']);
    await view.reload();
  } catch (error) {
    showMessage('documentMessage', serverText(error.message, { status: error.status }), 'error');
  }
});

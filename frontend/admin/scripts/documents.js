import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, mount, showMessage, setBusy, toast } from '/shared/ui.js';
import { t, language, serverText } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'documents' });

let groups = [];
let subjects = [];
let documents = [];

const byId = (id) => document.getElementById(id);

/** Every group a document belongs to (legacy single value included). */
function documentGroupNames(document) {
  const names = Array.isArray(document.groups) && document.groups.length ? document.groups : [document.group].filter(Boolean);
  return names.join(', ') || '-';
}
const subjectLabel = (subject) =>
  (language() === 'en' ? subject.nameEn || subject.nameAr : subject.nameAr || subject.nameEn) || subject.slug;

function formatBytes(size) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fillSelect(select, options, allLabel) {
  if (!select) return;
  select.innerHTML = `${allLabel ? `<option value="">${escapeHtml(allLabel)}</option>` : ''}${options
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('')}`;
}

function renderDocuments() {
  mount(
    '#documentRows',
    documents.length
      ? documents
          .map(
            (document) => `<tr>
          <th scope="row"><span>${escapeHtml(document.displayName)}</span>
            <small class="row-sub" dir="ltr">${escapeHtml(document.mimeType)}</small></th>
          <td><span dir="auto">${escapeHtml(documentGroupNames(document))}</span></td>
          <td>${escapeHtml(document.subjectName || document.subject)}</td>
          <td><code class="folder-path" dir="ltr">${escapeHtml(document.folderPath || '-')}</code></td>
          <td><span dir="ltr">${escapeHtml(formatBytes(document.size))}</span></td>
          <td>${
            document.published
              ? `<span class="badge ok">${escapeHtml(t('state.published'))}</span>`
              : `<span class="badge muted">${escapeHtml(t('state.draft'))}</span>`
          }</td>
          <td>${escapeHtml(document.uploaderName || '-')}</td>
          <td><div class="row-actions">
            <a class="btn secondary small" href="${escapeHtml(document.url)}">${escapeHtml(t('action.download'))}</a>
            <button class="btn small" type="button" data-publish="${escapeHtml(document.id)}" data-next="${document.published ? 'false' : 'true'}">
              ${document.published ? escapeHtml(t('action.unpublish')) : escapeHtml(t('action.publish'))}
            </button>
            <button class="btn danger small" type="button" data-delete-document="${escapeHtml(document.id)}" data-name="${escapeHtml(document.displayName)}">
              ${escapeHtml(t('action.delete'))}
            </button>
          </div></td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="7" class="empty">${escapeHtml(t('msg.empty'))}</td></tr>`
  );
}

async function loadReferences() {
  const [groupData, documentData] = await Promise.all([
    api.getQuiet('/api/admin/groups'),
    api.getQuiet('/api/admin/documents'),
  ]);
  groups = (groupData?.groups || []).map((group) => group.name);
  subjects = documentData?.subjects || [];

  const groupOptions = groups.map((name) => ({ value: name, label: name }));
  const subjectOptions = subjects.map((subject) => ({ value: subject.slug, label: subjectLabel(subject) }));
  fillSelect(byId('documentGroup'), groupOptions, t('msg.allGroups'));
  fillSelect(byId('documentSubject'), subjectOptions, t('msg.allGroups'));
  fillSelect(byId('uploadGroup'), groupOptions, '');
  fillSelect(byId('uploadSubject'), subjectOptions, '');
}

async function loadDocuments() {
  const params = new URLSearchParams();
  if (byId('documentGroup')?.value) params.set('group', byId('documentGroup').value);
  if (byId('documentSubject')?.value) params.set('subject', byId('documentSubject').value);
  const query = params.toString() ? `?${params}` : '';
  const data = await api.getQuiet(`/api/admin/documents${query}`);
  documents = data?.documents || [];
  renderDocuments();
}

/** Read a File into base64; the bytes never appear in a URL, a log line or a stored path. */
async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

if (session) {
  await loadReferences();
  await loadDocuments();

  byId('documentRefresh')?.addEventListener('click', () => loadDocuments());
  byId('documentGroup')?.addEventListener('change', () => loadDocuments());
  byId('documentSubject')?.addEventListener('change', () => loadDocuments());

  const form = byId('uploadForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    /* The input is #uploadFiles (plural): every chosen file is sent, and the server decides
       which folder each one lands in from its content type. */
    const chosen = [...(byId('uploadFiles')?.files || [])];
    const button = byId('uploadSubmit');
    if (!chosen.length) {
      showMessage('uploadMessage', t('msg.pickFileFirst'), 'error');
      return;
    }
    setBusy(button, true, t('msg.uploading'));
    try {
      const data = new FormData(form);
      const selectedGroups = [...byId('uploadGroup').selectedOptions].map((option) => option.value);
      if (!selectedGroups.length) {
        showMessage('uploadMessage', t('msg.groupRequired'), 'error');
        setBusy(button, false);
        return;
      }
      /* The folder is decided here once and sent with every file, so a PDF, a Word file, a
         video and a recording all land under the same session folder with their own names. */
      const session = {
        weekNumber: String(data.get('weekNumber') || '1'),
        sessionKind: String(data.get('sessionKind') || 'lecture'),
        lectureNumber: String(data.get('lectureNumber') || '1'),
      };
      let replaced = 0;
      const saved = [];
      for (const file of chosen) {
        const result = await api.post('/api/admin/documents', {
          groups: selectedGroups,
          subject: String(data.get('subject') || ''),
          displayName: String(data.get('title') || '').trim(),
          published: data.get('published') === 'on',
          ...session,
          fileName: file.name,
          fileBase64: await toBase64(file),
        });
        if (result?.replaced) replaced += 1;
        saved.push(result?.document?.folderPath || '?');
      }
      form.reset();
      /* Stay on this page and say exactly what was written and where - one line per file,
         so a multi-file upload is never a silent success. */
      showMessage('uploadMessage',
        `${t('msg.documentsSaved')} (${saved.length})` +
        (replaced ? ` - ${replaced} ${t('msg.replacedSlot')}` : ''),
        'success');
      mount('#uploadSaved',
        `<ul class="saved-list">${saved.map((p) => `<li><code dir="ltr">${escapeHtml(p)}</code></li>`).join('')}</ul>`);
      await loadDocuments();
    } catch (error) {
      showMessage('uploadMessage', serverText(error.message, { status: error.status }), 'error');
    } finally {
      setBusy(button, false);
    }
  });

  document.getElementById('documentRows').addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.dataset.publish) {
        await api.patch(`/api/admin/documents/${encodeURIComponent(button.dataset.publish)}`, {
          published: button.dataset.next === 'true',
        });
        toast(t('msg.documentUpdated'), 'success');
        await loadDocuments();
        return;
      }
      if (button.dataset.deleteDocument) {
        if (!window.confirm(t('msg.confirmDelete', { name: button.dataset.name }))) return;
        await api.del(`/api/admin/documents/${encodeURIComponent(button.dataset.deleteDocument)}`);
        toast(t('msg.documentDeleted'), 'success');
        await loadDocuments();
      }
    } catch (error) {
      showMessage('documentMessage', serverText(error.message, { status: error.status }), 'error');
    }
  });
}


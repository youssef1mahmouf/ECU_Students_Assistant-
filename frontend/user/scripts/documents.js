import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount, showMessage } from '/shared/ui.js';
import { requireSignIn } from '/shared/session.js';
import { t, language, serverText } from '/shared/i18n.js';
import { renderMaterialLibrary } from '/shared/material-library.js';

await bootChrome({ area: 'user', active: 'documents' });
const session = await requireSignIn({ redirectTo: '/user/signin/' });

let subjects = [];
let documents = [];

function formatBytes(size) {
  const bytes = Number(size || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const subjectLabel = (subject) =>
  (language() === 'en' ? subject.nameEn || subject.nameAr : subject.nameAr || subject.nameEn) || subject.slug;

function render() {
  const filter = document.getElementById('userSubjectFilter')?.value || '';
  const rows = filter ? documents.filter((document) => document.subject === filter) : documents;
  mount(
    '#userDocumentList',
    rows.length
      ? rows
          .map(
            (document) => `<li>
            <strong>${escapeHtml(document.displayName)}</strong>
            <small>${escapeHtml(subjectLabel(subjects.find((subject) => subject.slug === document.subject) || { slug: document.subject, nameEn: document.subject, nameAr: document.subject }))} · <span dir="ltr">${escapeHtml(formatBytes(document.size))}</span> · ${escapeHtml(formatDate(document.createdAt) || '')}</small>
            <a class="btn secondary small" href="${escapeHtml(document.url)}">${escapeHtml(t('action.download'))}</a>
          </li>`
          )
          .join('')
      : `<li>${escapeHtml(t('user.documentsEmpty'))}</li>`
  );
}

async function loadDocuments() {
  const data = await api.getQuiet('/api/documents');
  if (!data) {
    showMessage('userDocumentMessage', t('msg.network'), 'error');
    return;
  }
  documents = data.documents || [];
  subjects = data.subjects || [];
  const select = document.getElementById('userSubjectFilter');
  if (select) {
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(t('msg.allGroups'))}</option>${subjects
      .map((subject) => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subjectLabel(subject))}</option>`)
      .join('')}`;
    select.value = subjects.some((subject) => subject.slug === current) ? current : '';
  }
  const lead = document.getElementById('userDocumentsLead');
  if (lead && data.group) lead.textContent = `${t('user.documentsNote')} (${data.group})`;
  render();
}

if (session) {
  await loadDocuments();
  document.getElementById('userSubjectFilter')?.addEventListener('change', () => render());
}

/* The shared library index is public information (folder, file and size names only), so it
   renders for signed-in students as well as guests. */
await renderMaterialLibrary('userLibrary');

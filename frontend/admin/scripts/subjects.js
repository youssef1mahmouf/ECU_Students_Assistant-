import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, mount, showMessage, toast, setLoading } from '/shared/ui.js';
import { t, language, serverText, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'subjects' });
let subjects = [];

/** Subjects carry both names; the page shows the one matching the active language. */
function subjectLabel(subject) {
  return language() === 'en' ? subject.nameEn || subject.nameAr : subject.nameAr || subject.nameEn;
}

function render() {
  mount(
    '#subjectRows',
    subjects.length
      ? subjects
          .map(
            (subject) => `<tr>
          <th scope="row"><span dir="ltr">${escapeHtml(subject.slug)}</span></th>
          <td>${escapeHtml(subject.code || '-')}</td>
          <td><span dir="ltr">${escapeHtml(subject.nameEn)}</span></td>
          <td>${escapeHtml(subject.nameAr)}</td>
          <td>${Number(subject.documentCount || 0)}</td>
          <td>${
            subject.active === false
              ? `<span class="badge muted">${escapeHtml(t('state.archived'))}</span>`
              : `<span class="badge ok">${escapeHtml(t('state.active'))}</span>`
          }</td>
          <td><div class="row-actions">
            <button class="btn secondary small" type="button" data-edit-subject="${escapeHtml(subject.id)}">
              ${escapeHtml(t('action.edit'))}
            </button>
            <button class="btn secondary small" type="button" data-toggle-active="${escapeHtml(subject.id)}" data-next="${subject.active === false ? 'true' : 'false'}">
              ${subject.active === false ? escapeHtml(t('action.restore')) : escapeHtml(t('action.archive'))}
            </button>
            <button class="btn danger small" type="button" data-delete-subject="${escapeHtml(subject.id)}" data-name="${escapeHtml(subjectLabel(subject))}" data-count="${Number(subject.documentCount || 0)}">
              ${escapeHtml(t('action.delete'))}
            </button>
          </div></td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="7" class="empty">${escapeHtml(t('msg.empty'))}</td></tr>`
  );
}

async function loadSubjects() {
  const data = await api.getQuiet('/api/admin/subjects');
  subjects = data?.subjects || [];
  render();
}

let editingId = '';
const byId = (sid) => document.getElementById(sid);

function openEditDialog(subject) {
  editingId = subject.id;
  byId('editSubjectCode').value = subject.code || '';
  byId('editSubjectReference').value = subject.slug || '';
  byId('editSubjectNameEn').value = subject.nameEn || '';
  byId('editSubjectNameAr').value = subject.nameAr || '';
  byId('editSubjectDescription').value = subject.description || '';
  byId('editSubjectActive').checked = subject.active !== false;
  showMessage('subjectEditMessage', '');
  byId('subjectDialog').showModal();
}

byId('subjectEditCancel')?.addEventListener('click', () => byId('subjectDialog').close());

byId('subjectEditForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingId) return;
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api.patch(`/api/admin/subjects/${encodeURIComponent(editingId)}`, {
      code: String(data.code || '').trim(),
      nameEn: String(data.nameEn || '').trim(),
      nameAr: String(data.nameAr || '').trim(),
      description: String(data.description || '').trim(),
      active: data.active === 'on',
    });
    byId('subjectDialog').close();
    toast(t('msg.updated'), 'success');
    await loadSubjects();
  } catch (error) {
    showMessage('subjectEditMessage', serverText(error.message), 'error');
  }
});

if (session) {
  await loadSubjects();
  onLanguageChange(() => render());

  const form = document.getElementById('subjectForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post('/api/admin/subjects', {
        slug: String(data.slug || '').trim(),
        code: String(data.code || '').trim(),
        nameEn: String(data.nameEn || '').trim(),
      });
      form.reset();
      showMessage('subjectFormMessage', t('msg.subjectCreated'), 'success');
      await loadSubjects();
    } catch (error) {
      showMessage('subjectFormMessage', error.message, 'error');
    }
  });

  document.getElementById('subjectRows').addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.dataset.toggleActive) {
        await api.patch(`/api/admin/subjects/${encodeURIComponent(button.dataset.toggleActive)}`, {
          active: button.dataset.next === 'true',
        });
        toast(t('msg.updated'), 'success');
        await loadSubjects();
        return;
      }
      if (button.dataset.editSubject) {
        const subject = subjects.find((item) => item.id === button.dataset.editSubject);
        if (subject) openEditDialog(subject);
        return;
      }
      if (button.dataset.deleteSubject) {
        if (Number(button.dataset.count) > 0) {
          showMessage('subjectMessage', t('server.subjectNotEmpty'), 'error');
          return;
        }
        if (!window.confirm(`${t('action.delete')}: ${button.dataset.name}?`)) return;
        await api.del(`/api/admin/subjects/${encodeURIComponent(button.dataset.deleteSubject)}`);
        toast(t('msg.updated'), 'success');
        await loadSubjects();
      }
    } catch (error) {
      showMessage('subjectMessage', error.message, 'error');
    }
  });
}

import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount, showMessage, toast } from '/shared/ui.js';
import { t, kindLabel, serverText, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'groups' });

/* The kind choices come from the same list the server validates against
   (lib/validate.js CONTENT_KINDS); free-text kinds are refused server-side. */
const CONTENT_KINDS = ['Assignment', 'Exam', 'Quiz', 'Project', 'Note', 'Lecture'];

let groups = [];
let subjects = [];
let editingId = '';

const el = (id) => document.getElementById(id);

/** Due date default: one week from today (computed, never hardcoded); admins can change it. */
function defaultDueDate() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function subjectLabel(subject) {
  return document.documentElement.lang === 'en'
    ? subject.nameEn || subject.nameAr
    : subject.nameAr || subject.nameEn;
}

function groupCard(group) {
  const labels = Array.isArray(group.subjectLabels) ? group.subjectLabels : [];
  const subjectChips = labels.length
    ? labels.map((item) => `<span class="chip">${escapeHtml(subjectLabel(item))}</span>`).join(' ')
    : `<span class="subtext">${escapeHtml(t('admin.noSubjects'))}</span>`;
  return `<article class="group-card">
    <h3 dir="auto">${escapeHtml(group.name)}</h3>
    <p>${escapeHtml(group.description || '-')}</p>
    ${group.notes ? `<p class="notes"><b>${escapeHtml(t('field.notes'))}:</b> ${escapeHtml(group.notes)}</p>` : ''}
    <div>${subjectChips}</div>
    <div class="card-meta">
      <span>${escapeHtml(t('admin.membersCount', { count: Number(group.memberCount || 0) }))}</span>
      <span>·</span>
      <span>${escapeHtml(t('admin.recordsCount', { count: Number(group.recordCount || 0) }))}</span>
    </div>
    <div class="card-actions">
      <button class="btn secondary small" type="button" data-edit="${escapeHtml(group.id)}">${escapeHtml(t('action.edit'))}</button>
      <button class="btn danger small" type="button" data-delete-group="${escapeHtml(group.id)}" data-name="${escapeHtml(group.name)}">${escapeHtml(t('action.delete'))}</button>
    </div>
  </article>`;
}

async function loadGroups() {
  const data = await api.getQuiet('/api/admin/groups');
  groups = data?.groups || [];
  subjects = data?.subjects || [];

  mount('#groupRows', groups.length ? groups.map(groupCard).join('') : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`);

  const groupOptions = groups
    .map((group) => `<option value="${escapeHtml(group.name)}">${escapeHtml(group.name)}</option>`)
    .join('');
  // Content filter stays single-select; the New Content selector is the multi-select.
  el('contentGroup').innerHTML = `<option value="">${escapeHtml(t('msg.allGroups'))}</option>${groupOptions}`;
  const recordGroups = el('recordGroup');
  const selected = [...recordGroups.selectedOptions].map((option) => option.value);
  recordGroups.innerHTML = groupOptions || `<option value="">${escapeHtml(t('msg.noGroupsYet'))}</option>`;
  for (const option of recordGroups.options) option.selected = selected.includes(option.value);

  const subjectSelect = el('editGroupSubjects');
  subjectSelect.innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subjectLabel(subject))}</option>`)
    .join('');
  return groups;
}

function recordGroupNames(record) {
  const names = Array.isArray(record.groups) && record.groups.length ? record.groups : [record.group].filter(Boolean);
  return names.join(', ');
}

async function loadRecords(groupName) {
  const query = groupName ? `?group=${encodeURIComponent(groupName)}` : '';
  const data = await api.getQuiet(`/api/admin/records${query}`);
  const records = data?.records || [];
  mount(
    '#contentRows',
    records.length
      ? records
          .map(
            (record) => `<tr>
          <th scope="row"><span>${escapeHtml(record.title)}</span>
            <small class="row-sub">${escapeHtml(record.summary || '')}</small></th>
          <td><span dir="auto">${escapeHtml(recordGroupNames(record) || '-')}</span></td>
          <td>${escapeHtml(kindLabel(record.kind) || '-')}</td>
          <td>${escapeHtml(formatDate(record.dueDate) || '-')}</td>
          <td>${
            record.published
              ? `<span class="badge ok">${escapeHtml(t('state.published'))}</span>`
              : `<span class="badge muted">${escapeHtml(t('state.draft'))}</span>`
          }</td>
          <td><div class="row-actions">
            <button class="btn secondary small" type="button" data-publish="${escapeHtml(record.id)}" data-next="${record.published ? 'false' : 'true'}">
              ${record.published ? escapeHtml(t('action.unpublish')) : escapeHtml(t('action.publish'))}
            </button>
            <button class="btn danger small" type="button" data-delete-record="${escapeHtml(record.id)}" data-name="${escapeHtml(record.title)}">${escapeHtml(t('action.delete'))}</button>
          </div></td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="6" class="empty">${escapeHtml(t('msg.empty'))}</td></tr>`
  );
}


/* ------------------------------------------------------------ create group */
el('groupForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(el('groupForm'));
  try {
    await api.post('/api/admin/groups', {
      name: String(data.get('name') || '').trim(),
      description: String(data.get('description') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
    });
    el('groupForm').reset();
    showMessage('groupFormMessage', t('msg.groupCreated'), 'success');
    await refresh();
  } catch (error) {
    showMessage('groupFormMessage', serverText(error.message), 'error');
  }
});

/* -------------------------------------------------------------- edit group */
function openEditDialog(group) {
  editingId = group.id;
  el('editGroupName').value = group.name || '';
  el('editGroupDescription').value = group.description || '';
  el('editGroupNotes').value = group.notes || '';
  const chosen = new Set(Array.isArray(group.subjects) ? group.subjects : []);
  for (const option of el('editGroupSubjects').options) option.selected = chosen.has(option.value);
  showMessage('groupEditMessage', '');
  el('groupDialog').showModal();
}

el('groupEditCancel')?.addEventListener('click', () => el('groupDialog').close());

el('groupEditForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editingId) return;
  const data = new FormData(el('groupEditForm'));
  const subjectsChosen = [...el('editGroupSubjects').selectedOptions].map((option) => option.value);
  try {
    await api.patch(`/api/admin/groups/${encodeURIComponent(editingId)}`, {
      name: String(data.get('name') || '').trim(),
      description: String(data.get('description') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
      subjects: subjectsChosen,
    });
    el('groupDialog').close();
    toast(t('msg.updated'), 'success');
    await refresh();
  } catch (error) {
    showMessage('groupEditMessage', serverText(error.message), 'error');
  }
});

/* ------------------------------------------------------------ create record */
el('recordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(el('recordForm'));
  const selectedGroups = [...el('recordGroup').selectedOptions].map((option) => option.value);
  if (!selectedGroups.length) {
    showMessage('recordMessage', t('msg.groupRequired'), 'error');
    return;
  }
  try {
    await api.post('/api/admin/records', {
      groups: selectedGroups,
      title: String(data.get('title') || '').trim(),
      kind: String(data.get('kind') || ''),
      dueDate: String(data.get('dueDate') || ''),
      summary: String(data.get('summary') || '').trim(),
      body: String(data.get('body') || '').trim(),
      published: data.get('published') === 'on',
    });
    el('recordForm').reset();
    el('recordDueDate').value = defaultDueDate();
    showMessage('recordMessage', t('msg.saved'), 'success');
    await loadRecords(String(el('contentGroup').value || ''));
  } catch (error) {
    showMessage('recordMessage', serverText(error.message), 'error');
  }
});

el('contentGroup')?.addEventListener('change', (event) => {
  loadRecords(String(event.target.value || ''));
});

/* Row actions: Edit / Delete on cards, publish / delete on records. One notification each. */
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || !session) return;
  const filter = String(el('contentGroup')?.value || '');
  try {
    if (button.dataset.edit) {
      const group = groups.find((item) => item.id === button.dataset.edit);
      if (group) openEditDialog(group);
    } else if (button.dataset.deleteGroup) {
      if (!window.confirm(t('confirm.deleteGroup', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/groups/${encodeURIComponent(button.dataset.deleteGroup)}`);
      toast(t('msg.updated'), 'success');
      await refresh();
    } else if (button.dataset.publish) {
      await api.patch(`/api/admin/records/${encodeURIComponent(button.dataset.publish)}`, {
        published: button.dataset.next === 'true',
      });
      toast(t('msg.saved'), 'success');
      await loadRecords(filter);
    } else if (button.dataset.deleteRecord) {
      if (!window.confirm(t('confirm.deleteContent', { name: button.dataset.name }))) return;
      await api.del(`/api/admin/records/${encodeURIComponent(button.dataset.deleteRecord)}`);
      toast(t('msg.updated'), 'success');
      await loadRecords(filter);
    }
  } catch (error) {
    toast(serverText(error.message, { status: error.status }), 'error');
  }
});

async function refresh() {
  await loadGroups();
  await loadRecords(String(el('contentGroup')?.value || ''));
}

if (session) {
  /* Fill the kind select once: values stay canonical, labels follow the language. */
  el('recordKind').innerHTML = `<option value="">-</option>${CONTENT_KINDS.map(
    (kind) => `<option value="${kind}">${escapeHtml(kindLabel(kind))}</option>`
  ).join('')}`;
  el('recordDueDate').value = defaultDueDate();

  await refresh();
  /* The cards and the tables are built from t(): rebuild them on a language switch. */
  onLanguageChange(() => {
    void refresh();
  });
}
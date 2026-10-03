import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, mount, showMessage, toast, setLoading } from '/shared/ui.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'problems' });

const byId = (id) => document.getElementById(id);
let problems = [];

const CATEGORY_KEYS = {
  bug: 'problems.categoryBug',
  content: 'problems.categoryContent',
  account: 'problems.categoryAccount',
  group: 'problems.categoryGroup',
  other: 'problems.categoryOther',
};

function stamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(document.documentElement.lang || 'ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const categoryLabel = (category) => t(CATEGORY_KEYS[category] || 'problems.categoryOther');

function render() {
  const filter = byId('problemStatusFilter').value;
  const rows = filter ? problems.filter((item) => item.status === filter) : problems;
  mount(
    '#problemRows',
    rows.length
      ? rows
          .map(
            (item) => `<tr>
          <th scope="row"><span>${escapeHtml(item.reporterName || '-')}</span>
            <small class="row-sub" dir="ltr">${escapeHtml(item.reporterEmail || '')}</small></th>
          <td>${escapeHtml(stamp(item.createdAt))}</td>
          <td>${escapeHtml(categoryLabel(item.category))}</td>
          <td>${escapeHtml(item.description || '')}</td>
          <td><span dir="ltr">${escapeHtml(item.page || '-')}</span></td>
          <td>${
            item.status === 'resolved'
              ? `<span class="badge ok">${escapeHtml(t('state.resolved'))}</span>`
              : `<span class="badge warn">${escapeHtml(t('state.open'))}</span>`
          }</td>
          <td><div class="row-actions">
            <button class="btn secondary small" type="button" data-problem="${escapeHtml(item.id)}" data-next="${
              item.status === 'resolved' ? 'open' : 'resolved'
            }">${item.status === 'resolved' ? escapeHtml(t('action.reopen')) : escapeHtml(t('action.resolve'))}</button>
          </div></td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="7" class="empty">${escapeHtml(t('admin.problemsEmpty'))}</td></tr>`
  );
}

async function loadProblems() {
  const data = await api.getQuiet('/api/admin/problems');
  problems = data?.problems || [];
  render();
}

if (session) {
  await loadProblems();

  byId('problemStatusFilter').addEventListener('change', () => render());
  byId('refreshProblems').addEventListener('click', () => void loadProblems());
  byId('problemRows').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-problem]');
    if (!button) return;
    try {
      await api.patch(`/api/admin/problems/${encodeURIComponent(button.dataset.problem)}`, {
        status: button.dataset.next,
      });
      toast(t('msg.updated'), 'success');
      await loadProblems();
    } catch (error) {
      showMessage('problemMessage', serverText(error.message, { status: error.status }), 'error');
    }
  });

  onLanguageChange(() => render());
}
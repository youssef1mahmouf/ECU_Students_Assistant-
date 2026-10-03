import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount } from '/shared/ui.js';
import { t } from '/shared/i18n.js';

await bootChrome({ area: 'guest', active: 'assessments' });

const [assessments, site] = await Promise.all([
  api.getQuiet('/api/public/assessments'),
  api.getQuiet('/api/public/site'),
]);

const rows = assessments?.assessments || [];
mount(
  '#assessmentRows',
  rows.length
    ? rows
        .map(
          (item) => `<tr>
        <th scope="row"><span>${escapeHtml(item.title)}</span><small class="row-sub">${escapeHtml(item.summary || '')}</small></th>
        <td><span class="badge muted">${escapeHtml(item.group)}</span></td>
        <td>${escapeHtml(item.kind || '-')}</td>
        <td>${item.dueDate ? escapeHtml(formatDate(item.dueDate)) : '-'}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="empty">${escapeHtml(t('msg.empty'))}</td></tr>`
);

const notice = document.getElementById('siteNotice');
if (notice && site?.notice) {
  notice.textContent = site.notice;
  notice.hidden = false;
}

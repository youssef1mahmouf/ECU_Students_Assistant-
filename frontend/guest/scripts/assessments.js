/** The published-assessments table. One view, one endpoint, four states. */
import { bootChrome } from '/shared/shell.js';
import { api, getQuiet } from '/shared/api.js';
import { escapeHtml, svg, formatDate } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';

await bootChrome({ area: 'guest', active: 'assessments' });

createView('#assessmentTable', {
  load: () => api.get('/api/public/assessments'),
  isEmpty: (data) => !(data?.assessments || []).length,
  empty: { icon: 'list-checks', titleKey: 'msg.empty', bodyKey: 'msg.emptyBody' },
  skeleton: () => '<div class="skeleton skeleton--block"></div>',
  render: (data) => `<div class="table-wrap">
      <table class="table table--responsive">
        <caption class="visually-hidden">${escapeHtml(t('guest.assessmentsCaption'))}</caption>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('field.title'))}</th>
            <th scope="col">${escapeHtml(t('field.group'))}</th>
            <th scope="col">${escapeHtml(t('field.kind'))}</th>
            <th scope="col">${escapeHtml(t('field.dueDate'))}</th>
          </tr>
        </thead>
        <tbody>
          ${data.assessments
            .map(
              (item) => `<tr>
            <th scope="row" data-label="${escapeHtml(t('field.title'))}">
              <span class="table__primary">${escapeHtml(item.title)}</span>
              ${item.summary ? `<small class="table__sub">${escapeHtml(item.summary)}</small>` : ''}
            </th>
            <td data-label="${escapeHtml(t('field.group'))}"><span class="badge">${escapeHtml(item.group)}</span></td>
            <td data-label="${escapeHtml(t('field.kind'))}">${escapeHtml(item.kind || '-')}</td>
            <td data-label="${escapeHtml(t('field.dueDate'))}">${
              item.dueDate ? escapeHtml(formatDate(item.dueDate)) : '-'
            }</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`,
}).reload();

/* The site notice is genuinely optional, so it never becomes an error state. */
const site = await getQuiet('/api/public/site');
if (site?.notice) {
  document.getElementById('siteNotice').innerHTML =
    `<div class="notice notice--warning" role="status">${svg('triangle-alert')}
      <p class="notice__body">${escapeHtml(site.notice)}</p></div>`;
}

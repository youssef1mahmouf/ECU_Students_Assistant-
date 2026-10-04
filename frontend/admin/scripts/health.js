/**
 * /admin/health/ - is the service answering, and what is it running on.
 *
 * Everything here is read from GET /api/health. Nothing is inferred and nothing
 * about the deployment is invented: if the endpoint does not report it, the page
 * does not show it.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, svg } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';

const session = await bootAdmin({ active: 'health' });
if (!session) throw new Error('redirecting');

function factsMarkup(health) {
  const rows = [
    [t('admin.healthStore'), health?.store || '-'],
    [t('admin.healthEnv'), health?.env || '-'],
    [t('admin.healthTime'), health?.time ? formatDate(health.time, 'full') : '-'],
  ];
  return '<div class="card" id="healthFacts"><dl class="fact-list">'
    + rows.map(([label, value]) => '<div class="fact">'
      + `<dt>${escapeHtml(label)}</dt><dd dir="ltr">${escapeHtml(String(value))}</dd></div>`)
    .join('')
    + '</dl></div>';
}

const view = createView('#healthStatus', {
  load: () => api.get('/api/health'),
  error: () => ({
    icon: 'heart-pulse',
    titleKey: 'admin.healthUnreachable',
    bodyKey: 'admin.healthUnreachableBody',
  }),
  render: (health) => {
    const ok = health?.status === 'ok';
    const lead = document.getElementById('healthLead');
    if (lead) lead.textContent = t('admin.healthNote');

    /* The banner and the fact card are both returned to the single host region,
       so nothing is painted from the side and nothing is left blank. */
    return `<div class="notice ${ok ? 'notice--success' : 'notice--danger'}" role="status">`
      + svg('heart-pulse')
      + `<p class="notice__body"><strong>${
        escapeHtml(ok ? t('admin.healthOk') : t('admin.healthDegraded'))
      }</strong></p></div>`
      + factsMarkup(health);
  },
});

view.reload();
document.getElementById('healthRefresh').addEventListener('click', () => view.reload());

/**
 * /admin/dashboard/ - live figures from GET /api/admin/overview.
 *
 * Every number, bar and role chip below is computed by the server from the
 * store. Nothing here is estimated, seeded or remembered, and the three charts
 * are drawn from the same activity buckets the Activity page renders, so the
 * dashboard can never disagree with the log.
 */
import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';
import { createView, statGrid } from '/shared/ui/view.js';
import { barChart } from '/shared/ui/chart.js';

const session = await bootAdmin({ active: 'dashboard' });
if (!session) throw new Error('redirecting');

/**
 * A bar chart built from the activity buckets. `label` is the axis tick and the
 * bucket count is exposed as a title plus visually hidden text, so the chart is
 * readable with a screen reader rather than being a picture of numbers.
 */
function chartCard(name, chart) {
  const buckets = (chart?.buckets || []).map((bucket) => ({
    label: String(bucket.label || ''),
    count: Number(bucket.count || 0),
  }));
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const range = buckets.length
    ? `${t('admin.chartRange', { from: buckets[0].label, to: buckets[buckets.length - 1].label })}`
    : '';

  return `<article class="card">
      <h3 class="card__title">${escapeHtml(t(`admin.chart${cap(name)}`))}</h3>
      <p class="card__meta">${escapeHtml(range)} &middot; ${escapeHtml(t('admin.chartCount', { count: total }))}</p>
      ${total === 0
        ? `<p class="muted small">${escapeHtml(t('admin.chartsEmpty'))}</p>`
        : barChart(buckets)}
    </article>`;
}

const cap = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const view = createView('#statGrid', {
  load: () => api.get('/api/admin/overview'),
  error: () => ({ icon: 'triangle-alert', titleKey: 'msg.loadFailed', bodyKey: 'msg.loadFailedBody' }),
  render: (overview) => {
    const stats = overview.stats;
    const online = stats.online || { count: 0, windowMinutes: 15 };
    const byRole = stats.byRole || {};

    const lead = document.getElementById('dashLead');
    if (lead) lead.textContent = `${session.user.name} · ${t(`role.${session.user.role}`)}`;

    document.getElementById('roleBreakdown').innerHTML =
      Object.entries(byRole)
        .filter(([, count]) => Number(count) > 0)
        .map(
          ([role, count]) =>
            `<span class="badge badge--outline">${escapeHtml(t(`role.${role}`))}
              <strong class="numeric">${escapeHtml(String(count))}</strong></span>`
        )
        .join('') +
      `<span class="tiny subtle">${escapeHtml(t('admin.onlineNote', { minutes: online.windowMinutes }))}</span>`;

    document.getElementById('chartGrid').innerHTML = ['daily', 'weekly', 'monthly']
      .map((name) => chartCard(name, overview.charts?.[name]))
      .join('');

    return statGrid([
      [String(stats.users ?? 0), t('admin.totalUsers'), 'accent'],
      [String(stats.admins ?? 0), t('admin.statsAdmins')],
      [String(stats.pending ?? 0), t('admin.statsPending'), stats.pending ? 'warning' : ''],
      [String(stats.groups ?? 0), t('admin.groups')],
      [String(stats.records ?? 0), t('admin.statsContent')],
      [String(online.count ?? 0), t('admin.online'), 'success'],
    ]);
  },
});

view.reload();
/* Charts carry labels and role names, so they follow the language. */
onLanguageChange(() => view.refresh());

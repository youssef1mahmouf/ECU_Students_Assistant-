import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'dashboard' });

/* Every number below comes from /api/admin/overview, which computes them from the store:
   accounts and roles from `users`, "online" from sessions seen inside the configurable
   window, and the three charts from the real activity log (server local time). */
let overview = null;

function relativeLabel(value) {
  if (!value) return '';
  const labels = { daily: 'admin.chartDaily', weekly: 'admin.chartWeekly', monthly: 'admin.chartMonthly' };
  return t(labels[value] || 'admin.chartDaily');
}

function rangeText(chart) {
  const buckets = chart?.buckets || [];
  if (!buckets.length) return '';
  const from = formatDate(buckets[0].from);
  const to = formatDate(buckets[buckets.length - 1].from);
  return t('admin.chartRange', { from, to });
}

function chartBlock(name, chart) {
  const buckets = chart?.buckets || [];
  const total = buckets.reduce((sum, bucket) => sum + Number(bucket.count || 0), 0);
  const max = Math.max(1, ...buckets.map((bucket) => Number(bucket.count || 0)));
  const bars = buckets
    .map((bucket) => {
      const count = Number(bucket.count || 0);
      const height = count === 0 ? 2 : Math.max(6, Math.round((count / max) * 100));
      return `<div class="chart-col" title="${escapeHtml(`${bucket.label}: ${count}`)}">
        <span class="chart-count">${count}</span>
        <span class="chart-bar" style="height:${height}%"></span>
        <span class="chart-label">${escapeHtml(String(bucket.label).slice(5))}</span>
      </div>`;
    })
    .join('');
  return `<article class="chart-card" aria-label="${escapeHtml(relativeLabel(name))}">
    <h3>${escapeHtml(relativeLabel(name))}</h3>
    <p class="subtext chart-range">${escapeHtml(rangeText(chart))} · ${escapeHtml(t('admin.chartCount', { count: total }))}</p>
    ${total === 0 ? `<p class="empty">${escapeHtml(t('admin.chartsEmpty'))}</p>` : `<div class="chart-bars">${bars}</div>`}
  </article>`;
}

function render() {
  const stats = overview?.stats;
  if (!stats) {
    mount('#statGrid', `<div class="stat"><strong>!</strong><span>${escapeHtml(t('msg.statsLoadFailed'))}</span></div>`);
    mount('#roleBreakdown', '');
    mount('#chartGrid', `<p class="empty">${escapeHtml(t('msg.statsLoadFailed'))}</p>`);
    return;
  }
  document.getElementById('dashLead').textContent = `${session.user.name} · ${t(`role.${session.user.role}`)}`;

  const online = stats.online || { count: 0, windowMinutes: 15 };
  const cards = [
    [stats.users, t('admin.totalUsers')],
    [stats.admins, t('admin.statsAdmins')],
    [stats.pending, t('admin.statsPending')],
    [stats.groups, t('admin.groups')],
    [stats.records, t('admin.statsContent')],
    [online.count, t('admin.online')],
  ];
  mount(
    '#statGrid',
    cards
      .map(([value, label]) => `<div class="stat"><strong>${Number(value || 0)}</strong><span>${escapeHtml(label)}</span></div>`)
      .join('')
  );

  const byRole = stats.byRole || {};
  mount(
    '#roleBreakdown',
    `<p class="subtext">${escapeHtml(t('admin.byRole'))}: ${Object.entries(byRole)
      .map(([role, count]) => `<span class="chip"><b>${Number(count || 0)}</b> ${escapeHtml(t(`role.${role}`))}</span>`)
      .join(' ')}</p>
     <p class="subtext">${escapeHtml(t('admin.onlineNote', { minutes: online.windowMinutes }))}</p>`
  );

  const charts = overview?.charts;
  mount(
    '#chartGrid',
    ['daily', 'weekly', 'monthly'].map((name) => chartBlock(name, charts?.[name])).join('')
  );
}

if (session) {
  overview = await api.getQuiet('/api/admin/overview');
  render();
  /* The charts carry numbers and role names that differ per language: redraw on a switch. */
  onLanguageChange(() => render());
}

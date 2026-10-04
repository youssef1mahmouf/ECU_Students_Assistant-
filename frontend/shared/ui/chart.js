/**
 * A dependency-free SVG bar chart.
 *
 * Why not a charting library: this draws three bar series of at most fourteen
 * bars each, from numbers the server already computed. Chart.js would add ~200 KB
 * to every admin page load to produce the same eight rectangles with a different
 * set of defaults. A short, theme-token-driven function is smaller, matches the
 * rest of the design system exactly, and degrades to a readable text summary.
 *
 * Accessibility: each bar carries a <title> and visually hidden text, so a screen
 * reader reads "12 events" rather than nothing at all.
 */
import { escapeHtml } from '/shared/ui.js';
import { t } from '/shared/i18n.js';

export function barChart(buckets, { height = 140 } = {}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return `<figure class="chart">
      <div class="chart__plot" style="height:${height}px">
        ${buckets
          .map(
            (bucket) => `<div class="chart__col" title="${escapeHtml(`${bucket.label}: ${bucket.count}`)}">
            <span class="visually-hidden">${escapeHtml(`${bucket.label}: ${bucket.count}`)}</span>
            <span class="chart__bar ${bucket.count === 0 ? 'chart__bar--muted' : ''}"
                  style="height:${bucket.count === 0 ? 2 : Math.max(6, Math.round((bucket.count / max) * 100))}%"></span>
          </div>`
          )
          .join('')}
      </div>
      <figcaption class="chart__axis">
        <span dir="ltr">${escapeHtml(String(buckets[0]?.label || ''))}</span>
        <span dir="ltr">${escapeHtml(String(buckets[buckets.length - 1]?.label || ''))}</span>
      </figcaption>
    </figure>`;
}

/** A labelled percentage bar, used where a ratio is real (storage used, quota). */
export function meter(label, used, total, tone = '') {
  const safeTotal = Math.max(1, Number(total) || 1);
  const percent = Math.min(100, Math.round(((Number(used) || 0) / safeTotal) * 100));
  return `<div class="meter">
      <div class="cluster cluster--between">
        <span class="small">${escapeHtml(label)}</span>
        <span class="small numeric">${escapeHtml(t('meter.percent', { percent }))}</span>
      </div>
      <div class="meter__track" role="meter" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"
           aria-label="${escapeHtml(label)}"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>
        <div class="meter__fill" style="width:${percent}%"></div>
      </div>
    </div>`;
}

'use strict';
/**
 * Activity log. Every write is best-effort: a logging failure must never turn a
 * successful request into a 500. Entries are the audit trail shown in Admin - Activity.
 *
 * Contract: only the fields below are ever written, and callers build `action`/`detail`
 * from server-side values - passwords, tokens and raw form bodies are never accepted here,
 * so they can never reach the log.
 */
const { store } = require('../db/store');

/** level: 'info' | 'auth' | 'security' | 'admin'; kind: 'action' | 'pageview'. */
async function logActivity({ actor = 'system', action, level = 'info', detail = '', page = '', kind = 'action', actorRole = '' }) {
  try {
    await store.createActivity({
      actor: String(actor).slice(0, 120),
      action: String(action).slice(0, 300),
      level: ['info', 'auth', 'security', 'admin'].includes(level) ? level : 'info',
      detail: String(detail || '').slice(0, 300),
      page: String(page || '').slice(0, 200),
      kind: kind === 'pageview' ? 'pageview' : 'action',
      actorRole: String(actorRole || '').slice(0, 40),
    });
  } catch (error) {
    console.warn('[activity] failed to record entry:', error.message);
  }
}

/**
 * Page-visit entries. Deduplicated per (user, page) inside `windowMs` so a reload or a
 * repeated request never doubles the log, and rerender-only work never reaches the
 * server at all. The map is per-process; a restart simply starts a fresh window.
 */
const PAGE_VISIT_WINDOW_MS = 30 * 60 * 1000;
const visitSeen = new Map();

function pruneVisits(now) {
  if (visitSeen.size < 500) return;
  for (const [key, at] of visitSeen) if (now - at > PAGE_VISIT_WINDOW_MS) visitSeen.delete(key);
}

async function logPageVisit(user, page) {
  if (!user || !page) return;
  const now = Date.now();
  const key = `${user.id}|${page}`;
  const previous = visitSeen.get(key);
  if (previous && now - previous < PAGE_VISIT_WINDOW_MS) return;
  visitSeen.set(key, now);
  pruneVisits(now);
  await logActivity({
    actor: user.name,
    action: `Viewed ${page}.`,
    level: 'info',
    page,
    kind: 'pageview',
    actorRole: user.role,
  });
}

module.exports = { logActivity, logPageVisit };

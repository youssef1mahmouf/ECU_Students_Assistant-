/**
 * The notification centre.
 *
 * IMPORTANT - what this is and is not:
 *   The backend has no notifications table, and none was invented. Every item
 *   below is *derived from an endpoint the caller is already allowed to read*:
 *   the recorded activity log for staff, and the student's own published content
 *   for a student. Nothing is fabricated, nothing is seeded, and there is no demo
 *   notification anywhere in the production UI.
 *
 *   Read/unread is a client-side presentation choice, not a security decision: the
 *   newest unread moment is kept in localStorage as an ISO timestamp. No token, no
 *   role and no account data is stored, and marking something read reveals nothing
 *   the reader could not already open.
 *
 * The shape below is stable on purpose, because the admin and the student
 * notification pages render it with the same component:
 *
 *   { id, level, title, body, at, href, actor, meta }
 *     level  'security' | 'admin' | 'auth' | 'content' | 'info'
 */
import { getQuiet } from '/shared/api.js';
import { t, kindLabel } from '/shared/i18n.js';

const SEEN_KEY = 'ecu.notifications.seen';

/** Levels in the order they matter: a security event outranks a read receipt. */
export const LEVEL_ORDER = ['security', 'admin', 'auth', 'content', 'info'];

export const LEVEL_TONE = {
  security: { icon: 'shield-check', badge: 'danger', key: 'level.security' },
  admin: { icon: 'settings', badge: 'warning', key: 'level.admin' },
  auth: { icon: 'lock', badge: 'info', key: 'level.auth' },
  content: { icon: 'file-text', badge: 'primary', key: 'level.content' },
  info: { icon: 'info', badge: 'muted', key: 'level.info' },
};

function sortByLevel(items) {
  return items.sort((a, b) => {
    const rank = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    if (rank !== 0) return rank;
    return String(b.at || '').localeCompare(String(a.at || ''));
  });
}

/** How many items the header bell shows before it stops counting. */
const BELL_LIMIT = 5;

/* ------------------------------------------------------------- staff feed */

/**
 * Staff notifications come from /api/admin/activity - the same log the Activity
 * page renders, so the bell can never contradict the page. Security-level events
 * are lifted to the top.
 */
export async function staffNotifications({ limit = 40 } = {}) {
  const activity = await getQuiet(`/api/admin/activity?limit=${limit}`);
  const rows = activity?.activity || activity?.events || [];
  if (!rows.length) return [];

  return sortByLevel(
    rows.map((row) => ({
      id: `act-${row.id || row.createdAt}`,
      level: LEVEL_TONE[row.level] ? row.level : 'info',
      title: row.action || t('level.info'),
      body: row.actor ? t('notif.actorLabel', { actor: row.actor }) : '',
      at: row.createdAt || row.timestamp || null,
      href: typeof row.page === 'string' && row.page.startsWith('/') ? row.page : null,
      actor: row.actor || '',
    }))
  );
}

/* ---------------------------------------------------------- student feed */

/**
 * A student's notifications are the things published *to their group*: the
 * assessment records /api/user/records returns and the documents /api/documents
 * returns. Both endpoints already scope the response to the caller's group, so
 * this cannot leak another group's content.
 */
export async function studentNotifications() {
  const [records, documents] = await Promise.all([
    getQuiet('/api/user/records'),
    getQuiet('/api/documents'),
  ]);

  const items = [];
  for (const record of records?.records || []) {
    items.push({
      id: `rec-${record.id}`,
      level: 'content',
      title: record.title || t('nav.assessments'),
      body: record.summary || record.body || '',
      at: record.createdAt || null,
      href: '/guest/assessments/',
      meta: record.kind ? kindLabel(record.kind) : '',
    });
  }
  for (const file of documents?.documents || []) {
    items.push({
      id: `doc-${file.id}`,
      level: 'content',
      title: file.displayName,
      body: file.subjectName || file.subject || '',
      at: file.createdAt || file.updatedAt || null,
      href: file.url ? `/user/viewer/?document=${encodeURIComponent(file.id)}` : null,
      meta: file.mimeType || '',
    });
  }

  items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return items.slice(0, 40);
}

/* ------------------------------------------------------------- read state */

/** The newest moment this browser has already seen. One number, nothing else. */
export function seenAt() {
  try {
    const value = Date.parse(localStorage.getItem(SEEN_KEY) || '');
    return Number.isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

/** Marks everything up to now as read. */
export function markAllSeen() {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    /* Storage blocked: the bell keeps its count for this session only. */
  }
}

export function isUnread(item, seen) {
  if (!item.at || !seen) return false;
  const at = Date.parse(item.at);
  return !Number.isNaN(at) && at > seen;
}

/** How many are unread, counted after `markAllSeen` clears the bell. */
export function unreadCount(items) {
  const seen = seenAt();
  return items.reduce((n, item) => n + (isUnread(item, seen) ? 1 : 0), 0);
}

/** The short list the topbar bell shows: newest first. */
export function bellItems(items) {
  return [...items]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, BELL_LIMIT);
}

/** Resolves the right feed for the signed-in role. */
export function notificationsFor(area) {
  return area === 'admin' ? staffNotifications() : studentNotifications();
}

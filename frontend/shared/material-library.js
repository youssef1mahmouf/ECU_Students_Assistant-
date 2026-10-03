import { api, apiUrl } from '/shared/api.js';
import { escapeHtml, mount } from '/shared/ui.js';

/**
 * Renders the teaching-material index produced by scripts/import-material-library.js.
 *
 * The index is a read-only picture of a source folder: names, sizes and counts. No file bytes
 * are served by the API, so nothing here can be downloaded from here - it tells a student what
 * exists and which week it belongs to.
 */

const TYPE_ORDER = ['pdf', 'word', 'image', 'video', 'recording'];
const TYPE_LABEL = {
  pdf: 'PDF',
  word: 'Word',
  image: 'Images',
  video: 'Video',
  recording: 'Recording',
};
const BYTES = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  let index = 0;
  let scaled = value;
  while (scaled >= 1024 && index < BYTES.length - 1) { scaled /= 1024; index += 1; }
  return `${scaled >= 10 || index === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${BYTES[index]}`;
}

function sortedFolders(folders = []) {
  return [...folders].sort((a, b) => {
    const rank = (f) => {
      const at = TYPE_ORDER.indexOf(f.type);
      return at === -1 ? 99 : at;
    };
    return rank(a) - rank(b) || a.folder.localeCompare(b.folder);
  });
}

/* Drill-down state. `at` holds the currently open level; `hostId` is the container being
   repainted, so paint() never has to be handed a selector around. */
let data = null;
let hostId = '';
let at = {};

function card({ key, kind, title, meta, depth }) {
  return `<button type="button" class="library-card" data-depth="${depth}" data-key="${escapeHtml(key)}">
      <span class="library-card-kind">${escapeHtml(kind)}</span>
      <span class="library-card-title">${escapeHtml(title)}</span>
      <span class="library-card-meta">${escapeHtml(meta)}</span>
    </button>`;
}

const weekFileCount = (week) => week.sessions.reduce((n, s) => n + s.fileCount, 0);

/** Path of the open folder relative to the library root, matching Subject/Week/Session/Type. */
function folderPath(folder) {
  const type = folder === 'loose' ? '' : `${folder.folder}/`;
  return `${at.subject.name}/${at.week.name}/${at.session.name}/${type}`;
}

/** Home > Subject > Week > Lecture/Tutorial/Lab > PDF|Video|... > file */
function view() {
  const { subject, week, session, folder } = at;
  const crumbs = [{ label: 'Subjects', level: null }];
  if (subject) crumbs.push({ label: subject.name, level: 'subject' });
  if (week) crumbs.push({ label: `Week ${week.week}`, level: 'week' });
  if (session) crumbs.push({ label: session.name, level: 'session' });
  if (folder) crumbs.push({ label: folder.folder, level: 'folder' });

  const trail = crumbs.map((c, i) => `<button type="button" class="library-crumb" data-level="${c.level || ''}">`
    + `${escapeHtml(c.label)}</button>${i < crumbs.length - 1 ? '<span class="library-crumb-sep">/</span>' : ''}`).join('');

  let body;
  if (!subject) {
    body = `<div class="library-grid">${data.subjects.map((s) => card({
      key: s.slug, kind: 'Subject', title: s.name,
      meta: `${s.weeks.length} week(s) · ${s.weeks.reduce((n, w) => n + weekFileCount(w), 0)} file(s)`,
      depth: 'subject',
    })).join('')}</div>`;
  } else if (!week) {
    body = `<div class="library-grid">${subject.weeks.map((w) => card({
      key: String(w.week), kind: 'Week', title: w.name,
      meta: `${w.sessions.length} session(s) · ${weekFileCount(w)} file(s)`,
      depth: 'week',
    })).join('')}</div>`;
  } else if (!session) {
    body = `<div class="library-grid">${week.sessions.map((s) => card({
      key: s.slug, kind: s.kind, title: s.name,
      meta: `${s.fileCount} file(s) · ${formatBytes(s.bytes)}`,
      depth: 'session',
    })).join('')}</div>`;
  } else if (!folder) {
    const loose = session.files.length
      ? card({ key: '', kind: 'File', title: 'Loose files', meta: `${session.files.length} item(s)`, depth: 'folder' })
      : '';
    body = `<div class="library-grid">${loose}${sortedFolders(session.folders).map((f) => card({
      key: f.folder, kind: TYPE_LABEL[f.type] || 'Folder', title: f.folder,
      meta: `${f.files.length} file(s) · ${formatBytes(f.files.reduce((n, x) => n + x.size, 0))}`,
      depth: 'folder',
    })).join('')}</div>`
      + (session.files.length ? renderFiles(session.files) : '');
  } else {
    body = renderFiles(folder === 'loose' ? session.files : folder.files, folderPath(folder));
  }

  return `<nav class="library-crumbs">${trail}</nav>${body}`;
}

function paint() {
  mount(`#${hostId}`, `${summary()}${view()}`);
}

/* Clicks are handled by delegation: every card carries its level, and a crumb in the trail
   rewinds to the level it names. */
function onClick(event) {
  const crumb = event.target.closest('.library-crumb');
  if (crumb) {
    const level = crumb.dataset.level;
    if (level === 'week') { at.session = null; at.folder = null; }
    else if (level === 'subject') { at.week = null; at.session = null; at.folder = null; }
    else at = {};
    paint();
    return;
  }
  const hit = event.target.closest('.library-card');
  if (!hit) return;
  const depth = hit.dataset.depth;
  if (depth === 'subject') {
    at.subject = data.subjects.find((s) => s.slug === hit.dataset.key) || null;
    at.week = null; at.session = null; at.folder = null;
  } else if (depth === 'week') {
    at.week = at.subject.weeks.find((w) => w.week === Number(hit.dataset.key)) || null;
    at.session = null; at.folder = null;
  } else if (depth === 'session') {
    at.session = at.week.sessions.find((s) => s.slug === hit.dataset.key) || null;
    at.folder = null;
  } else if (depth === 'folder') {
    at.folder = hit.dataset.key
      ? sortedFolders(at.session.folders).find((f) => f.folder === hit.dataset.key) || null
      : 'loose';
  }
  paint();
}

function summary() {
  const { totals } = data;
  return `<div class="library-summary">
      <span class="library-stat"><strong>${totals.subjects}</strong> subjects</span>
      <span class="library-stat"><strong>${totals.weeks}</strong> weeks</span>
      <span class="library-stat"><strong>${totals.sessions}</strong> sessions</span>
      <span class="library-stat"><strong>${totals.files}</strong> files</span>
      <span class="library-stat"><strong>${escapeHtml(formatBytes(totals.bytes))}</strong> indexed</span>
    </div>`;
}

/* Only these can be viewed or downloaded in place. Anything else (a .srt sidecar, a zip)
   is listed by name but offers no action, because the browser cannot usefully display it. */
const LIVE_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'mp4', 'webm', 'mov', 'm4v', 'mp3', 'm4a', 'wav', 'ogg', 'txt', 'md']);

function renderFiles(files = [], pathPrefix = []) {
  if (!files.length) return '<p class="empty">Nothing in this folder.</p>';
  return `<ul class="library-files">${files.map((file) => {
    const rel = [...pathPrefix, file.name].join('/');
    const canLive = LIVE_EXT.has(file.ext);
    const href = apiUrl(`/api/public/material-library/file?path=${encodeURIComponent(rel)}`);
    const actions = canLive
      ? `<span class="library-file-actions">
           <a class="btn secondary" href="${href}" download>Download</a>
           <a class="btn secondary" href="${href}&inline=1" target="_blank" rel="noopener">Open live</a>
         </span>`
      : '';
    return `<li>
        <span class="library-file-name">${escapeHtml(file.name)}</span>
        <span class="library-file-size">${escapeHtml(formatBytes(file.size))}</span>
        ${actions}
      </li>`;
  }).join('')}</ul>`;
}

/**
 * Loads the index and paints it into `containerId`. Missing or not-yet-generated indexes render
 * a short explanation instead of an error, because running the importer is a normal admin step.
 *
 * Navigation is card-based and drills one level at a time - subject, then week, then session,
 * then type folder, then the files inside it - matching how the folders are arranged on disk.
 */
export async function renderMaterialLibrary(containerId) {
  const host = document.getElementById(containerId);
  if (!host) return null;

  try {
    /* Routed through the shared client so a separately hosted frontend still reaches the API. */
    data = await api.getQuiet('/api/public/material-library');
  } catch {
    mount(`#${containerId}`, '<p class="empty">Could not load the material index.</p>');
    return null;
  }

  if (!data || !data.available) {
    mount(`#${containerId}`, '<p class="empty">The material index has not been generated yet. '
      + 'Run <code>npm run import:library</code> and reload.</p>');
    return null;
  }

  hostId = containerId;
  at = {};
  paint();

  /* One listener for the whole drill-down; paint() only swaps innerHTML, so the host keeps it. */
  host.addEventListener('click', onClick);
  return data;
}
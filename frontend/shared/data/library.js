/**
 * The teaching-material library: one data source, one navigation model.
 *
 * This module replaces the old `shared/material-library.js`, which was mounted
 * onto the same page as the group's own documents. That is the "duplicate library
 * card" bug from the brief: three renderers (a card grid, a loading card and a
 * hand-built resource list) were drawing the same concept on one page. Now:
 *
 *   /user/library/   this module ONLY  - the shared course-material index
 *   /user/documents/ the documents API ONLY - files uploaded to your group
 *
 * Nothing here merges the two, and nothing is hard-coded: every folder, file,
 * name and size below comes from GET /api/public/material-library, which is
 * itself generated from the real material folder on disk.
 */
import { api, getQuiet } from '/shared/api.js';

/** The only endpoint the explorer reads. */
const INDEX_URL = '/api/public/material-library';

/** How a file is streamed, and whether it can be shown in the in-app viewer. */
const VIEWABLE = {
  pdf: { kind: 'pdf', icon: 'file-text', key: 'kind.pdf' },
  png: { kind: 'image', icon: 'image', key: 'kind.image' },
  jpg: { kind: 'image', icon: 'image', key: 'kind.image' },
  jpeg: { kind: 'image', icon: 'image', key: 'kind.image' },
  gif: { kind: 'image', icon: 'image', key: 'kind.image' },
  webp: { kind: 'image', icon: 'image', key: 'kind.image' },
  svg: { kind: 'image', icon: 'image', key: 'kind.image' },
  mp4: { kind: 'video', icon: 'video', key: 'kind.video' },
  webm: { kind: 'video', icon: 'video', key: 'kind.video' },
  mov: { kind: 'video', icon: 'video', key: 'kind.video' },
  m4v: { kind: 'video', icon: 'video', key: 'kind.video' },
  ogv: { kind: 'video', icon: 'video', key: 'kind.video' },
  mp3: { kind: 'audio', icon: 'music', key: 'kind.audio' },
  m4a: { kind: 'audio', icon: 'music', key: 'kind.audio' },
  wav: { kind: 'audio', icon: 'music', key: 'kind.audio' },
  ogg: { kind: 'audio', icon: 'music', key: 'kind.audio' },
  oga: { kind: 'audio', icon: 'music', key: 'kind.audio' },
  txt: { kind: 'text', icon: 'file', key: 'kind.text' },
  md: { kind: 'text', icon: 'file', key: 'kind.text' },
};

/** Extensions the browser can display inline. Anything else is download-only. */
export function fileKind(ext) {
  return VIEWABLE[String(ext || '').toLowerCase()] || { kind: 'other', icon: 'file', key: 'kind.file' };
}

export function canView(ext) {
  return fileKind(ext).kind !== 'other';
}

/* --------------------------------------------------------------- fetching */

/**
 * Loads the index. Throws when the endpoint fails so the caller shows the error
 * state; "the index has not been generated yet" is a *successful* answer with
 * `available: false` and gets its own explanation instead.
 */
export async function loadLibrary() {
  const data = await api.get(INDEX_URL);
  if (!data || data.available === false) {
    const error = new Error('library-not-generated');
    error.code = 'NOT_GENERATED';
    throw error;
  }
  return data;
}

/** Non-throwing variant for the admin page, which explains the same state inline. */
export async function loadLibraryQuiet() {
  return getQuiet(INDEX_URL);
}

/** Totals for the page subtitle. Never invented - every number comes from the index. */
export function librarySummary(data) {
  const totals = data?.totals || {};
  return {
    subjects: Number(totals.subjects || 0),
    weeks: Number(totals.weeks || 0),
    sessions: Number(totals.sessions || 0),
    files: Number(totals.files || 0),
    bytes: Number(totals.bytes || 0),
    generatedAt: data?.generatedAt || null,
  };
}

const segment = (value) => encodeURIComponent(String(value));

/** Serialises a folder path for the ?p= query parameter. */
export function encodePath(segments) {
  return (segments || []).map(segment).join('/');
}

/** Reads the ?p= query parameter back into an array of decoded names. */
export function decodePath(value) {
  if (!value) return [];
  return String(value)
    .split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .filter(Boolean);
}

export const folderCount = (session) =>
  (session.folders || []).reduce((n, folder) => n + (folder.files || []).length, 0) +
  (session.files || []).length;

export const weekFileCount = (week) =>
  (week.sessions || []).reduce((n, session) => n + folderCount(session), 0);

/* ------------------------------------------------------------- navigation */

/**
 * Resolves a path against the index and returns everything the view needs: the
 * breadcrumbs, the child folders, the files, and the level being shown. Returns
 * null for a path the index does not contain, so a hand-edited URL produces the
 * empty state rather than a crash.
 */
export function resolvePath(data, path) {
  const steps = decodePath(path);
  const subjects = data?.subjects || [];

  if (!steps.length) {
    return {
      level: 'root',
      crumbs: [],
      title: '',
      folders: subjects.map((subject) => ({
        type: 'subject',
        name: subject.name,
        icon: 'book-open',
        count: (subject.weeks || []).length,
        files: weekFileCount(subject) || 0,
        path: encodePath([subject.name]),
      })),
      files: [],
    };
  }

  const crumbs = [{ label: '', path: '', level: 'root' }];
  let level = 'root';
  let children = subjects;

  for (let depth = 0; depth < steps.length; depth += 1) {
    const name = steps[depth];
    const here = encodePath(steps.slice(0, depth + 1));

    if (level === 'root') {
      const found = children.find((item) => item.name === name);
      if (!found) return null;
      crumbs.push({ label: found.name, path: here, level: 'subject' });
      children = found.weeks || [];
      level = 'subject';
      continue;
    }
    if (level === 'subject') {
      const found = children.find((item) => item.name === name);
      if (!found) return null;
      crumbs.push({ label: found.name, path: here, level: 'week' });
      children = found.sessions || [];
      level = 'week';
      continue;
    }
    if (level === 'week') {
      const found = children.find((item) => item.name === name);
      if (!found) return null;
      crumbs.push({ label: found.name, path: here, level: 'session' });
      /* A session holds typed sub-folders plus, sometimes, loose files. Marked so
         the folder walk below can tell a folder from that loose list. */
      children = (found.folders || []).map((folder) => ({ ...folder, __folder: true }));
      if ((found.files || []).length) children.push({ __loose: true, folder: '', files: found.files });
      level = 'session';
      continue;
    }
    if (level === 'session') {
      const found = children.find((item) => item.folder === name);
      if (!found) return null;
      crumbs.push({ label: found.folder, path: here, level: 'folder' });
      children = found.files || [];
      level = 'folder';
      continue;
    }
    return null;
  }

  /* Still above file level: show folders. */
  if (level === 'root' || level === 'subject' || level === 'week') {
    return {
      level,
      crumbs,
      title: crumbs[crumbs.length - 1].label,
      folders: children.map((child) => {
        if (level === 'subject') {
          return {
            type: 'week',
            name: child.name,
            icon: 'calendar-days',
            count: (child.sessions || []).length,
            files: weekFileCount(child) || 0,
            path: encodePath([...steps, child.name]),
          };
        }
        return {
          type: 'session',
          name: child.name,
          icon: child.kind === 'lab' ? 'settings' : child.kind === 'tutorial' ? 'list-checks' : 'play',
          count: folderCount(child) || 0,
          files: folderCount(child) || 0,
          path: encodePath([...steps, child.name]),
        };
      }),
      files: [],
    };
  }

  /* Inside a session or a folder: only files remain. */
  const base = steps.slice(0, -1);
  const files = (children || [])
    .map((file) => {
      const relative = [...base, file.name].join('/');
      return {
        ...file,
        path: relative,
        url: `/api/public/material-library/file?path=${encodeURIComponent(relative)}`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { level, crumbs, title: crumbs[crumbs.length - 1].label, folders: [], files };
}

/** Where "back" goes from a path: the parent folder, or the library root. */
export function parentPath(path) {
  const steps = decodePath(path);
  return steps.length <= 1 ? '' : encodePath(steps.slice(0, -1));
}

/** The viewer URL for one library file. `from` lets the viewer put Back in place. */
export function viewerHref(file, libraryPath) {
  return `/user/viewer/?file=${encodeURIComponent(file.path)}&from=${encodeURIComponent(libraryPath || '')}`;
}

/** The viewer URL for one uploaded group document, which is addressed by id. */
export function documentViewerHref(id) {
  return `/user/viewer/?document=${encodeURIComponent(id)}`;
}

/**
 * Client-side search over file names. A plain substring match: this runs over a
 * few hundred strings already in memory, so a search index would be cost without
 * benefit. Each result carries its folder, so a hit is one click from the file.
 */
export function searchLibrary(data, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];

  const hits = [];
  const push = (file, folder, prefix) => {
    if (!String(file.name || '').toLowerCase().includes(needle)) return;
    const base = folder ? `${prefix}/${folder}` : prefix;
    const relative = `${base}/${file.name}`;
    hits.push({
      name: file.name,
      size: file.size,
      ext: file.ext,
      location: base.split('/').join(' / '),
      path: base,
      relative,
      url: `/api/public/material-library/file?path=${encodeURIComponent(relative)}`,
    });
  };

  for (const subject of data?.subjects || []) {
    for (const week of subject.weeks || []) {
      for (const session of week.sessions || []) {
        const prefix = `${subject.name}/${week.name}/${session.name}`;
        for (const folder of session.folders || []) {
          for (const file of folder.files || []) push(file, folder.folder, prefix);
        }
        for (const file of session.files || []) push(file, '', prefix);
      }
    }
  }
  return hits;
}

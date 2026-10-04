/**
 * The library explorer component.
 *
 * Replaces the drill-down card grid that used to live inside `material-library.js`
 * and share a page with the group's own documents. Everything it draws comes from
 * `shared/data/library.js`, which reads exactly one endpoint.
 *
 * Navigation is URL-first: the open folder is the `?p=` query parameter and every
 * folder is a real link. That means a folder can be bookmarked and shared, and -
 * because each move pushes history - the browser Back button walks the trail.
 */
import { escapeHtml, svg, formatBytes } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';
import { createView } from '/shared/ui/view.js';
import {
  loadLibrary,
  librarySummary,
  resolvePath,
  decodePath,
  searchLibrary,
  fileKind,
  canView,
  viewerHref,
} from '/shared/data/library.js';

const SEP = '<span class="breadcrumbs__sep" aria-hidden="true">';

function crumbsMarkup(crumbs) {
  const trail = crumbs
    .map((crumb, index) => {
      /* The deepest crumb is the current position: a span, not a link. */
      if (index === crumbs.length - 1) {
        return `<span class="breadcrumbs__item" aria-current="page">${escapeHtml(crumb.label)}</span>`;
      }
      return `<a class="breadcrumbs__item" href="?p=${encodeURIComponent(crumb.path)}">${escapeHtml(crumb.label)}</a>`
        + `${SEP}${svg('chevron-right')}</span>`;
    })
    .join('');
  return `<nav class="breadcrumbs" aria-label="${escapeHtml(t('library.breadcrumbLabel'))}">`
    + `<a class="breadcrumbs__item" href="?p=">${svg('library', { size: '0.95rem' })}`
    + `<span>${escapeHtml(t('library.root'))}</span></a>`
    + (crumbs.length ? `${SEP}${svg('chevron-right')}</span>${trail}` : '')
    + '</nav>';
}

function folderTile(folder) {
  const meta = folder.files
    ? t('library.folderMeta', { files: folder.files, count: folder.count })
    : t('library.folderWeeks', { count: folder.count });
  return `<a class="library__folder" href="?p=${encodeURIComponent(folder.path)}">`
    + `<span class="library__folder-icon">${svg(folder.icon)}</span>`
    + `<span class="library__folder-body">`
    + `<span class="library__folder-name">${escapeHtml(folder.name)}</span>`
    + `<span class="library__folder-meta">${escapeHtml(meta)}</span>`
    + '</span>'
    + `<span class="library__folder-chevron">${svg('chevron-right')}</span></a>`;
}

function fileRow(file, currentPath) {
  const kind = fileKind(file.ext);
  return `<li class="library__file">`
    + `<span class="library__file-icon library__file-icon--${kind.kind}">${svg(kind.icon)}</span>`
    + '<span class="library__file-body">'
    + `<span class="library__file-name" dir="auto">${escapeHtml(file.name)}</span>`
    + '<span class="library__file-meta">'
    + `<span class="badge badge--outline">${escapeHtml(t(kind.key))}</span>`
    + `<span dir="ltr">${escapeHtml(formatBytes(file.size))}</span>`
    + '</span></span>'
    + '<span class="library__file-actions">'
    + (canView(file.ext)
        ? `<a class="btn btn--secondary btn--sm" href="${viewerHref(file, currentPath)}">${svg('eye')}`
          + `<span>${escapeHtml(t('action.openInViewer'))}</span></a>`
        : '')
    + `<a class="btn btn--ghost btn--sm" href="${file.url}" download>${svg('download')}`
      + `<span>${escapeHtml(t('action.download'))}</span></a>`
    + '</span></li>';
}

function hitRow(hit) {
  const kind = fileKind(hit.ext);
  return `<li class="library__file">`
    + `<span class="library__file-icon library__file-icon--${kind.kind}">${svg(kind.icon)}</span>`
    + '<span class="library__file-body">'
    + `<span class="library__file-name" dir="auto">${escapeHtml(hit.name)}</span>`
    + `<span class="library__hit-location" dir="ltr">${escapeHtml(hit.location)}</span>`
    + '</span>'
    + '<span class="library__file-actions">'
    + `<a class="btn btn--secondary btn--sm" href="?p=${encodeURIComponent(hit.path)}">${svg('folder-open')}`
      + `<span>${escapeHtml(t('library.openFolder'))}</span></a>`
    + `<a class="btn btn--ghost btn--sm" href="${hit.url}" download>${svg('download')}`
      + `<span>${escapeHtml(t('action.download'))}</span></a>`
    + '</span></li>';
}

/**
 * Mounts the explorer into `host`. Returns the view so a page can reload it (the
 * admin copy of this page re-reads after the importer runs).
 */
export function mountLibraryExplorer(host, { requireSignInPage = false } = {}) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target) return null;

  const currentPath = () => new URLSearchParams(window.location.search).get('p') || '';

  const view = createView(target, {
    load: () => loadLibrary(),
    loadingKey: 'library.loading',
    skeleton: () => '<div class="skeleton-group" aria-hidden="true">'
      + '<p class="skeleton skeleton--title"></p>'
      + '<p class="skeleton skeleton--block"></p>'
      + '<p class="skeleton skeleton--block"></p></div>',

    /* "The index has not been generated" is a normal state, not a failure, and
       it needs different words from a real network error. */
    error: (err) => (err?.code === 'NOT_GENERATED'
      ? {
          icon: 'database',
          titleKey: 'library.notGeneratedTitle',
          bodyKey: 'library.notGeneratedBody',
        }
      : {}),

    render: (data) => {
      const summary = librarySummary(data);
      const path = currentPath();
      const node = resolvePath(data, path);

      /* A hand-edited or stale URL: say so instead of rendering a blank page. */
      if (!node) {
        return `<div class="library">${crumbsMarkup([])}
          <div class="state" role="status">
            <span class="state__icon">${svg('circle-help')}</span>
            <p class="state__title">${escapeHtml(t('library.notFoundTitle'))}</p>
            <p class="state__body">${escapeHtml(t('library.notFoundBody'))}</p>
            <div class="state__actions">
              <a class="btn btn--primary" href="?p="">${svg('arrow-left')}
                <span>${escapeHtml(t('library.backToRoot'))}</span></a>
            </div>
          </div></div>`;
      }

      const header = `<div class="library__trail">
          ${crumbsMarkup(node.crumbs)}
          <p class="library__summary">
            <span><b>${summary.subjects}</b> ${escapeHtml(t('library.subjectsWord'))}</span>
            <span><b>${summary.weeks}</b> ${escapeHtml(t('library.weeksWord'))}</span>
            <span><b>${summary.files}</b> ${escapeHtml(t('library.filesWord'))}</span>
            <span dir="ltr"><b>${escapeHtml(formatBytes(summary.bytes))}</b></span>
          </p>
        </div>`;

      const folders = node.folders.length
        ? `<div class="library__grid">${node.folders.map(folderTile).join('')}</div>`
        : '';

      const files = node.files.length
        ? `<ul class="library__files">${node.files.map((file) => fileRow(file, path)).join('')}</ul>`
        : '';

      if (!node.folders.length && !node.files.length) {
        return `<div class="library">${header}
          <div class="state" role="status">
            <span class="state__icon">${svg('folder-open')}</span>
            <p class="state__title">${escapeHtml(t('library.folderEmptyTitle'))}</p>
            <p class="state__body">${escapeHtml(t('library.folderEmptyBody'))}</p>
            <div class="state__actions">
              <a class="btn btn--secondary" href="?p=">${svg('arrow-left')}
                <span>${escapeHtml(t('library.backToRoot'))}</span></a>
            </div>
          </div></div>`;
      }

      return `<div class="library">${header}${folders}${files}</div>`;
    },
  });

  /* Search re-renders from data already in memory; it never re-fetches. */
  const applySearch = (query) => {
    const data = view.data;
    if (!data) return;
    const needle = String(query || '').trim();
    if (!needle) {
      window.history.replaceState({}, '', `${window.location.pathname}?p=${encodeURIComponent(currentPath())}`);
      view.refresh();
      return;
    }
    const hits = searchLibrary(data, needle);
    target.innerHTML = `<div class="library">
        <div class="library__trail">
          <nav class="breadcrumbs" aria-label="${escapeHtml(t('library.breadcrumbLabel'))}">
            <span class="breadcrumbs__item">${svg('search', { size: '0.95rem' })}
              <span>${escapeHtml(t('library.searchResults', { count: hits.length }))}</span></span>
          </nav>
          <a class="btn btn--ghost btn--sm" href="?p=${encodeURIComponent(currentPath())}">${svg('x')}
            <span>${escapeHtml(t('action.clear'))}</span></a>
        </div>
        ${hits.length
          ? `<ul class="library__files">${hits.map(hitRow).join('')}</ul>`
          : `<div class="state" role="status">
              <span class="state__icon">${svg('search')}</span>
              <p class="state__title">${escapeHtml(t('msg.searchNoResults'))}</p>
              <p class="state__body">${escapeHtml(t('msg.searchNoResultsBody'))}</p>
            </div>`}
      </div>`;
  };

  /** The page's search box. Kept here so the explorer owns its own controls. */
  const wireSearch = () => {
    const input = document.getElementById('librarySearch');
    if (!input || input.dataset.wired) return;
    input.dataset.wired = '1';
    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => applySearch(input.value), 200);
    });
  };

  const stopLanguageRefresh = onLanguageChange(() => wireSearch());
  wireSearch();

  view.reload();
  return { view, applySearch, destroy: stopLanguageRefresh, pathOf: currentPath, steps: () => decodePath(currentPath()) };
}

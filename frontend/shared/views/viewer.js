/**
 * The in-app resource viewer.
 *
 * One route, `/user/viewer/`, for every kind of resource the portal can serve:
 *
 *   ?file=<library path>       a file from the shared material index
 *   ?document=<id>             a document uploaded to the caller's group
 *
 * The user stays inside the application. Nothing opens a new tab, nothing drops
 * the student into a filesystem path, and the browser Back button returns to the
 * exact folder they came from (carried in `?from=`).
 *
 * Rendering by type:
 *   pdf     pdf.js, loaded on demand from /shared/vendor/pdf - never on a page
 *           that does not open a PDF, so the other pages stay light
 *   image   plain <img>: the browser decodes it better than any script
 *   video   <video controls> with a Download link beside it
 *   audio   <audio controls>
 *   text    fetched and shown as preformatted text, safely escaped
 *   other   no inline preview at all - a download-only notice, not a blank frame
 */
import { api, apiUrl } from '/shared/api.js';
import { escapeHtml, svg, formatBytes, formatDate } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';
import { fileKind, canView } from '/shared/data/library.js';

/* pdf.js is ~1.6 MB. It is imported here, inside a function, so the browser only
   downloads it on the one route that actually renders a PDF. */
let pdfModule = null;
async function pdfjs() {
  if (!pdfModule) {
    const lib = await import('/shared/vendor/pdf/pdf.min.mjs');
    /* The worker must be served from this origin: the CSP is default-src 'self'
       and a cross-origin worker would be blocked. */
    lib.GlobalWorkerOptions.workerSrc = apiUrl('/shared/vendor/pdf/pdf.worker.min.mjs');
    pdfModule = lib;
  }
  return pdfModule;
}

/** Resolves what to show from the query string. Never guesses: an unknown shape
 *  produces an error state, not an empty viewer. */
async function resolveTarget() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  const documentId = params.get('document');

  if (file) {
    return {
      kind: 'library',
      name: file.split('/').pop() || file,
      path: file,
      ext: (file.split('.').pop() || '').toLowerCase(),
      url: apiUrl(`/api/public/material-library/file?path=${encodeURIComponent(file)}`),
      back: params.get('from') ? `/user/library/?p=${encodeURIComponent(params.get('from'))}` : '/user/library/',
      trail: file.split('/').slice(0, -1),
    };
  }

  if (documentId) {
    /* The list endpoint is already scoped to the caller's group, so this only
       ever describes a row the signed-in account is entitled to. */
    const list = await api.get('/api/documents');
    const found = (list?.documents || []).find((row) => row.id === documentId);
    if (!found) {
      const error = new Error('not-found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    return {
      kind: 'document',
      name: found.displayName,
      path: found.folderPath || '',
      ext: (found.extension || found.displayName.split('.').pop() || '').toLowerCase(),
      url: apiUrl(found.url),
      size: found.size,
      at: found.createdAt,
      back: '/user/documents/',
      trail: (found.folderPath || '').split('/').filter(Boolean),
    };
  }

  const error = new Error('missing-target');
  error.code = 'NO_TARGET';
  throw error;
}

function stageMarkup() {
  return '<div class="viewer__stage" id="viewerStage" aria-live="polite"></div>';
}

function identityMarkup(target) {
  const kind = fileKind(target.ext);
  return `<div class="viewer__bar">
      <div class="viewer__identity">
        <h1 class="viewer__name" dir="auto">${escapeHtml(target.name)}</h1>
        <p class="viewer__meta">
          <span class="badge badge--outline">${escapeHtml(t(kind.key))}</span>
          ${target.size ? `<span dir="ltr">${escapeHtml(formatBytes(target.size))}</span>` : ''}
          ${target.at ? `<span>${escapeHtml(formatDate(target.at))}</span>` : ''}
          ${target.path ? `<span class="truncate" dir="ltr" style="max-width:22rem">${escapeHtml(target.path)}</span>` : ''}
        </p>
      </div>
      <div class="cluster cluster--tight">
        <a class="btn btn--secondary" href="${escapeHtml(target.back)}" id="viewerBack">${svg('arrow-left')}
          <span>${escapeHtml(t('action.back'))}</span></a>
        <a class="btn btn--primary" href="${escapeHtml(target.url)}" download>${svg('download')}
          <span>${escapeHtml(t('action.download'))}</span></a>
      </div>
    </div>`;
}

/* ------------------------------------------------------------- renderers */

/** Images and media are handled by the browser. */
function mediaMarkup(target) {
  const kind = fileKind(target.ext).kind;
  if (kind === 'image') return `<img src="${escapeHtml(target.url)}" alt="${escapeHtml(target.name)}" decoding="async">`;
  if (kind === 'video') {
    return `<video controls preload="metadata" playsinline src="${escapeHtml(target.url)}"></video>`;
  }
  if (kind === 'audio') {
    return `<audio controls preload="metadata" src="${escapeHtml(target.url)}"></audio>`;
  }
  return '';
}

function noticeMarkup({ iconName, titleKey, bodyKey }) {
  return `<div class="state" role="status">
      <span class="state__icon">${svg(iconName)}</span>
      <p class="state__title">${escapeHtml(t(titleKey))}</p>
      <p class="state__body">${escapeHtml(t(bodyKey))}</p>
    </div>`;
}

/**
 * Renders a PDF with pdf.js, one page at a time, into a toolbar plus a canvas.
 * Pages are rendered on demand: a 300-page document does not become 300 canvases.
 */
async function renderPdf(target, stage, toolbar) {
  const lib = await pdfjs();
  const task = lib.getDocument({ url: target.url, withCredentials: true });
  const doc = await task.promise;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  stage.replaceChildren(canvas);

  let page = 1;
  const pageCount = doc.numPages;

  const label = toolbar.querySelector('#viewerPage');
  const setLabel = () => { label.textContent = t('viewer.pageOf', { page, total: pageCount }); };

  const controls = `<div class="viewer__controls" id="viewerControls">
      <button class="icon-btn icon-btn--bordered" type="button" id="pdfPrev" title="${escapeHtml(t('viewer.previous'))}">
        ${svg('chevron-right')}<span class="visually-hidden">${escapeHtml(t('viewer.previous'))}</span></button>
      <span class="viewer__page" id="viewerPage"></span>
      <button class="icon-btn icon-btn--bordered" type="button" id="pdfNext" title="${escapeHtml(t('viewer.next'))}">
        ${svg('chevron-left')}<span class="visually-hidden">${escapeHtml(t('viewer.next'))}</span></button>
      <button class="btn btn--ghost btn--sm" type="button" id="pdfZoomOut">${svg('minus')}
        <span>${escapeHtml(t('viewer.zoomOut'))}</span></button>
      <button class="btn btn--ghost btn--sm" type="button" id="pdfZoomIn">${svg('plus')}
        <span>${escapeHtml(t('viewer.zoomIn'))}</span></button>
    </div>`;

  const host = document.getElementById('viewerControlsHost');
  host.innerHTML = controls;
  /* The chevrons point the way each language reads, so they are mirrored with
     the page rather than pointing at the wrong button. */
  if (document.documentElement.dir === 'rtl') {
    document.getElementById('pdfPrev').querySelector('svg').style.transform = 'scaleX(-1)';
    document.getElementById('pdfNext').querySelector('svg').style.transform = 'scaleX(-1)';
  }

  let scale = 1;
  const context = canvas.getContext('2d');

  const draw = async () => {
    const pdfPage = await doc.getPage(page);
    const viewport = pdfPage.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.setAttribute('aria-label', `${target.name} - ${t('viewer.pageOf', { page, total: pageCount })}`);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    setLabel();
    document.getElementById('pdfPrev').disabled = page <= 1;
    document.getElementById('pdfNext').disabled = page >= pageCount;
  };

  const clamp = (value) => Math.min(3, Math.max(0.5, Number(value.toFixed(2))));
  document.getElementById('pdfPrev').addEventListener('click', () => { if (page > 1) { page -= 1; void draw(); } });
  document.getElementById('pdfNext').addEventListener('click', () => { if (page < pageCount) { page += 1; void draw(); } });
  document.getElementById('pdfZoomOut').addEventListener('click', () => { scale = clamp(scale - 0.25); void draw(); });
  document.getElementById('pdfZoomIn').addEventListener('click', () => { scale = clamp(scale + 0.25); void draw(); });

  /* Left/right arrows page through the document when the stage has focus. */
  stage.tabIndex = 0;
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { if (page > 1) { page -= 1; void draw(); } }
    if (event.key === 'ArrowRight') { if (page < pageCount) { page += 1; void draw(); } }
  });

  await draw();
}

/** Plain text is fetched and escaped, never injected as markup. */
async function renderText(target, stage) {
  const response = await fetch(target.url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const pre = document.createElement('pre');
  pre.textContent = text.slice(0, 200_000);
  stage.replaceChildren(pre);
}

/**
 * Mounts the viewer into `root`. Re-renders on a language switch so the toolbar
 * and every message follow the active language.
 */
export async function mountViewer(root) {
  const target = typeof root === 'string' ? document.querySelector(root) : root;
  if (!target) return null;

  const paint = async () => {
    target.innerHTML = `<p class="state" role="status">
        <span class="state__icon">${svg('clock')}</span>
        <p class="state__title">${escapeHtml(t('viewer.loading'))}</p>
      </p>`;

    let resource;
    try {
      resource = await resolveTarget();
    } catch (err) {
      const notFound = err?.code === 'NOT_FOUND' || err?.code === 'NO_TARGET';
      target.innerHTML = `<div class="viewer">${noticeMarkup({
        iconName: 'circle-help',
        titleKey: notFound ? 'viewer.notFoundTitle' : 'viewer.loadFailedTitle',
        bodyKey: notFound ? 'viewer.notFoundBody' : 'viewer.loadFailedBody',
      })}
        <div class="cluster">
          <a class="btn btn--primary" href="/user/library/">${svg('library')}
            <span>${escapeHtml(t('action.openLibrary'))}</span></a>
        </div></div>`;
      return null;
    }

    const kind = fileKind(resource.ext).kind;
    const previewable = canView(resource.ext);

    target.innerHTML = `<div class="viewer">
        ${identityMarkup(resource)}
        <nav class="breadcrumbs" aria-label="${escapeHtml(t('library.breadcrumbLabel'))}">
          <a class="breadcrumbs__item" href="${escapeHtml(resource.back)}">${svg('arrow-left', { size: '0.9rem' })}
            <span>${escapeHtml(t('library.backToRoot'))}</span></a>
          ${resource.trail
            .map((part, index, all) => `<span class="breadcrumbs__item"${index === all.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(part)}</span>`
              + (index < all.length - 1 ? `<span class="breadcrumbs__sep" aria-hidden="true">${svg('chevron-right')}</span>` : ''))
            .join('')}
        </nav>
        <div id="viewerControlsHost"></div>
        ${stageMarkup()}
      </div>`;

    const stage = document.getElementById('viewerStage');
    const toolbar = document.getElementById('viewerControlsHost');

    if (!previewable) {
      stage.innerHTML = noticeMarkup({
        iconName: 'download',
        titleKey: 'viewer.noPreviewTitle',
        bodyKey: 'viewer.noPreviewBody',
      });
      return resource;
    }

    try {
      if (kind === 'pdf') {
        toolbar.innerHTML = '<p class="skeleton skeleton--text" style="width:12rem"></p>';
        await renderPdf(resource, stage, toolbar);
      } else if (kind === 'text') {
        await renderText(resource, stage);
      } else {
        stage.innerHTML = mediaMarkup(resource);
      }
    } catch (err) {
      stage.innerHTML = noticeMarkup({
        iconName: 'triangle-alert',
        titleKey: 'viewer.renderFailedTitle',
        bodyKey: 'viewer.renderFailedBody',
      });
      console.error('[viewer] render failed', err);
    }
    return resource;
  };

  await paint();
  const stop = onLanguageChange(() => { void paint(); });
  return { refresh: paint, destroy: stop };
}

/**
 * The one place a data-driven area turns a promise into pixels.
 *
 * Every list, table, tile grid and stat row in ECU is rendered through a view,
 * so all of them support the same four states and no more:
 *
 *     loading  -> a skeleton that deliberately does NOT look like content
 *     empty   -> "nothing here", with the reason in words
 *     error   -> what failed plus a Retry that re-runs the loader
 *     success -> the markup `render` returns
 *
 * This is what removed the old bug where a "loading" card was shaped exactly
 * like a resource card, and where a failed request left a blank white area.
 *
 * A view also owns re-rendering on a language switch, so a page never has to
 * remember to do that itself.
 */
import { escapeHtml, svg } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';

const activeViews = new Set();

/** Default skeleton: abstract bars, never a card outline with a title and badge. */
function defaultSkeleton(rows = 4) {
  return `<div class="skeleton-group" aria-hidden="true">${Array.from(
    { length: rows },
    () => '<p class="skeleton skeleton--row"></p>'
  ).join('')}</div>`;
}

/**
 * @param {Element|string} host      where the view paints
 * @param {object} options
 *   load()            -> Promise<any>       the only data source
 *   render(data)      -> string             success markup
 *   isEmpty(data)     -> boolean            optional emptiness test
 *   empty             -> {icon,titleKey,bodyKey} or (data) => that object
 *   error             -> {icon,titleKey,bodyKey} or (error) => that object
 *   skeleton()        -> string             optional custom skeleton
 *   loadingKey        -> i18n key announced while loading (default 'msg.loading')
 */
export function createView(host, options) {
  const target = typeof host === 'string' ? document.querySelector(host) : host;
  if (!target) throw new Error(`createView: no host for ${host}`);

  const {
    load,
    render,
    isEmpty = () => false,
    empty = { icon: 'inbox', titleKey: 'msg.empty', bodyKey: 'msg.emptyBody' },
    error = { icon: 'triangle-alert', titleKey: 'msg.loadFailed', bodyKey: 'msg.loadFailedBody' },
    skeleton = () => defaultSkeleton(),
    loadingKey = 'msg.loading',
  } = options;

  let current = null;
  let token = 0;

  function stateMarkup({ iconName, titleKey, bodyKey = null, extra = '', actions = '' }) {
    const title = titleKey ? t(titleKey) : '';
    const body = bodyKey ? t(bodyKey) : '';
    return `<div class="state" role="status">
        <span class="state__icon">${svg(iconName)}</span>
        <p class="state__title">${escapeHtml(title)}</p>
        ${body ? `<p class="state__body">${escapeHtml(body)}</p>` : ''}
        ${extra}
        ${actions ? `<div class="state__actions">${actions}</div>` : ''}
      </div>`;
  }

  function paintLoading() {
    target.setAttribute('aria-busy', 'true');
    target.innerHTML = skeleton();
    /* Announced once, not once per shimmering bar. */
    target.setAttribute('aria-label', t(loadingKey));
  }

  function paintEmpty(data) {
    target.removeAttribute('aria-busy');
    target.removeAttribute('aria-label');
    const spec = typeof empty === 'function' ? empty(data) : empty;
    target.innerHTML = stateMarkup({
      iconName: spec.icon || 'inbox',
      titleKey: spec.titleKey,
      bodyKey: spec.bodyKey,
      extra: spec.extra || '',
      actions: spec.actions || '',
    });
    spec.onMount?.(target);
  }

  function paintSuccess(data) {
    target.removeAttribute('aria-busy');
    target.removeAttribute('aria-label');
    target.innerHTML = render(data);
  }

  function paintError(err) {
    target.removeAttribute('aria-busy');
    target.removeAttribute('aria-label');
    const spec = typeof error === 'function' ? error(err) : error;
    /* Retry always re-runs the same loader, so a transient failure needs one click. */
    const actions = `<button class="btn btn--primary" type="button" data-view-retry>${svg('refresh-cw')}
        <span>${escapeHtml(t('action.retry'))}</span></button>`;
    /* The server's own sentence is more useful than generic wording, and it is
       escaped like any other user-visible string. */
    const detail = err?.message ? `<p class="state__body">${escapeHtml(err.message)}</p>` : '';
    target.innerHTML = stateMarkup({
      iconName: spec.icon || 'triangle-alert',
      titleKey: spec.titleKey || 'msg.loadFailed',
      bodyKey: null,
      extra: (spec.extra || '') + detail,
      actions: spec.actions ? spec.actions + actions : actions,
    });
    target.querySelector('[data-view-retry]')?.addEventListener('click', () => view.reload());
    spec.onMount?.(target, err);
  }

  const view = {
    /** Runs the loader and paints whichever state the result calls for. */
    async reload() {
      const mine = ++token;
      paintLoading();
      try {
        const data = await load();
        /* A slower earlier request must never overwrite a newer result. */
        if (mine !== token) return null;
        current = data;
        if (isEmpty(data)) paintEmpty(data);
        else paintSuccess(data);
        return data;
      } catch (err) {
        if (mine !== token) return null;
        paintError(err);
        return null;
      }
    },

    /** Paints already-fetched data without a network call. */
    set(data) {
      token += 1;
      current = data;
      if (isEmpty(data)) paintEmpty(data);
      else paintSuccess(data);
    },

    /** Repaints the last render, e.g. after a row was toggled in place. */
    update(mutator) {
      if (current == null) return;
      mutator(current);
      paintSuccess(current);
    },

    /** Repaints in the other language. */
    refresh() {
      if (current == null) return;
      if (isEmpty(current)) paintEmpty(current);
      else paintSuccess(current);
    },

    get data() {
      return current;
    },

    destroy() {
      activeViews.delete(unsubscribe);
      token += 1;
    },
  };

  const unsubscribe = onLanguageChange(() => view.refresh());
  activeViews.add(unsubscribe);
  return view;
}

/** Re-render every live view. Called by the shell after a language switch. */
export function refreshViews() {
  for (const refresh of [...activeViews]) refresh();
}

/**
 * A stats strip that also honours the four states. Shared because the admin
 * dashboard and the student dashboard need exactly this shape.
 */
export function statGrid(stats = []) {
  return `<div class="stat-grid">${stats
    .map(
      ([value, label, tone = '']) => `<div class="stat${tone ? ` stat--${tone}` : ''}">
        <span class="stat__value">${escapeHtml(value)}</span>
        <span class="stat__label">${escapeHtml(label)}</span>
      </div>`
    )
    .join('')}</div>`;
}
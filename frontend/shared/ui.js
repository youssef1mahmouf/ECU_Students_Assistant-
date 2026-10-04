/**
 * Shared UI primitives: escaping, formatting, and the small DOM helpers every
 * area uses. Everything a page renders through these passes user data through
 * escapeHtml first, so no string built here can inject markup.
 */
import { icon } from '/shared/icons.js';

export { icon };

/** The one place text becomes HTML. Used by every template in the app. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0] || '').join('') || '؟';
}

export function formatDate(value, style = 'medium') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const locale = document.documentElement.lang || 'ar';
  return new Intl.DateTimeFormat(locale, { dateStyle: style, timeStyle: style === 'full' ? 'short' : undefined }).format(date);
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let scaled = value;
  while (scaled >= 1024 && index < units.length - 1) { scaled /= 1024; index += 1; }
  return `${scaled >= 10 || index === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[index]}`;
}

/**
 * Wraps raw icon markup in a sized, accessible <svg>. Decorative by default
 * (aria-hidden): the surrounding button or link carries the real label.
 */
export function svg(name, { size = '1em', label = '' } = {}) {
  const inner = icon(name);
  if (!inner) return '';
  const a11y = label
    ? ` role="img" aria-label="${escapeHtml(label)}"`
    : ' aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"${a11y}>${inner}</svg>`;
}

/** Replace the content of one node. A missing node is not an error worth throwing. */
export function mount(selector, html) {
  const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (node) node.innerHTML = html;
  return node;
}

/** Set (or clear) a status line under a form. Empty text hides the element. */
export function showMessage(id, text, type = 'info') {
  const node = typeof id === 'string' ? document.getElementById(id) : id;
  if (!node) return;
  node.textContent = text || '';
  node.className = 'message' + (text ? ` message--${type === 'error' ? 'error' : type === 'info' ? 'info' : 'success'}` : '');
}

/**
 * Puts a button into and out of its busy state, remembering its label. Keeps the
 * button's original icon so a busy spinner does not blank the control.
 */
export function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.label) {
      button.dataset.label = button.innerHTML;
      button.dataset.width = String(button.getBoundingClientRect().width);
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    /* Inline-block + a measured width stops the surrounding layout jumping when
       the label is swapped for "Saving…". */
    button.style.minWidth = `${button.dataset.width}px`;
    button.textContent = busyText || 'جارٍ التنفيذ…';
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.style.minWidth = '';
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

function toastRegion() {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Transient confirmation. Polite live region, so it never interrupts a screen
 * reader mid-sentence; the message also stays long enough to be read.
 */
export function toast(message, type = 'info', { timeout = 4200 } = {}) {
  const region = toastRegion();
  const item = document.createElement('p');
  item.className = `toast toast--${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  const glyph = type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'info';
  item.innerHTML = `${svg(glyph)}<span>${escapeHtml(message)}</span>`;
  region.appendChild(item);
  window.setTimeout(() => {
    item.classList.add('toast--leaving');
    window.setTimeout(() => item.remove(), 300);
  }, timeout);
}

/** Kept as a wrapper so a custom dialog can replace native confirm in one place. */
export function confirmDialog(message) {
  return window.confirm(message);
}

/** Debounce for search boxes: 200ms is below the ~300ms perceptual "instant" threshold. */
export function debounce(fn, wait = 200) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}
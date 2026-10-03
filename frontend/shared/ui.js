/** Small DOM helpers. Every value that reaches innerHTML passes through escapeHtml. */

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
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return words.map((word) => word[0] || '').join('') || '؟';
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const locale = document.documentElement.lang || 'ar';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** Replace the content of one node; a missing node is not an error worth throwing. */
export function mount(selector, html) {
  const node = document.querySelector(selector);
  if (node) node.innerHTML = html;
  return node;
}

export function showMessage(id, text, type = 'info') {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text || '';
  node.className = `message${text ? ` message--${type === 'error' ? 'error' : 'success'}` : ''}`;
}

export function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = true;
    button.textContent = busyText || 'جارٍ التنفيذ…';
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
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

export function toast(message, type = 'info', { timeout = 3800 } = {}) {
  const region = toastRegion();
  const item = document.createElement('p');
  item.className = `toast toast--${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => {
    item.classList.add('toast--out');
    window.setTimeout(() => item.remove(), 300);
  }, timeout);
}

/** Kept as a wrapper so a custom dialog can replace native confirm in one place. */
export function confirmDialog(message) {
  return window.confirm(message);
}

export function setLoading(selector, text = 'جار التحميل…') {
  mount(selector, `<p class="empty">${escapeHtml(text)}</p>`);
}


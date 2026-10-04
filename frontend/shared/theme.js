/**
 * Appearance settings: colour mode, density and motion.
 *
 * Three colour modes are offered - light, dark and system - and the choice is
 * kept in localStorage. That is deliberate and it is safe: the value is a
 * display preference, not a secret, and it never contains anything about the
 * session or the account. No token, key or identifier is written here.
 *
 * The resolved mode is applied as `data-theme` on <html>. Because tokens.css is
 * the only file that owns a colour, that one attribute re-themes every page -
 * there is no per-component dark-mode rule anywhere in the application.
 *
 * shared/shell.js imports this module on every page, so the preference is in
 * place before the first paint.
 */
import { t, onLanguageChange } from '/shared/i18n.js';

const THEME_KEY = 'ecu.appearance';
const THEMES = ['light', 'dark', 'system'];

function readStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    return {
      theme: THEMES.includes(raw.theme) ? raw.theme : 'system',
      density: raw.density === 'compact' ? 'compact' : 'comfortable',
      motion: raw.motion === 'reduced' ? 'reduced' : 'full',
    };
  } catch {
    /* Private mode or a corrupted entry: fall back to the OS preference. */
    return { theme: 'system', density: 'comfortable', motion: 'full' };
  }
}

const settings = readStored();
const listeners = new Set();

const systemPrefersDark = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What the page should actually paint right now. */
export function resolvedTheme() {
  if (settings.theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return settings.theme;
}

function write() {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(settings));
  } catch {
    /* Storage blocked: the choice still applies for this page load. */
  }
}

function paint() {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolvedTheme());
  root.setAttribute('data-density', settings.density);
  if (settings.motion === 'reduced' || prefersReducedMotion()) root.setAttribute('data-motion', 'reduced');
  else root.removeAttribute('data-motion');

  /* Keeps the mobile browser chrome in step with the page. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const surface = getComputedStyle(root).getPropertyValue('--color-canvas').trim();
    if (surface) meta.setAttribute('content', surface);
  }
}

/** Repaint and tell listeners. `changed` names what moved, so a control can follow. */
function commit(changed) {
  paint();
  for (const listener of listeners) {
    try {
      listener(appearance(), changed);
    } catch (error) {
      console.error('[appearance] listener failed', error);
    }
  }
}
export function setTheme(next) {
  if (!THEMES.includes(next) || settings.theme === next) return appearance();
  settings.theme = next;
  write();
  commit('theme');
  return appearance();
}

export function cycleTheme() {
  const order = ['light', 'dark', 'system'];
  return setTheme(order[(order.indexOf(settings.theme) + 1) % order.length]);
}

export function setDensity(next) {
  const value = next === 'compact' ? 'compact' : 'comfortable';
  if (settings.density === value) return appearance();
  settings.density = value;
  write();
  commit('density');
  return appearance();
}

export function setMotion(next) {
  const value = next === 'reduced' ? 'reduced' : 'full';
  if (settings.motion === value) return appearance();
  settings.motion = value;
  write();
  commit('motion');
  return appearance();
}

/** The current preferences plus what they resolve to, for the settings page. */
export function appearance() {
  return {
    ...settings,
    resolved: resolvedTheme(),
    systemDark: systemPrefersDark(),
    systemReducedMotion: prefersReducedMotion(),
  };
}

export function onAppearanceChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* Follow the OS while the choice is `system`, so a user who has not chosen sees
   the machine switch with the sun. Once they pick light or dark the stored
   choice wins and this listener no longer changes anything. */
if (typeof window.matchMedia === 'function') {
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (settings.theme === 'system') commit('theme');
  };
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', onChange);
  else if (darkQuery.addListener) darkQuery.addListener(onChange);
}

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
const MOON = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
const SYSTEM = '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>';

function paintToggle(button) {
  const current = appearance();
  const labels = { light: 'theme.light', dark: 'theme.dark', system: 'theme.system' };
  const label = t(labels[current.theme]);
  const glyph = current.theme === 'light' ? SUN : current.theme === 'dark' ? MOON : SYSTEM;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML =
    `<svg viewBox="0 0 24 24" width="1.15rem" height="1.15rem" aria-hidden="true" focusable="false">${glyph}</svg>` +
    `<span class="visually-hidden">${label}</span>`;
}

/* Language changes repaint the appearance control's own labels. */
onLanguageChange(() => {
  for (const button of document.querySelectorAll('[data-appearance-toggle]')) paintToggle(button);
});

/**
 * The topbar appearance button. One control cycles light -> dark -> system, so the
 * active mode is always visible in both its glyph and its tooltip.
 */
export function mountAppearanceToggle(button = document.getElementById('appearanceToggle')) {
  if (!button || button.dataset.wired) return;
  button.dataset.wired = '1';
  button.addEventListener('click', () => cycleTheme());
  paintToggle(button);
}

paint();
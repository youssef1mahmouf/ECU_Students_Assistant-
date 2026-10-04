/**
 * Applies the saved appearance before the first paint.
 *
 * This is the ONLY classic (non-module) script in the frontend. It has to be
 * classic and it has to be synchronous in <head>, because a module is deferred:
 * by the time `shared/theme.js` runs, the browser has already painted the page
 * with the light palette, and every dark-mode user would see a white flash on
 * every navigation.
 *
 * It is loaded from this origin, so `script-src 'self'` is satisfied - there is
 * no inline script anywhere in the project.
 *
 * This file only READS the preference and writes three attributes on <html>.
 * All further state lives in shared/theme.js.
 */
(function applyAppearance() {
  var root = document.documentElement;
  var theme = 'system';
  var density = 'comfortable';
  var motion = 'full';
  try {
    var raw = JSON.parse(localStorage.getItem('ecu.appearance') || '{}');
    if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system') theme = raw.theme;
    if (raw.density === 'compact') density = 'compact';
    if (raw.motion === 'reduced') motion = 'reduced';
  } catch (error) {
    /* Private mode or a corrupted entry: fall back to the system preference. */
  }

  var dark = theme === 'dark' || (theme === 'system'
    && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-density', density);
  if (motion === 'reduced'
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    root.setAttribute('data-motion', 'reduced');
  }
  root.style.colorScheme = dark ? 'dark' : 'light';
}());

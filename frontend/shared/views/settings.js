/**
 * Display preferences, shared by /user/settings/ and /admin/settings/.
 *
 * One implementation for both areas, because appearance and language behave
 * identically for a student and an administrator - having two copies is how they
 * would eventually disagree.
 *
 * Nothing on this page is a security setting. Appearance and language are stored
 * in localStorage by shared/theme.js and shared/i18n.js, never sent to the
 * server, and they cannot grant or remove access to anything.
 */
import { setLanguage, language } from '/shared/i18n.js';
import {
  appearance,
  setTheme,
  setDensity,
  setMotion,
  onAppearanceChange,
} from '/shared/theme.js';

/* The same three glyphs the topbar button draws, so the two always agree. */
const GLYPHS = {
  light: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>',
  dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>',
  system: '<rect width="20" height="14" x="2" y="3" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
};

/** Wires the preference controls on the current page and keeps them in sync. */
export function mountSettings({ onLanguageChange } = {}) {
  for (const holder of document.querySelectorAll('[data-theme-icon]')) {
    holder.innerHTML = `<svg viewBox="0 0 24 24" width="1.35rem" height="1.35rem"
      aria-hidden="true" focusable="false">${GLYPHS[holder.dataset.themeIcon]}</svg>`;
  }

  const bind = (hostId, name, handler) => {
    const host = document.getElementById(hostId);
    host?.addEventListener('change', (event) => {
      if (event.target.name === name) handler(event.target.value);
    });
  };

  bind('themeOptions', 'theme', setTheme);
  bind('densityOptions', 'density', setDensity);
  bind('motionOptions', 'motion', setMotion);
  bind('languageOptions', 'uilanguage', (value) => {
    setLanguage(value);
    onLanguageChange?.();
  });

  /** Reflects the stored preference back into the controls. */
  function sync() {
    const current = appearance();

    for (const input of document.querySelectorAll('input[name="theme"]')) {
      const active = input.value === current.theme;
      input.checked = active;
      input.closest('.tile, .segmented__option')?.classList.toggle('is-selected', active);
      input.closest('.segmented__option')?.classList.toggle('is-active', active);
    }
    for (const name of ['density', 'motion', 'uilanguage']) {
      for (const input of document.querySelectorAll(`input[name="${name}"]`)) {
        const active = input.value === (name === 'uilanguage' ? language() : current[name]);
        input.checked = active;
        input.closest('.segmented__option')?.classList.toggle('is-active', active);
      }
    }
  }

  onAppearanceChange(sync);
  sync();
  return { sync };
}

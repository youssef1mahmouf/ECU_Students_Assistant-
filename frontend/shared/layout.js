/**
 * Compatibility name for the application shell.
 *
 * `shared/layout.js` used to hold the header, the navigation table and the theme
 * toggle all at once, and every page imported it by that path. The chrome now
 * lives in `shared/shell.js` together with the sidebar and the notification bell,
 * and the route table lives in `shared/nav.js`.
 *
 * This re-export exists so existing page modules and the page smoke test keep
 * working against one implementation rather than two. New code should import
 * `shared/shell.js` directly.
 */
export {
  bootChrome,
  refreshChrome,
  shellState,
  shellState as chrome,
} from '/shared/shell.js';

export { navigationFor, sidebarSectionsFor, topbarIdsFor } from '/shared/nav.js';
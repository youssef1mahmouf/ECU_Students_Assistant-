'use strict';
/**
 * Multi-group helpers shared by routes, services and the store adapters.
 *
 * Content records and documents carry `groups: string[]`. Older rows only have the
 * single `group` field; both shapes are read through `groupsOf()` so existing data
 * keeps working without a destructive rewrite.
 */

/** The list of group names a record/document belongs to (legacy single value included). */
function groupsOf(row) {
  if (!row) return [];
  if (Array.isArray(row.groups)) {
    const list = row.groups.filter((name) => typeof name === 'string' && name !== '');
    if (list.length) return list;
  }
  return typeof row.group === 'string' && row.group !== '' ? [row.group] : [];
}

/** Does this row belong to `group`? Used for scoping reads to one group. */
function inGroups(row, group) {
  if (!group) return false;
  return groupsOf(row).includes(group);
}

/**
 * The canonical single value kept next to `groups` for backwards compatibility
 * (old readers, indexes and exports): the first assigned group.
 */
function primaryGroup(groups) {
  return Array.isArray(groups) && groups.length ? groups[0] : '';
}

module.exports = { groupsOf, inGroups, primaryGroup };

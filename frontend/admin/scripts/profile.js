import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, initials, showMessage, setBusy } from '/shared/ui.js';
import { t, onLanguageChange } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'profile' });

// The editable display name is never the roster identity; it defaults to the
// account's short name and is the value the server accepts on update.
function resultName(userToPaint) {
  return userToPaint.name || '';
}

function formatText(value) {
  if (!value) return t('msg.neverSignedIn');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
  return new Intl.DateTimeFormat(document.documentElement.lang || 'ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function paintMeta(user) {
  document.getElementById('profileMeta').textContent =
    `${user.email} · ${t(`role.${user.role}`)} · ${t('msg.lastLogin', { time: formatText(user.lastLoginAt) })}`;
}

if (session) {
  const user = session.user;
  const rosterNameFor = (userToPaint) => userToPaint.rosterName || user.rosterName || '';

  // "Full name" rendering for Account Details: full roster name first, falling
  // back to the user's short display name only when the roster name is absent.
  document.getElementById('profileAvatar').textContent = initials(user.name);
  document.getElementById('profileName').textContent = rosterNameFor(user) || user.name || '-';
  paintMeta(user);
  document.getElementById('profileInputName').value = resultName(user);
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profileRosterName').value = rosterNameFor(user);

  const profileForm = document.getElementById('profileForm');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(new FormData(profileForm).get('name') || '').trim();
    const button = document.getElementById('profileSubmit');
    setBusy(button, true, t('msg.saving'));
    try {
      const result = await api.patch('/api/user/profile', { name });
      showMessage('profileMessage', t('msg.profileSaved'), 'success');
      // Roster identity stays untouched: only refresh the short display name.
      document.getElementById('profileInputName').value = resultName(result?.user || { name });
      document.getElementById('profileName').textContent = rosterNameFor(result?.user || {}) || result?.user?.name || name;
    } catch (error) {
      showMessage('profileMessage', error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  });

  const passwordForm = document.getElementById('passwordForm');
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(passwordForm);
    const button = document.getElementById('passwordSubmit');
    setBusy(button, true, t('msg.saving'));
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: String(data.get('currentPassword') || ''),
        newPassword: String(data.get('newPassword') || ''),
      });
      passwordForm.reset();
      showMessage('passwordMessage', t('msg.passwordChangedElsewhere'), 'success');
      toast(t('msg.passwordChanged'), 'success');
    } catch (error) {
      showMessage('passwordMessage', error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  });

  /* A language switch rewrites the role and the "last sign-in" line, not just the labels. */
  onLanguageChange(() => paintMeta(user));
}

import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, initials, showMessage, setBusy } from '/shared/ui.js';
import { requireSignIn } from '/shared/session.js';
import { t } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'profile' });
const session = await requireSignIn({ redirectTo: '/user/signin/' });

if (!session) {
  // requireSignIn already started the redirect; stop rendering.
} else {
  const user = session.user;

  // The user's full roster name exactly as it appears in the official class
  // lists (including the imported roster PDF); display logic like avatars and
  // initials may keep using the user's short display name.
  const rosterNameFor = (userToPaint) => userToPaint.rosterName || user.rosterName || '';

  // "Full name" rendering for Account Details: full roster name first, falling
  // back to the user's short display name only when the roster name is absent.
  function paint(userToPaint) {
    const fullName = rosterNameFor(userToPaint) || userToPaint.name || '-';
    document.getElementById('profileAvatar').textContent = initials(userToPaint.name);
    document.getElementById('profileName').textContent = fullName;
    document.getElementById('profileMeta').textContent =
      `${userToPaint.email} · ${userToPaint.group || '-'} · ${userToPaint.role}`;
    document.getElementById('profileInputName').value = resultName(userToPaint);
    document.getElementById('profileEmail').value = userToPaint.email || '';
    document.getElementById('profileRosterName').value = rosterNameFor(userToPaint);
  }

  // The editable display name never becomes the full roster name; keep whatever
  // the user actually typed as their short display name.
  function resultName(userToPaint) {
    return userToPaint.name || '';
  }

  paint(user);

  document.querySelectorAll('.admin-only').forEach((node) => {
    node.hidden = !user.permissions?.canAccessAdmin;
  });

  const profileForm = document.getElementById('profileForm');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(new FormData(profileForm).get('name') || '').trim();
    const button = document.getElementById('profileSubmit');
    setBusy(button, true, 'جارٍ الحفظ…');
    try {
      const result = await api.patch('/api/user/profile', { name });
      showMessage('profileMessage', t('msg.saved'), 'success');
      paint({ ...result?.user });
      sessionStorage.removeItem('ecu.session');
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
    setBusy(button, true, 'جارٍ الحفظ…');
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: String(data.get('currentPassword') || ''),
        newPassword: String(data.get('newPassword') || ''),
      });
      passwordForm.reset();
      showMessage('passwordMessage', 'تم تغيير كلمة المرور. سجّل الدخول من جديد.', 'success');
      window.setTimeout(() => window.location.replace('/user/signin/'), 1400);
    } catch (error) {
      showMessage('passwordMessage', error.message, 'error');
    } finally {
      setBusy(button, false);
    }
  });
}

/**
 * /user/profile/ - the account's own details.
 *
 * Only the display name is writable. Everything else on this page is shown as a
 * read-only fact, because the server will not accept it from the browser and a
 * disabled input implies the value might still change.
 */
import { bootChrome, refreshChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { escapeHtml, initials, showMessage, setBusy, toast } from '/shared/ui.js';
import { requireSignIn, currentUser } from '/shared/session.js';
import { t, serverText } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'profile' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

const initial = currentUser();

function fact(label, value, dir) {
  return `<div class="definition-grid__item">
      <span class="definition-grid__label">${escapeHtml(label)}</span>
      <span class="definition-grid__value"${dir ? ` dir="${dir}"` : ''}>${escapeHtml(value || '-')}</span>
    </div>`;
}

/** Paints the read-only identity facts. Nothing here is editable, on purpose. */
function paintFacts(user) {
  document.getElementById('profileName').textContent = user.rosterName || user.name || '-';
  document.getElementById('identityFacts').innerHTML = [
    fact(t('field.name'), user.name),
    fact(t('profile.rosterName'), user.rosterName || '-'),
    fact(t('field.email'), user.email, 'ltr'),
    fact(t('field.group'), user.group || '-', 'auto'),
    fact(t('field.studentId'), user.studentId),
    fact(t('field.role'), t(`role.${user.role}`)),
    fact(t('field.status'), user.confirmed ? t('state.confirmed') : t('user.needApproval')),
    user.advisorName ? fact(t('field.advisor'), user.advisorName) : '',
  ].join('');
}

paintFacts(initial);
document.getElementById('profileInputName').value = initial.name || '';
document.getElementById('profileAdminLink').hidden = !initial.permissions?.canAccessAdmin;

/* ----------------------------------------------------------- save the name */

document.getElementById('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('profileSubmit');
  const name = document.getElementById('profileInputName').value.trim();

  setBusy(button, true, t('msg.saving'));
  showMessage('profileMessage', '');
  try {
    const result = await api.patch('/api/user/profile', { name });
    showMessage('profileMessage', t('profile.saved'), 'success');
    /* Redraw the chrome so the account menu shows the new name immediately, and
       re-read the profile so the page agrees with the server. */
    refreshChrome();
    const fresh = await api.get('/api/user/profile');
    paintFacts({ ...fresh.user, permissions: initial.permissions });
    toast(t('profile.saved'), 'success');
    return result;
  } catch (error) {
    showMessage('profileMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

/* --------------------------------------------------------- change password */

document.getElementById('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('passwordSubmit');
  setBusy(button, true, t('msg.saving'));
  showMessage('passwordMessage', '');
  try {
    await api.post('/api/auth/change-password', {
      currentPassword: document.getElementById('currentPassword').value,
      newPassword: document.getElementById('newPassword').value,
    });
    event.target.reset();
    showMessage('passwordMessage', t('profile.passwordChanged'), 'success');
    toast(t('profile.passwordChanged'), 'success');
    /* The server ends every other session, including this one; give the reader
       a moment to read the confirmation before the redirect. */
    window.setTimeout(() => window.location.replace('/user/signin/'), 1600);
  } catch (error) {
    showMessage('passwordMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

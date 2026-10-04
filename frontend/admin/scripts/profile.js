/**
 * /admin/profile/ - the signed-in staff member's own account.
 *
 * Same component as the student profile, in the same shell: identity as
 * read-only facts, a name form, and a password form. Nothing privileged is
 * editable here - roles and other accounts live in /admin/accounts/.
 */
import { bootAdmin, refreshChrome } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, showMessage, setBusy, toast } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';
import { currentUser } from '/shared/session.js';

const session = await bootAdmin({ active: 'profile' });
if (!session) throw new Error('redirecting');

const initial = currentUser();

function fact(label, value, dir) {
  return `<div class="definition-grid__item">
      <span class="definition-grid__label">${escapeHtml(label)}</span>
      <span class="definition-grid__value"${dir ? ` dir="${dir}"` : ''}>${escapeHtml(value || '-')}</span>
    </div>`;
}

function paint(user) {
  document.getElementById('identityFacts').innerHTML = [
    fact(t('field.name'), user.name),
    fact(t('profile.rosterName'), user.rosterName || '-'),
    fact(t('field.email'), user.email, 'ltr'),
    fact(t('field.group'), user.group || '-', 'auto'),
    fact(t('field.role'), t(`role.${user.role}`)),
    fact(t('field.status'), user.active === false ? t('state.inactive') : t('state.active')),
  ].join('');
}

paint(initial);
document.getElementById('profileInputName').value = initial.name || '';

document.getElementById('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('profileSubmit');
  setBusy(button, true, t('msg.saving'));
  showMessage('profileMessage', '');
  try {
    await api.patch('/api/user/profile', { name: document.getElementById('profileInputName').value.trim() });
    refreshChrome();
    paint({ ...initial, name: document.getElementById('profileInputName').value.trim() });
    showMessage('profileMessage', t('profile.saved'), 'success');
    toast(t('profile.saved'), 'success');
  } catch (error) {
    showMessage('profileMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

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
    window.setTimeout(() => window.location.replace('/user/signin/'), 1600);
  } catch (error) {
    showMessage('passwordMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});

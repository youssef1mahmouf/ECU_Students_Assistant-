function renderRegister() {
            const groupOptions = data.groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
            userContent.innerHTML = `<p class="eyebrow">${text('حساب جديد')}</p><h2>${text('إنشاء حساب مستخدم')}</h2><p class="subtext">${text('أنشئ بياناتك، ثم سجّل الدخول للمتابعة.')}</p><form id="registerForm"><div class="form-grid"><div class="field"><label for="newName">${text('الاسم')}</label><input id="newName" name="name" maxlength="80" required></div><div class="field"><label for="newEmail">${text('البريد الإلكتروني')}</label><input id="newEmail" name="email" type="email" placeholder="${text('مثال: 192600250@ecu.edu.eg')}" required></div><div class="field"><label for="newGroup">${text('المجموعة')}</label><select id="newGroup" name="group" required>${groupOptions}</select></div><div class="field full"><label for="newPassword">${text('كلمة المرور')}</label><input id="newPassword" name="password" type="password" minlength="4" required></div></div><div class="actions"><button class="btn" type="submit">${text('إنشاء الحساب')}</button><button class="link-button" id="showLogin" type="button">${text('لدي حساب بالفعل')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
            document.getElementById('showLogin').addEventListener('click', () => { window.location.href = pageUrl('signin'); });
            document.getElementById('registerForm').addEventListener('submit', registerUser);
      updateHeader();
      translatePage();
    }

    renderRegister();

    function registerUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name')).trim();
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      const selectedGroup = String(form.get('group'));
      const message = document.getElementById('userMessage');
      if (!name || !email || !password) return showMessage(message, text('يرجى ملء جميع الحقول.'), 'error');
      if (!/^[^@\s]+@ecu\.edu\.eg$/i.test(email)) return showMessage(message, text('يجب أن ينتهي البريد بـ @ecu.edu.eg.'), 'error');
      if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(password)) return showMessage(message, text('كلمة المرور يجب أن تحتوي على حرف كبير ورقم ورمز مثل @.'), 'error');
      if (data.users.some(user => user.name.toLowerCase() === name.toLowerCase())) return showMessage(message, text('الاسم مستخدم بالفعل.'), 'error');
      if (!data.groups.includes(selectedGroup)) return showMessage(message, text('المجموعة المحددة غير متاحة.'), 'error');
      data.users.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, email, password, selectedGroup, confirmed: true });
      data.activity.push({ actor: name, action: `Created account and joined ${selectedGroup}.`, createdAt: new Date().toISOString() });
      if (!saveData()) return showMessage(message, text('تعذر حفظ التغيير في هذا المتصفح.'), 'error');
      setFlash('success', text('تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.'));
      window.location.href = pageUrl('signin');
    }

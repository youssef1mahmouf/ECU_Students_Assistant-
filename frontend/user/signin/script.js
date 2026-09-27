function renderSignIn() {
            userContent.innerHTML = `<p class="eyebrow">${text('دخول المستخدم')}</p><h2>${text('سجّل الدخول إلى حسابك')}</h2><p class="subtext">${text('أدخل البريد الإلكتروني وكلمة المرور التي أنشأتها.')}</p><form id="userLoginForm"><div class="field"><label for="loginEmail">${text('البريد الإلكتروني')}</label><input id="loginEmail" name="email" type="email" required></div><div class="field" style="margin-top:13px"><label for="loginPassword">${text('كلمة المرور')}</label><input id="loginPassword" name="password" type="password" required></div><label style="display:flex;align-items:center;gap:8px;margin-top:13px"><input type="checkbox" name="remember" style="width:auto;min-height:0">${text('تذكرني')} (${text('تسجيل الدخول حتى تسجيل الخروج')})</label><div class="actions"><button class="btn" type="submit">${text('تسجيل الدخول')}</button><button class="link-button" id="showRegister" type="button">${text('إنشاء حساب جديد')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
            document.getElementById('showRegister').addEventListener('click', () => { window.location.href = pageUrl('register'); });
            document.getElementById('userLoginForm').addEventListener('submit', loginUser);
      renderFlash(document.getElementById('userMessage'));
      updateHeader();
      translatePage();
    }

    if (currentUser()) { window.location.href = pageUrl('profile'); } else { renderSignIn(); }

    function loginUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      const user = data.users.find(item => item.email === email && item.password === password);
      if (!user) return showMessage(document.getElementById('userMessage'), text('اسم الدخول أو كلمة المرور غير صحيحة.'), 'error');
      activeUserId = user.id;
      localStorage.setItem(SESSION_KEY, user.id);
      window.location.href = pageUrl('profile');
    }

    // بيانات الدخول هذه للتجربة فقط؛ لا تضع أسرارًا حقيقية في صفحة عامة.
    const ADMIN_NAME = 'Youssef';
    const ADMIN_EMAIL = '192600250@ecu.edu.eg';
    const ADMIN_PASSWORD = 'Youssef@552008';
    const STORAGE_KEY = 'groupPortalDataV2';
    const SESSION_KEY = 'groupPortalRememberedUserV1';
    const SUPER_ADMIN_EMAIL = '192600250@ecu.edu.eg';
    const SUPER_ADMIN_PASSWORD = 'Youssef@552008';
    const LANGUAGE_KEY = 'groupPortalLanguageV1';
    const currentLanguage = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ar';
    const translations = {
      'بوابة المجموعات': 'Group Portal', 'إدارة بسيطة للحسابات والمجموعات': 'Simple account and group management', 'نسخة تجريبية · تخزين محلي': 'Demo version · Local storage',
      'بوابة الدخول': 'Access portal', 'أهلًا بك في مساحة مجموعتك': 'Welcome to your group space', 'سجّل الدخول أو أنشئ حسابًا، ثم اختر المجموعة المناسبة لك.': 'Sign in or create an account, then choose the right group for you.', 'الرئيسية': 'Home', 'تسجيل الدخول': 'Sign in', 'الملف الشخصي': 'Profile',
      'نوع الدخول': 'Access type', 'قسم المستخدم': 'User section', 'قسم الأدمن': 'Admin section', 'ملاحظة حول البيانات': 'About your data',
      'تُحفظ الحسابات والمجموعات والاختيارات في localStorage على هذا المتصفح والجهاز فقط. قد تُحذف عند مسح بيانات المتصفح، ولا تتم مزامنتها مع أجهزة أخرى.': 'Accounts, groups, and choices are stored in localStorage on this browser and device only. They may be deleted when browser data is cleared and are not synced across devices.',
      'هذه نسخة تجريبية؛ كلمات المرور مخزنة محليًا وليست محمية. لا تستخدم بيانات حقيقية أو حساسة.': 'This is a demo; passwords are stored locally and are not protected. Do not use real or sensitive data.',
      'تنبيه أمني': 'Security notice', 'تسجيل دخول الأدمن هنا تجريبي فقط؛ بيانات الدخول موجودة داخل كود الصفحة ويمكن لأي شخص الاطلاع عليها.': 'Admin sign-in is for demo purposes only; the credentials are included in the page code and can be viewed by anyone.',
      'للنشر والاستخدام الحقيقي، يلزم خادم آمن وقاعدة بيانات مركزية مع مصادقة وصلاحيات مناسبة. لا يوفر هذا الملف حماية حقيقية.': 'Real deployment requires a secure server and a central database with proper authentication and permissions. This file does not provide real security.',
      'تُحفظ التغييرات تلقائيًا في المتصفح الحالي فقط.': 'Changes are saved automatically in the current browser only.', 'حساب المستخدم': 'User account', 'تسجيل الخروج': 'Sign out', 'تم تسجيل الدخول': 'Signed in',
      'هذه بيانات حسابك ومجموعتك الحالية.': 'Here are your account and current group details.', 'المجموعة: ': 'Group: ', 'تغيير المجموعة': 'Change group', 'حساب جديد': 'New account', 'إنشاء حساب مستخدم': 'Create a user account',
      'أنشئ بياناتك، ثم سجّل الدخول للمتابعة.': 'Create your details, then sign in to continue.', 'الاسم': 'Name', 'اسم الدخول': 'Username', 'كلمة المرور': 'Password', 'إنشاء الحساب': 'Create account', 'لدي حساب بالفعل': 'I already have an account',
      'دخول المستخدم': 'User sign-in', 'سجّل الدخول إلى حسابك': 'Sign in to your account', 'أدخل اسم الدخول وكلمة المرور التي أنشأتها.': 'Enter the username and password you created.', 'تسجيل الدخول': 'Sign in', 'إنشاء حساب جديد': 'Create a new account',
      'مرحبًا، ': 'Welcome, ', 'اختيار المجموعة': 'Group selection', 'اختر مجموعتك': 'Choose your group', 'راجع اختيارك وأكّده للدخول إلى صفحة المستخدم.': 'Review and confirm your choice to enter the user page.', 'المجموعات المتاحة': 'Available groups',
      'لا توجد مجموعات متاحة': 'No groups available', 'تأكيد المجموعة': 'Confirm group', 'لا توجد مجموعة متاحة حاليًا. تواصل مع الأدمن.': 'No group is currently available. Contact the admin.', 'هذه المجموعة لم تعد متاحة. اختر مجموعة أخرى.': 'This group is no longer available. Choose another group.',
      'إدارة البوابة': 'Portal management', 'دخول الأدمن': 'Admin sign-in', 'أدخل بيانات الدخول التجريبية لفتح أدوات الإدارة.': 'Enter the demo credentials to open the management tools.', 'البريد الإلكتروني': 'Email',
      'إدارة الحسابات والمجموعات': 'Manage accounts and groups', 'إضافة مجموعة': 'Add group', 'تعديل المجموعة: ': 'Edit group: ', 'اسم المجموعة': 'Group name', 'مثال: GA3': 'Example: GA3', 'حفظ التعديل': 'Save changes', 'إلغاء': 'Cancel',
      'لا توجد مجموعات حاليًا.': 'No groups yet.', 'تعديل حساب مستخدم': 'Edit user account', 'إضافة مستخدم': 'Add user', 'كلمة مرور جديدة (اختياري)': 'New password (optional)', 'المجموعة': 'Group', 'دون مجموعة': 'No group', 'إضافة المستخدم': 'Add user', 'لا يوجد مستخدمون حاليًا.': 'No users yet.',
      'اكتب اسم المجموعة.': 'Enter a group name.', 'هذه المجموعة موجودة بالفعل.': 'That group already exists.', 'تم حفظ المجموعة بنجاح.': 'Group saved successfully.', 'المجموعة المحددة غير متاحة.': 'The selected group is not available.', 'تم حفظ المستخدم بنجاح.': 'User saved successfully.',
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.': 'The email or password is incorrect.', 'اسم الدخول أو كلمة المرور غير صحيحة.': 'The username or password is incorrect.', 'يرجى ملء جميع الحقول.': 'Please fill in all fields.', 'اسم الدخول مستخدم بالفعل.': 'That username is already in use.', 'تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.': 'Account created and saved. You can sign in now.',
      'تعذر حفظ الحساب في هذا المتصفح.': 'Could not save the account in this browser.', 'تعذر حفظ الاختيار في هذا المتصفح.': 'Could not save the choice in this browser.', 'تعذر حفظ التغيير في هذا المتصفح.': 'Could not save the change in this browser.', 'تعذر حفظ المستخدم في هذا المتصفح.': 'Could not save the user in this browser.',
      'تم حذف المجموعة ': 'Group ', ' بنجاح.': ' deleted successfully.', 'هل تريد حذف المجموعة ': 'Delete group ', '؟': '?', 'هل تريد حذف حساب ': 'Delete account '
    };

    function translatePage() {
      if (currentLanguage !== 'en') return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        let text = walker.currentNode.nodeValue;
        Object.keys(translations).sort((a, b) => b.length - a.length).forEach(key => { text = text.split(key).join(translations[key]); });
        walker.currentNode.nodeValue = text;
      }
      document.querySelectorAll('[aria-label], [placeholder]').forEach(element => {
        ['aria-label', 'placeholder'].forEach(attribute => {
          const value = element.getAttribute(attribute);
          if (value && translations[value]) element.setAttribute(attribute, translations[value]);
        });
      });
    }

    function setupLanguage() {
      document.documentElement.lang = currentLanguage;
      document.documentElement.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
      const button = document.getElementById('languageToggle');
      button.textContent = currentLanguage === 'en' ? 'العربية' : 'English';
      button.setAttribute('aria-label', currentLanguage === 'en' ? 'Switch to Arabic' : 'Switch to English');
      button.addEventListener('click', () => { localStorage.setItem(LANGUAGE_KEY, currentLanguage === 'en' ? 'ar' : 'en'); window.location.reload(); });
    }

    // تُضاف المجموعات التجريبية مرة واحدة، ولا تعود إذا حذفها المستخدم لاحقًا.
    function loadData() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.groups) && Array.isArray(parsed.users)) return parsed;
        }
      } catch (error) { console.warn('تعذر قراءة البيانات المحفوظة.', error); }
      const initial = { groups: ['GA1', 'GB1'], users: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    let data = loadData();
    let activeUserId = null;
    let adminSignedIn = false;
    let editingGroup = null;
    let editingUserId = null;
    let userMode = 'login';
    let viewMode = 'signin';
    let editingRecordId = null;
    let activityFilter = 'all';
    let adminNotice = '';
    const userContent = document.getElementById('userContent');
    userContent.addEventListener('click', event => { const button = event.target.closest('[data-open-file]'); if (!button) return; openStoredFile(button.dataset.openFile, Number(button.dataset.fileIndex)); });
    const adminContent = document.getElementById('adminContent');
    const userPanel = document.getElementById('userPanel');
    const adminPanel = document.getElementById('adminPanel');

    function saveData() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
      catch (error) { console.error('تعذر حفظ البيانات.', error); return false; }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    function showMessage(element, text, kind = 'success') {
      element.textContent = text;
      element.className = `message ${kind}`;
    }

    function setRole(role) {
      const isUser = role === 'user';
      document.getElementById('userTab').setAttribute('aria-selected', String(isUser));
      document.getElementById('adminTab').setAttribute('aria-selected', String(!isUser));
      userPanel.classList.toggle('active', isUser);
      adminPanel.classList.toggle('active', !isUser);
      renderUser();
      renderAdmin();
    }

    function renderUser() {
      const currentUser = data.users.find(user => user.id === activeUserId);
      if (currentUser) {
        // تُعاد المجموعة المحذوفة إلى حالة الاختيار، وتُحفظ قبل عرضها للمستخدم.
        if (currentUser.selectedGroup && !data.groups.includes(currentUser.selectedGroup)) {
          currentUser.selectedGroup = '';
          currentUser.confirmed = false;
          saveData();
        }
        if (currentUser.confirmed && currentUser.selectedGroup) {
          userContent.innerHTML = `<div class="session-bar"><span>حساب المستخدم</span><button class="btn secondary small" id="userLogout" type="button">تسجيل الخروج</button></div><p class="eyebrow">تم تسجيل الدخول</p><h2>مرحبًا، ${escapeHtml(currentUser.name)}</h2><p class="subtext">هذه بيانات حسابك ومجموعتك الحالية.</p><div class="profile"><span class="avatar" aria-hidden="true">${escapeHtml(currentUser.name.trim().charAt(0) || 'م')}</span><div><strong>${escapeHtml(currentUser.name)}</strong><p>المجموعة: <span class="group-value">${escapeHtml(currentUser.selectedGroup)}</span></p></div></div><button class="btn secondary" id="changeGroup" type="button">تغيير المجموعة</button><p class="message" id="userMessage" aria-live="polite"></p>`;
          document.getElementById('userLogout').addEventListener('click', () => { activeUserId = null; renderUser(); });
          document.getElementById('changeGroup').addEventListener('click', () => { currentUser.confirmed = false; renderUser(); });
          translatePage();
          return;
        }
        renderGroupChoice(currentUser);
        return;
      }

      if (userMode === 'register') {
        userContent.innerHTML = `<p class="eyebrow">حساب جديد</p><h2>إنشاء حساب مستخدم</h2><p class="subtext">أنشئ بياناتك، ثم سجّل الدخول للمتابعة.</p><form id="registerForm"><div class="form-grid"><div class="field"><label for="newName">الاسم</label><input id="newName" name="name" autocomplete="name" maxlength="80" required></div><div class="field"><label for="newUsername">اسم الدخول</label><input id="newUsername" name="username" autocomplete="username" maxlength="40" required></div><div class="field full"><label for="newPassword">كلمة المرور</label><input id="newPassword" name="password" type="password" autocomplete="new-password" minlength="4" required></div></div><div class="actions"><button class="btn" type="submit">إنشاء الحساب</button><button class="link-button" id="showLogin" type="button">لدي حساب بالفعل</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
        document.getElementById('showLogin').addEventListener('click', () => { userMode = 'login'; renderUser(); });
        document.getElementById('registerForm').addEventListener('submit', registerUser);
      } else {
        userContent.innerHTML = `<p class="eyebrow">دخول المستخدم</p><h2>سجّل الدخول إلى حسابك</h2><p class="subtext">أدخل اسم الدخول وكلمة المرور التي أنشأتها.</p><form id="userLoginForm"><div class="field"><label for="loginUsername">اسم الدخول</label><input id="loginUsername" name="username" autocomplete="username" required></div><div class="field" style="margin-top:13px"><label for="loginPassword">كلمة المرور</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div><div class="actions"><button class="btn" type="submit">تسجيل الدخول</button><button class="link-button" id="showRegister" type="button">إنشاء حساب جديد</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
        document.getElementById('showRegister').addEventListener('click', () => { userMode = 'register'; renderUser(); });
        document.getElementById('userLoginForm').addEventListener('submit', loginUser);
      }
      translatePage();
    }

    function recordActivity(action, metadata = {}) {
      data.activity.push({ actor: 'Main Super Admin', action, createdAt: new Date().toISOString(), ...metadata });
      saveData();
    }

    function renderSuperAdmin(admin) {
      data.records = Array.isArray(data.records) ? data.records : [];
      const users = data.users.map(user => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.role === 'superAdmin' ? 'Super admin' : user.selectedGroup || 'No group')}</small></div></div>`).join('');
      const activityStart = activityFilter === 'day' ? Date.now() - 86400000 : activityFilter === 'week' ? Date.now() - 604800000 : activityFilter === 'month' ? Date.now() - 2592000000 : 0;
      const activity = data.activity.filter(item => new Date(item.createdAt).getTime() >= activityStart).slice().reverse().map(item => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(item.actor)}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'ar-EG'))}</small><div>${escapeHtml(item.action)}</div></div></div>`).join('');
      const groups = data.groups.map(group => { const count = data.records.filter(record => record.group === group).length; return `<article class="group-card"><div><h3>${escapeHtml(group)}</h3><small>${count} ${text('سجل')}</small></div><div class="actions"><button class="btn small" type="button" data-open-group="${escapeHtml(group)}">${text('فتح')}</button><button class="btn secondary small" type="button" data-schedule-group="${escapeHtml(group)}">${text('رفع الجدول')}</button><button class="btn secondary small" type="button" data-edit-group-card="${escapeHtml(group)}">${text('تعديل')}</button><button class="btn danger small" type="button" data-delete-group-card="${escapeHtml(group)}">${text('حذف')}</button></div></article>`; }).join('');
      const sharedGroupOptions = data.groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
      userContent.innerHTML = `<div class="admin-dashboard"><aside class="admin-sidebar"><h3>${text('خيارات الإدارة')}</h3><button type="button" data-admin-scroll="adminGroups">${text('المجموعات')}</button><button type="button" data-admin-scroll="superGroupName">${text('اسم المجموعة')}</button><button type="button" data-admin-scroll="adminProfile">${text('ملف الأدمن')}</button><button type="button" data-admin-scroll="adminInfo">${text('معلومات الأدمن')}</button><button type="button" data-admin-scroll="sharedForm">${text('مشاركة بين المجموعات')}</button></aside><section class="admin-main"><div class="session-bar"><span>${text('لوحة السوبر أدمن')}</span><button class="btn secondary small" id="userLogout" type="button">${text('تسجيل الخروج')}</button></div><p class="eyebrow">${text('تم تسجيل الدخول')}</p><h2 id="adminProfile">${escapeHtml(admin.name)}</h2><p class="subtext" id="adminInfo">${escapeHtml(admin.email)}</p><section class="manage-block" id="adminGroups"><h3>${text('المجموعات')}</h3><div class="group-grid">${groups}</div><form id="superGroupForm" class="compact-form" style="margin-top:14px"><div class="field"><label for="superGroupName">${text('اسم المجموعة')}</label><input id="superGroupName" name="group" maxlength="30" required></div><div class="actions"><button class="btn small" type="submit">${text('حفظ المجموعة')}</button></div><p class="message" id="superGroupMessage" aria-live="polite"></p></form></section><form id="sharedForm" class="manage-block shared-form"><h3>${text('مشاركة بين المجموعات')}</h3><div class="form-grid"><div class="field"><label for="sharedTitle">${text('العنوان')}</label><input id="sharedTitle" name="title" required></div><div class="field"><label for="sharedGroups">${text('المجموعات')}</label><select id="sharedGroups" name="groups" multiple size="3" required>${sharedGroupOptions}</select></div><div class="field"><label for="sharedDate">${text('التاريخ')}</label><input id="sharedDate" name="date" type="date" required></div><div class="field"><label for="sharedTime">${text('الوقت')}</label><input id="sharedTime" name="time" type="time" required></div><div class="field full"><label for="sharedDetails">${text('التفاصيل')}</label><textarea id="sharedDetails" name="details" required></textarea></div><div class="field full"><label for="sharedLinks">${text('روابط الملفات (اختياري، رابط في كل سطر)')}</label><textarea id="sharedLinks" name="links"></textarea></div></div><div class="actions"><button class="btn" type="submit">${text('حفظ ومشاركة')}</button></div><p class="message" id="sharedMessage" aria-live="polite"></p></form></section><aside class="admin-rightbar"><section><h3>${text('الحسابات')} (${data.users.length})</h3><div class="list">${users}</div></section><section style="margin-top:18px"><h3>${text('سجل العمليات')}</h3><div class="list">${activity || `<p class="empty">${text('لا توجد عمليات بعد.')}</p>`}</div></section></aside></div>`;
      const activitySection = userContent.querySelector('.admin-rightbar section:last-child');
      activitySection.querySelector('h3').insertAdjacentHTML('afterend', `<div class="actions"><button class="btn secondary small" data-activity-filter="all">${text('الكل')}</button><button class="btn secondary small" data-activity-filter="day">${text('اليوم')}</button><button class="btn secondary small" data-activity-filter="week">${text('الأسبوع')}</button><button class="btn secondary small" data-activity-filter="month">${text('الشهر')}</button></div>`);
      activitySection.querySelectorAll('[data-activity-filter]').forEach(button => button.addEventListener('click', () => { activityFilter = button.dataset.activityFilter; renderSuperAdmin(admin); }));
      activitySection.id = 'adminActivity';
      const activityShortcut = document.createElement('button');
      activityShortcut.type = 'button';
      activityShortcut.textContent = text('سجل العمليات');
      activityShortcut.addEventListener('click', () => { userContent.querySelectorAll('.admin-main > section, .admin-rightbar > section').forEach(section => { section.hidden = true; }); activitySection.hidden = false; activitySection.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      userContent.querySelector('.admin-sidebar').appendChild(activityShortcut);
      userContent.querySelector('[data-admin-scroll="adminProfile"]').remove();
      userContent.querySelector('[data-admin-scroll="adminInfo"]').remove();
      const profileShortcut = document.createElement('button');
      profileShortcut.type = 'button';
      profileShortcut.textContent = text('ملف ومعلومات الأدمن');
      profileShortcut.addEventListener('click', () => document.getElementById('adminProfileForm').scrollIntoView({ behavior: 'smooth', block: 'start' }));
      userContent.querySelector('.admin-sidebar').appendChild(profileShortcut);
      const adminInfo = userContent.querySelector('#adminInfo');
      if (adminInfo) adminInfo.insertAdjacentHTML('afterend', `<form id="adminProfileForm" class="manage-block" style="margin-top:15px"><div class="form-grid"><div class="field"><label for="profileName">${text('الاسم')}</label><input id="profileName" name="name" value="${escapeHtml(admin.name)}" required></div><div class="field"><label for="profileRole">${text('نوع الحساب')}</label><select id="profileRole" name="role" ${admin.id === 'main-super-admin' ? 'disabled' : ''}><option value="superAdmin" ${admin.role === 'superAdmin' ? 'selected' : ''}>${text('السوبر أدمن')}</option><option value="admin" ${admin.role === 'admin' ? 'selected' : ''}>${text('مدير')}</option><option value="assistant" ${admin.role === 'assistant' ? 'selected' : ''}>${text('مساعد')}</option></select></div></div><div class="actions"><button class="btn small" type="submit">${text('حفظ الملف')}</button></div><p class="message" id="profileMessage" aria-live="polite"></p></form>`);
      const profileForm = userContent.querySelector('#adminProfileForm');
      if (profileForm) profileForm.addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); admin.name = String(form.get('name')).trim(); if (admin.id !== 'main-super-admin') admin.role = String(form.get('role')); recordActivity(`Updated admin profile for ${admin.email}.`, { targetUserId: admin.id }); saveData(); renderSuperAdmin(admin); });
      document.getElementById('userLogout').addEventListener('click', () => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); });
      document.getElementById('superGroupForm').addEventListener('submit', event => {
        event.preventDefault();
        const message = document.getElementById('superGroupMessage');
        const group = String(new FormData(event.currentTarget).get('group')).trim().toUpperCase();
        if (data.groups.some(item => item.toLowerCase() === group.toLowerCase())) return showMessage(message, 'هذه المجموعة موجودة بالفعل.', 'error');
        data.groups.push(group);
        recordActivity(`Added group ${group}.`);
        renderSuperAdmin(admin);
      });
      const sharedNow = new Date();
      document.getElementById('sharedDate').value = sharedNow.toISOString().slice(0, 10);
      document.getElementById('sharedTime').value = sharedNow.toTimeString().slice(0, 5);
      document.getElementById('sharedLinks').insertAdjacentHTML('afterend', `<label for="sharedFiles">${text('اختيار ملفات من الجهاز')}</label><input id="sharedFiles" name="files" type="file" multiple>`);
      document.getElementById('sharedLinks').hidden = true;
      document.getElementById('sharedLinks').previousElementSibling.hidden = true;
      document.getElementById('sharedTitle').insertAdjacentHTML('afterend', `<label for="sharedSubject">${text('المادة')}</label><select id="sharedSubject" name="subject"><option value="">${text('بدون مادة')}</option>${data.subjects.map(subject => `<option value="${escapeHtml(subject.name)}">${escapeHtml(subject.name)} (${escapeHtml(subject.group)})</option>`).join('')}</select>`);
      document.querySelectorAll('[data-admin-scroll]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.adminScroll).scrollIntoView({ behavior: 'smooth', block: 'start' })));
      document.querySelectorAll('[data-admin-scroll]').forEach(button => button.addEventListener('click', () => {
        const target = button.dataset.adminScroll;
        userContent.querySelectorAll('.admin-main > section, .admin-rightbar > section').forEach(section => { section.hidden = true; });
        if (target === 'adminGroups' || target === 'superGroupName') userContent.querySelector('#adminGroups').hidden = false;
        if (target === 'sharedForm') userContent.querySelector('#sharedForm').hidden = false;
        if (target === 'adminProfile' || target === 'adminInfo') userContent.querySelector('.admin-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      document.getElementById('sharedForm').addEventListener('submit', event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const groupsToShare = form.getAll('groups');
        const title = String(form.get('title')).trim();
        const types = ['مستند'];
        const links = String(form.get('links')).split(/\r?\n/).map(link => link.trim()).filter(Boolean);
        groupsToShare.forEach(group => data.records.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + group, group, title, types, date: String(form.get('date')), time: String(form.get('time')), details: String(form.get('details')).trim(), links }));
        groupsToShare.forEach(group => recordActivity(`Shared ${title} with ${group}.`, { group }));
        saveData();
        showMessage(document.getElementById('sharedMessage'), text('تم الحفظ والمشاركة بنجاح.'));
      });
      document.getElementById('sharedForm').addEventListener('submit', event => { const files = Array.from(event.currentTarget.querySelector('#sharedFiles').files); if (!files.length) return; const form = new FormData(event.currentTarget); Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result }); reader.readAsDataURL(file); }))).then(attachments => { data.records.filter(record => form.getAll('groups').includes(record.group) && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))).forEach(record => { record.attachments = attachments; }); saveData(); }); });
      document.getElementById('sharedForm').addEventListener('submit', event => { const form = new FormData(event.currentTarget); const subject = String(form.get('subject')).trim(); data.records.filter(record => form.getAll('groups').includes(record.group) && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))).forEach(record => { record.subject = subject; }); saveData(); });
      document.querySelectorAll('[data-open-group]').forEach(button => button.addEventListener('click', () => renderGroupSubjects(admin, button.dataset.openGroup)));
      document.querySelectorAll('[data-schedule-group]').forEach(button => button.addEventListener('click', () => renderSchedulePage(admin, button.dataset.scheduleGroup)));
      document.querySelectorAll('[data-edit-group-card]').forEach(button => button.addEventListener('click', () => {
        const oldName = button.dataset.editGroupCard;
        const newName = window.prompt(text('اسم المجموعة'), oldName);
        if (!newName || !newName.trim() || data.groups.some(item => item.toLowerCase() === newName.trim().toLowerCase() && item !== oldName)) return;
        const group = newName.trim().toUpperCase();
        data.groups = data.groups.map(item => item === oldName ? group : item);
        data.records.forEach(record => { if (record.group === oldName) record.group = group; });
        data.users.forEach(user => { if (user.selectedGroup === oldName) user.selectedGroup = group; });
        recordActivity(`Renamed group ${oldName} to ${group}.`);
        saveData();
        renderSuperAdmin(admin);
      }));
      document.querySelectorAll('[data-delete-group-card]').forEach(button => button.addEventListener('click', () => {
        const group = button.dataset.deleteGroupCard;
        if (!window.confirm(`${text('حذف المجموعة')} ${group}؟`)) return;
        data.groups = data.groups.filter(item => item !== group);
        data.records = data.records.filter(record => record.group !== group);
        data.users.forEach(user => { if (user.selectedGroup === group) { user.selectedGroup = ''; user.confirmed = false; } });
        recordActivity(`Deleted group ${group}.`);
        saveData();
        renderSuperAdmin(admin);
      }));
    }

    function attachmentMarkup(record) {
      return (record.attachments || []).map((file, index) => `<button class="resource-link" type="button" data-open-file="${escapeHtml(record.id)}" data-file-index="${index}">${escapeHtml(file.name)} · ${text('فتح')}</button>`).join('');
    }

    function openStoredFile(recordId, index) {
      const record = data.records.find(item => item.id === recordId);
      const file = record && record.attachments && record.attachments[index];
      if (!file || !file.data) return;
      const parts = file.data.split(',');
      const bytes = atob(parts[1] || '');
      const buffer = new Uint8Array(bytes.length);
      for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
      const fileUrl = URL.createObjectURL(new Blob([buffer], { type: file.type || 'application/octet-stream' }));
      const opened = window.open(fileUrl, '_blank', 'noopener');
      if (!opened) window.location.href = fileUrl;
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    }

    function recordLinksMarkup(record) {
      const links = Array.isArray(record.links) ? record.links : (record.link ? [record.link] : []);
      return links.map(link => `<a class="resource-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${text('فتح')} · ${escapeHtml(link)}</a>`).join('') + attachmentMarkup(record);
    }

    function renderGroupSubjects(admin, group, readOnly = false) {
      const viewer = data.users.find(user => user.id === activeUserId);
      if (readOnly && (!viewer || (viewer.role !== 'superAdmin' && viewer.selectedGroup !== group))) return renderHome();
      const subjects = data.subjects.filter(subject => subject.group === group);
      const scheduleRecords = data.records.filter(record => record.group === group && (record.types || [record.type]).includes('جدول'));
      const cards = subjects.map(subject => `<article class="group-card"><h3>${escapeHtml(subject.name)}</h3><small>${data.records.filter(record => record.group === group && record.subject === subject.name).length} ${text('سجل')}</small><button class="btn small" type="button" data-open-subject="${escapeHtml(subject.name)}">${text('فتح')}</button></article>`).join('');
      const schedule = scheduleRecords.map(record => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div></div><button class="btn small" type="button" data-open-schedule="${escapeHtml(record.id)}">${text('فتح')}</button></div>`).join('');
      userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToGroups" type="button">${text('رجوع')}</button><span>${text('المجموعة')} ${escapeHtml(group)}</span></div><h2>${text('جدول المجموعة')}</h2><div class="list">${schedule || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div><h2 style="margin-top:22px">${text('المواد')}</h2><div class="group-grid">${cards || `<p class="empty">${text('لا توجد مواد بعد.')}</p>`}</div>${readOnly ? '' : `<form id="subjectForm" class="manage-block" style="margin-top:15px"><div class="field"><label for="subjectName">${text('اسم المادة')}</label><input id="subjectName" name="subject" placeholder="${text('مثال: Mechatronics')}" required></div><div class="actions"><button class="btn small" type="submit">${text('إضافة مادة')}</button></div><p class="message" id="subjectMessage" aria-live="polite"></p></form>`}`;
      document.getElementById('backToGroups').addEventListener('click', () => readOnly ? renderHome() : renderSuperAdmin(data.users.find(user => user.id === activeUserId)));
      if (!readOnly) document.getElementById('subjectForm').addEventListener('submit', event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get('subject')).trim(); const message = document.getElementById('subjectMessage'); if (!name) return; if (data.subjects.some(subject => subject.group === group && subject.name.toLowerCase() === name.toLowerCase())) return showMessage(message, 'هذه المادة موجودة بالفعل.', 'error'); data.subjects.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), group, name }); recordActivity(`Added subject ${name} to ${group}.`, { group }); saveData(); renderGroupSubjects(admin, group); });
      document.querySelectorAll('[data-open-subject]').forEach(button => button.addEventListener('click', () => renderSubjectClasses(admin, group, button.dataset.openSubject, readOnly)));
      document.querySelectorAll('[data-open-schedule]').forEach(button => button.addEventListener('click', () => renderRecordDetails(admin, group, button.dataset.openSchedule, readOnly)));
    }

    function renderRecordDetails(admin, group, recordId, readOnly = false) {
      const record = data.records.find(item => item.id === recordId);
      if (!record) return renderGroupSubjects(admin, group, readOnly);
      const types = Array.isArray(record.types) ? record.types : [record.type || 'جدول'];
      userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToSchedule" type="button">${text('رجوع')}</button><span>${escapeHtml(group)}</span></div><h2>${escapeHtml(record.title)}</h2><p class="subtext">${escapeHtml(types.join(' · '))} · ${escapeHtml(record.date)} ${escapeHtml(record.time)}</p><div class="manage-block"><p>${escapeHtml(record.details)}</p><div>${recordLinksMarkup(record)}</div></div>`;
      document.getElementById('backToSchedule').addEventListener('click', () => renderGroupSubjects(admin, group, readOnly));
    }

    function renderSubjectClasses(admin, group, subject, readOnly = false) {
      const classes = [...new Set(data.records.filter(record => record.group === group && record.subject === subject).map(record => record.className || record.title))];
      const cards = classes.map(className => `<article class="group-card"><h3>${escapeHtml(className)}</h3><button class="btn small" type="button" data-open-class="${escapeHtml(className)}">${text('فتح')}</button></article>`).join('');
      userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToSubjects" type="button">${text('رجوع')}</button><span>${escapeHtml(group)} · ${escapeHtml(subject)}</span></div><h2>${text('الفصول')}</h2><div class="group-grid">${cards || `<p class="empty">${text('لا توجد فصول بعد.')}</p>`}</div>`;
      document.getElementById('backToSubjects').addEventListener('click', () => renderGroupSubjects(admin, group, readOnly));
      document.querySelectorAll('[data-open-class]').forEach(button => button.addEventListener('click', () => renderClassMaterials(admin, group, subject, button.dataset.openClass, readOnly)));
    }

    function renderClassMaterials(admin, group, subject, className, readOnly = false) {
      const records = data.records.filter(record => record.group === group && record.subject === subject && (record.className || record.title) === className);
      const materials = records.map(record => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div>${recordLinksMarkup(record)}</div></div>`).join('');
      userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToClasses" type="button">${text('رجوع')}</button><span>${escapeHtml(subject)} · ${escapeHtml(className)}</span></div><h2>${text('الملفات والمعلومات')}</h2><div class="list">${materials || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div>`;
      document.getElementById('backToClasses').addEventListener('click', () => renderSubjectClasses(admin, group, subject, readOnly));
    }

    function renderSchedulePage(admin, group) {
      renderGroupRecords(admin, group, null, true);
    }

    function renderGroupRecords(admin, group, editingRecord = null, scheduleOnly = false, subject = '') {
      data.records = Array.isArray(data.records) ? data.records : [];
      editingRecordId = editingRecord ? editingRecord.id : null;
      const records = data.records.filter(record => record.group === group && (!subject || record.subject === subject)).map(record => { const types = Array.isArray(record.types) ? record.types : [record.type || 'جدول']; const links = Array.isArray(record.links) ? record.links : (record.link ? [record.link] : []); return `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${record.subject ? `${escapeHtml(record.subject)} · ` : ''}${escapeHtml(types.join(' · '))} · ${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div>${links.map(link => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`).join('<br>')}</div><div class="row-actions"><button class="btn secondary small" type="button" data-edit-record="${escapeHtml(record.id)}">${text('تعديل السجل')}</button><button class="btn danger small" type="button" data-delete-record="${escapeHtml(record.id)}">${text('حذف')}</button></div></div>`; }).join('');
      const now = new Date();
      const dateValue = editingRecord ? editingRecord.date : now.toISOString().slice(0, 10);
      const timeValue = editingRecord ? editingRecord.time : now.toTimeString().slice(0, 5);
      const selectedTypes = scheduleOnly ? ['جدول'] : (editingRecord ? (editingRecord.types || [editingRecord.type || 'جدول']) : ['جدول']);
      const linksValue = editingRecord ? (editingRecord.links || (editingRecord.link ? [editingRecord.link] : [])).join('\n') : '';
        userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToGroups" type="button">${text('رجوع')}</button><span>${text('مجموعة')} ${escapeHtml(group)}</span></div><h2>${scheduleOnly ? text('جدول المجموعة') : text('سجلات المجموعة')}</h2><form id="recordForm" class="manage-block"><div class="form-grid"><div class="field"><label for="recordTitle">${text('العنوان')}</label><input id="recordTitle" name="title" value="${editingRecord ? escapeHtml(editingRecord.title) : ''}" required></div><div class="field"><label for="recordType">${text('النوع')}</label><select id="recordType" name="types" multiple size="3">${['جدول', 'دورة أونلاين', 'فيديو', 'مستند', 'ملاحظة'].map(type => `<option value="${type}" ${selectedTypes.includes(type) ? 'selected' : ''}>${text(type)}</option>`).join('')}</select></div><div class="field"><label for="recordDate">${text('التاريخ')}</label><input id="recordDate" name="date" type="date" value="${dateValue}" required></div><div class="field"><label for="recordTime">${text('الوقت')}</label><input id="recordTime" name="time" type="time" value="${timeValue}" required></div><div class="field full"><label for="recordDetails">${text('التفاصيل')}</label><textarea id="recordDetails" name="details" maxlength="1000" required>${editingRecord ? escapeHtml(editingRecord.details) : ''}</textarea></div><div class="field full"><label for="recordLinks">${text('روابط الملفات (اختياري، رابط في كل سطر)')}</label><textarea id="recordLinks" name="links" placeholder="https://...\nhttps://...">${escapeHtml(linksValue)}</textarea></div></div><div class="actions"><button class="btn" type="submit">${text(editingRecord ? 'تحديث السجل' : 'حفظ السجل')}</button></div><p class="message" id="recordMessage" aria-live="polite"></p></form><div class="list">${records || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div>`;
        document.getElementById('recordLinks').insertAdjacentHTML('afterend', `<label for="recordFiles">${text('اختيار ملفات من الجهاز')}</label><input id="recordFiles" name="files" type="file" multiple>`);
        document.getElementById('recordLinks').hidden = true;
        document.getElementById('recordLinks').previousElementSibling.hidden = true;
      document.getElementById('recordTitle').insertAdjacentHTML('beforebegin', `<div class="field"><label for="recordSubject">${text('المادة')}</label><input id="recordSubject" name="subject" value="${escapeHtml(subject || (editingRecord && editingRecord.subject) || '')}" placeholder="${text('مثال: Mechatronics')}"></div>`);
      document.getElementById('recordSubject').insertAdjacentHTML('afterend', `<label for="recordClass">${text('الفصل')}</label><input id="recordClass" name="className" value="${escapeHtml((editingRecord && editingRecord.className) || '')}" placeholder="${text('مثال: Class A')}">`);
      document.getElementById('recordType').insertAdjacentHTML('beforeend', `<option value="شهادة" ${selectedTypes.includes('شهادة') ? 'selected' : ''}>${text('شهادة')}</option>`);
      document.getElementById('backToGroups').addEventListener('click', () => { editingRecordId = null; subject ? renderGroupSubjects(admin, group) : renderSuperAdmin(admin); });
      document.getElementById('recordForm').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const types = form.getAll('types'); const record = { id: editingRecordId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), group, title: String(form.get('title')).trim(), types: types.length ? types : ['جدول'], date: String(form.get('date')), time: String(form.get('time')), details: String(form.get('details')).trim(), links: String(form.get('links')).split(/\r?\n/).map(link => link.trim()).filter(Boolean) }; const existingIndex = data.records.findIndex(item => item.id === editingRecordId); if (existingIndex >= 0) data.records[existingIndex] = record; else data.records.push(record); recordActivity(`${editingRecordId ? 'Updated' : 'Added'} a record in ${group}.`); saveData(); renderGroupRecords(admin, group); });
      document.getElementById('recordForm').addEventListener('submit', event => { const form = new FormData(event.currentTarget); const selectedSubject = String(form.get('subject')).trim(); const selectedClass = String(form.get('className')).trim(); const target = data.records.find(record => record.group === group && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))); if (target) { target.subject = selectedSubject; target.className = selectedClass; if (selectedSubject && !data.subjects.some(item => item.group === group && item.name === selectedSubject)) data.subjects.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), group, name: selectedSubject }); saveData(); } });
      document.getElementById('recordForm').addEventListener('submit', event => { const files = Array.from(event.currentTarget.querySelector('#recordFiles').files); if (!files.length) return; const form = new FormData(event.currentTarget); Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result }); reader.readAsDataURL(file); }))).then(attachments => { const target = data.records.find(record => record.group === group && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))); if (target) { target.attachments = attachments; saveData(); renderGroupRecords(admin, group); } }); });
      document.querySelectorAll('[data-edit-record]').forEach(button => button.addEventListener('click', () => { const record = data.records.find(item => item.id === button.dataset.editRecord); renderGroupRecords(admin, group, record); }));
      document.querySelectorAll('[data-delete-record]').forEach(button => button.addEventListener('click', () => { data.records = data.records.filter(record => record.id !== button.dataset.deleteRecord); recordActivity(`Deleted a record from ${group}.`); saveData(); renderGroupRecords(admin, group); }));
    }

    function registerUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const username = String(form.get('username')).trim().toLowerCase();
      const name = String(form.get('name')).trim();
      const password = String(form.get('password'));
      const message = document.getElementById('userMessage');
      if (!name || !username || !password) return showMessage(message, 'يرجى ملء جميع الحقول.', 'error');
      if (data.users.some(user => user.username === username)) return showMessage(message, 'اسم الدخول مستخدم بالفعل.', 'error');
      data.users.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, username, password, selectedGroup: '', confirmed: false });
      if (!saveData()) return showMessage(message, 'تعذر حفظ الحساب في هذا المتصفح.', 'error');
      showMessage(message, 'تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.');
      userMode = 'login';
      window.setTimeout(renderUser, 700);
    }

    function loginUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const username = String(form.get('username')).trim().toLowerCase();
      const password = String(form.get('password'));
      const user = data.users.find(item => item.username === username && item.password === password);
      if (!user) return showMessage(document.getElementById('userMessage'), 'اسم الدخول أو كلمة المرور غير صحيحة.', 'error');
      activeUserId = user.id;
      renderUser();
    }

    function renderGroupChoice(user) {
      const options = data.groups.length ? data.groups.map(group => `<option value="${escapeHtml(group)}" ${user.selectedGroup === group ? 'selected' : ''}>${escapeHtml(group)}</option>`).join('') : '<option value="">لا توجد مجموعات متاحة</option>';
      userContent.innerHTML = `<div class="session-bar"><span>مرحبًا، ${escapeHtml(user.name)}</span><button class="btn secondary small" id="userLogout" type="button">تسجيل الخروج</button></div><p class="eyebrow">اختيار المجموعة</p><h2>اختر مجموعتك</h2><p class="subtext">راجع اختيارك وأكّده للدخول إلى صفحة المستخدم.</p><form id="groupChoiceForm"><div class="field"><label for="groupChoice">المجموعات المتاحة</label><select id="groupChoice" name="group" ${data.groups.length ? 'required' : 'disabled'}>${options}</select></div><div class="actions"><button class="btn" type="submit" ${data.groups.length ? '' : 'disabled'}>تأكيد المجموعة</button></div><p class="message" id="userMessage" aria-live="polite">${data.groups.length ? '' : 'لا توجد مجموعة متاحة حاليًا. تواصل مع الأدمن.'}</p></form>`;
      document.getElementById('userLogout').addEventListener('click', () => { activeUserId = null; renderUser(); });
      document.getElementById('groupChoiceForm').addEventListener('submit', event => {
        event.preventDefault();
        const selectedGroup = new FormData(event.currentTarget).get('group');
        if (!data.groups.includes(selectedGroup)) return showMessage(document.getElementById('userMessage'), 'هذه المجموعة لم تعد متاحة. اختر مجموعة أخرى.', 'error');
        user.selectedGroup = selectedGroup;
        user.confirmed = true;
        if (!saveData()) return showMessage(document.getElementById('userMessage'), 'تعذر حفظ الاختيار في هذا المتصفح.', 'error');
        renderUser();
      });
      translatePage();
    }

    function renderAdmin() {
      if (!adminSignedIn) {
        adminContent.innerHTML = `<div class="admin-login"><p class="eyebrow">إدارة البوابة</p><h2>دخول الأدمن</h2><p class="subtext">أدخل بيانات الدخول التجريبية لفتح أدوات الإدارة.</p><form id="adminLoginForm"><div class="field"><label for="adminEmail">البريد الإلكتروني</label><input id="adminEmail" name="email" type="email" autocomplete="username" required></div><div class="field" style="margin-top:13px"><label for="adminPassword">كلمة المرور</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" required></div><div class="actions"><button class="btn" type="submit">دخول الأدمن</button></div><p class="message" id="adminMessage" aria-live="polite"></p></form></div>`;
        document.getElementById('adminLoginForm').addEventListener('submit', event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          if (String(form.get('email')).trim().toLowerCase() !== ADMIN_EMAIL || form.get('password') !== ADMIN_PASSWORD) return showMessage(document.getElementById('adminMessage'), 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'error');
          adminSignedIn = true;
          renderAdmin();
        });
        translatePage();
        return;
      }
      renderAdminDashboard();
    }

    function renderAdminDashboard() {
      const groups = data.groups.map(group => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(group)}</strong></div><div class="row-actions"><button class="btn secondary small" type="button" data-edit-group="${escapeHtml(group)}">تعديل</button><button class="btn danger small" type="button" data-delete-group="${escapeHtml(group)}">حذف</button></div></div>`).join('');
      const users = data.users.map(user => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(user.name)}</strong><small>@${escapeHtml(user.username)} · ${escapeHtml(user.selectedGroup || 'دون مجموعة')}</small></div><div class="row-actions"><button class="btn secondary small" type="button" data-edit-user="${escapeHtml(user.id)}">تعديل</button><button class="btn danger small" type="button" data-delete-user="${escapeHtml(user.id)}">حذف</button></div></div>`).join('');
      const groupOptions = `<option value="">دون مجموعة</option>${data.groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('')}`;
      const currentUser = data.users.find(user => user.id === editingUserId);
      adminContent.innerHTML = `<div class="admin-head"><div><p class="eyebrow">مرحبًا، ${escapeHtml(ADMIN_NAME)}</p><h2>إدارة الحسابات والمجموعات</h2></div><button class="btn secondary small" id="adminLogout" type="button">تسجيل الخروج</button></div><p class="message ${adminNotice ? 'success' : ''}" id="adminNotice" aria-live="polite">${escapeHtml(adminNotice)}</p><div class="admin-columns"><section class="manage-block"><h3>${editingGroup === null ? 'إضافة مجموعة' : `تعديل المجموعة: ${escapeHtml(editingGroup)}`}</h3><form class="compact-form" id="groupForm"><div class="field"><label for="groupName">اسم المجموعة</label><input id="groupName" name="group" maxlength="30" value="${editingGroup === null ? '' : escapeHtml(editingGroup)}" placeholder="مثال: GA3" required></div><div class="actions"><button class="btn small" type="submit">${editingGroup === null ? 'إضافة المجموعة' : 'حفظ التعديل'}</button>${editingGroup === null ? '' : '<button class="btn secondary small" id="cancelGroupEdit" type="button">إلغاء</button>'}</div><p class="message" id="groupMessage" aria-live="polite"></p></form><div class="list" aria-label="المجموعات الحالية">${groups || '<p class="empty">لا توجد مجموعات حاليًا.</p>'}</div></section><section class="manage-block"><h3>${currentUser ? 'تعديل حساب مستخدم' : 'إضافة مستخدم'}</h3><form class="compact-form" id="userAdminForm"><div class="field"><label for="adminUserName">الاسم</label><input id="adminUserName" name="name" maxlength="80" value="${currentUser ? escapeHtml(currentUser.name) : ''}" required></div><div class="field"><label for="adminUsername">اسم الدخول</label><input id="adminUsername" name="username" maxlength="40" value="${currentUser ? escapeHtml(currentUser.username) : ''}" required></div><div class="field"><label for="adminUserPassword">${currentUser ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label><input id="adminUserPassword" name="password" type="password" minlength="4" ${currentUser ? '' : 'required'}></div><div class="field"><label for="adminUserGroup">المجموعة</label><select id="adminUserGroup" name="group">${groupOptions}</select></div><div class="actions"><button class="btn small" type="submit">${currentUser ? 'حفظ التعديل' : 'إضافة المستخدم'}</button>${currentUser ? '<button class="btn secondary small" id="cancelUserEdit" type="button">إلغاء</button>' : ''}</div><p class="message" id="userAdminMessage" aria-live="polite"></p></form><div class="list" aria-label="المستخدمون الحاليون">${users || '<p class="empty">لا يوجد مستخدمون حاليًا.</p>'}</div></section></div>`;
      document.getElementById('adminLogout').addEventListener('click', () => { adminSignedIn = false; editingGroup = null; editingUserId = null; renderAdmin(); });
      document.getElementById('groupForm').addEventListener('submit', saveGroup);
      document.getElementById('userAdminForm').addEventListener('submit', saveAdminUser);
      document.querySelectorAll('[data-edit-group]').forEach(button => button.addEventListener('click', () => { editingGroup = button.dataset.editGroup; renderAdminDashboard(); }));
      document.querySelectorAll('[data-delete-group]').forEach(button => button.addEventListener('click', () => deleteGroup(button.dataset.deleteGroup)));
      document.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', () => { editingUserId = button.dataset.editUser; renderAdminDashboard(); }));
      document.querySelectorAll('[data-delete-user]').forEach(button => button.addEventListener('click', () => deleteUser(button.dataset.deleteUser)));
      if (currentUser) document.getElementById('adminUserGroup').value = currentUser.selectedGroup || '';
      const cancelGroup = document.getElementById('cancelGroupEdit');
      if (cancelGroup) cancelGroup.addEventListener('click', () => { editingGroup = null; renderAdminDashboard(); });
      const cancelUser = document.getElementById('cancelUserEdit');
      if (cancelUser) cancelUser.addEventListener('click', () => { editingUserId = null; renderAdminDashboard(); });
      translatePage();
    }

    function saveGroup(event) {
      event.preventDefault();
      const name = String(new FormData(event.currentTarget).get('group')).trim();
      const message = document.getElementById('groupMessage');
      if (!name) return showMessage(message, 'اكتب اسم المجموعة.', 'error');
      if (data.groups.some(group => group.toLowerCase() === name.toLowerCase() && group !== editingGroup)) return showMessage(message, 'هذه المجموعة موجودة بالفعل.', 'error');
      if (editingGroup !== null) {
        const oldName = editingGroup;
        data.groups = data.groups.map(group => group === oldName ? name : group);
        data.users.forEach(user => { if (user.selectedGroup === oldName) user.selectedGroup = name; });
      } else data.groups.push(name);
      if (!saveData()) return showMessage(message, 'تعذر حفظ التغيير في هذا المتصفح.', 'error');
      editingGroup = null;
      renderAdminDashboard();
      showMessage(document.getElementById('groupMessage'), 'تم حفظ المجموعة بنجاح.');
    }

    function deleteGroup(name) {
      if (!window.confirm(`هل تريد حذف المجموعة ${name}؟`)) return;
      data.groups = data.groups.filter(group => group !== name);
      data.users.forEach(user => { if (user.selectedGroup === name) { user.selectedGroup = ''; user.confirmed = false; } });
      if (!saveData()) { renderAdminDashboard(); return; }
      if (editingGroup === name) editingGroup = null;
      adminNotice = `تم حذف المجموعة ${name} بنجاح.`;
      renderAdminDashboard();
    }

    function saveAdminUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name')).trim();
      const username = String(form.get('username')).trim().toLowerCase();
      const password = String(form.get('password'));
      const selectedGroup = String(form.get('group'));
      const message = document.getElementById('userAdminMessage');
      const existing = data.users.find(user => user.id === editingUserId);
      if (data.users.some(user => user.username === username && user.id !== editingUserId)) return showMessage(message, 'اسم الدخول مستخدم بالفعل.', 'error');
      if (selectedGroup && !data.groups.includes(selectedGroup)) return showMessage(message, 'المجموعة المحددة غير متاحة.', 'error');
      if (existing) {
        existing.name = name;
        existing.username = username;
        if (password) existing.password = password;
        existing.selectedGroup = selectedGroup;
        existing.confirmed = Boolean(selectedGroup);
      } else data.users.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, username, password, selectedGroup, confirmed: Boolean(selectedGroup) });
      if (!saveData()) return showMessage(message, 'تعذر حفظ المستخدم في هذا المتصفح.', 'error');
      editingUserId = null;
      renderAdminDashboard();
      showMessage(document.getElementById('userAdminMessage'), 'تم حفظ المستخدم بنجاح.');
    }

    function deleteUser(id) {
      const user = data.users.find(item => item.id === id);
      if (!user || !window.confirm(`هل تريد حذف حساب ${user.name}؟`)) return;
      data.users = data.users.filter(item => item.id !== id);
      if (activeUserId === id) activeUserId = null;
      if (editingUserId === id) editingUserId = null;
      saveData();
      adminNotice = `تم حذف حساب ${user.name} بنجاح.`;
      renderAdminDashboard();
    }

    setupLanguage();
    translatePage();

    const userText = {
      'بوابة الدخول': 'Access portal', 'أهلًا بك في مساحة مجموعتك': 'Welcome to your group space', 'سجّل الدخول أو أنشئ حسابًا، ثم اختر المجموعة المناسبة لك.': 'Sign in or create an account, then choose the right group for you.',
      'دخول المستخدم': 'User sign-in', 'سجّل الدخول إلى حسابك': 'Sign in to your account', 'أدخل البريد الإلكتروني وكلمة المرور التي أنشأتها.': 'Enter the email and password you created.', 'البريد الإلكتروني': 'Email', 'كلمة المرور': 'Password', 'تسجيل الدخول': 'Sign in', 'إنشاء حساب جديد': 'Create a new account',
      'حساب جديد': 'New account', 'إنشاء حساب مستخدم': 'Create a user account', 'أنشئ بياناتك، ثم سجّل الدخول للمتابعة.': 'Create your details, then sign in to continue.', 'الاسم': 'Name', 'إنشاء الحساب': 'Create account', 'لدي حساب بالفعل': 'I already have an account', 'مثال: 192600250@ecu.edu.eg': 'Example: 192600250@ecu.edu.eg',
      'حساب المستخدم': 'User account', 'تسجيل الخروج': 'Sign out', 'تم تسجيل الدخول': 'Signed in', 'مرحبًا، ': 'Welcome, ', 'المجموعة: ': 'Group: ', 'المجموعة': 'Group', 'تذكرني': 'Remember me', 'تسجيل الدخول حتى تسجيل الخروج': 'Keep me signed in until I sign out', 'لوحة السوبر أدمن': 'Super admin dashboard', 'الحسابات': 'Accounts', 'سجل العمليات': 'Activity log', 'إضافة مجموعة': 'Add group', 'اسم المجموعة': 'Group name', 'حفظ المجموعة': 'Save group', 'لا توجد عمليات بعد.': 'No activity yet.', 'المستخدمون': 'Users', 'الرئيسية': 'Home', 'تسجيل الدخول': 'Sign in', 'الملف الشخصي': 'Profile', 'فتح': 'Open', 'تعديل': 'Edit', 'حذف': 'Delete', 'رجوع': 'Back', 'سجلات المجموعة': 'Group records', 'سجل': 'records', 'العنوان': 'Title', 'النوع': 'Type', 'جدول': 'Schedule', 'دورة أونلاين': 'Online course', 'ملاحظة': 'Note', 'التاريخ': 'Date', 'الوقت': 'Time', 'التفاصيل': 'Details', 'رابط الدورة أو الملف (اختياري)': 'Course or file link (optional)', 'حفظ السجل': 'Save record', 'لا توجد سجلات بعد.': 'No records yet.', 'حذف المجموعة': 'Delete group', 'تغيير المجموعة': 'Change group', 'مشاركة داخل المجموعة': 'Share with the group', 'اكتب شيئًا لمشاركته مع مجموعتك...': 'Write something to share with your group...', 'إرسال': 'Send', 'المحتوى المشترك': 'Shared content', 'لا توجد مشاركات بعد.': 'No posts yet.', 'يظهر هذا المحتوى لأعضاء مجموعتك فقط.': 'This content is visible only to members of your group.',
      'اختيار المجموعة': 'Group selection', 'اختر مجموعتك': 'Choose your group', 'راجع اختيارك وأكّده للدخول إلى صفحة المستخدم.': 'Review and confirm your choice to enter the user page.', 'المجموعات المتاحة': 'Available groups', 'مجموعتك الحالية': 'Your current group', 'مجموعة متاحة': 'Available group', 'تأكيد المجموعة': 'Confirm group', 'لا توجد مجموعات متاحة': 'No groups available', 'لا توجد مجموعة متاحة حاليًا. تواصل مع الأدمن.': 'No group is currently available. Contact the admin.',
      'يرجى ملء جميع الحقول.': 'Please fill in all fields.', 'يجب أن ينتهي البريد بـ @ecu.edu.eg.': 'Email must end with @ecu.edu.eg.', 'كلمة المرور يجب أن تحتوي على حرف كبير ورقم ورمز مثل @.': 'Password must contain an uppercase letter, a number, and a symbol such as @.', 'الاسم مستخدم بالفعل.': 'This name is already in use.', 'اسم الدخول أو كلمة المرور غير صحيحة.': 'The email or password is incorrect.', 'المجموعة المحددة غير متاحة.': 'The selected group is not available.', 'تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.': 'Account created and saved. You can sign in now.', 'تعذر حفظ التغيير في هذا المتصفح.': 'Could not save the change in this browser.'
    };

    const recordTranslations = { 'رفع الجدول': 'Upload schedule', 'فتح': 'Open', 'فتح المجموعة': 'Open group', 'تعديل': 'Edit', 'حذف': 'Delete', 'رجوع': 'Back', 'سجلات المجموعة': 'Group records', 'جدول المجموعة': 'Group schedule', 'المواد والمشاركات': 'Materials and shared items', 'الشهادات': 'Certificates', 'المحتوى الذي أضافه السوبر أدمن فقط': 'Only content added by the super admin', 'لا يوجد محتوى مضاف بعد.': 'No admin content has been added yet.', 'التحديثات': 'Updates', 'لا توجد تحديثات بعد.': 'No updates yet.', 'خيارات الإدارة': 'Admin options', 'اسم المجموعة': 'Group name', 'ملف الأدمن': 'Admin profile', 'معلومات الأدمن': 'Admin info', 'ملف ومعلومات الأدمن': 'Admin profile and info', 'مشاركة بين المجموعات': 'Share between groups', 'المجموعات': 'Groups', 'المادة': 'Subject', 'المواد': 'Subjects', 'إضافة مادة': 'Add subject', 'اسم المادة': 'Subject name', 'حفظ ومشاركة': 'Save and share', 'تم الحفظ والمشاركة بنجاح.': 'Saved and shared successfully.', 'اختيار ملفات من الجهاز': 'Choose files from device', 'الكل': 'All', 'اليوم': 'Day', 'الأسبوع': 'Week', 'الشهر': 'Month', 'سجل': 'records', 'العنوان': 'Title', 'النوع': 'Content types', 'جدول': 'Schedule', 'دورة أونلاين': 'Online course', 'فيديو': 'Video', 'مستند': 'Document', 'شهادة': 'Certificate', 'ملاحظة': 'Note', 'التاريخ': 'Date', 'الوقت': 'Time', 'التفاصيل': 'Details', 'روابط الملفات (اختياري، رابط في كل سطر)': 'File links (optional, one link per line)', 'حفظ السجل': 'Save record', 'تحديث السجل': 'Update record', 'تعديل السجل': 'Edit record', 'لا توجد سجلات بعد.': 'No records yet.', 'نوع الحساب': 'Account type', 'مساعد': 'Assistant', 'مدير': 'Admin', 'السوبر أدمن': 'Main Super Admin', 'حفظ الملف': 'Save profile' };
    Object.assign(recordTranslations, { 'الفصل': 'Class', 'الفصول': 'Classes', 'الملفات والمعلومات': 'Files and information', 'مثال: Class A': 'Example: Class A', 'بدون مادة': 'No subject', 'الدخول': 'Access', 'مغلق': 'Locked', 'سجّل الدخول للوصول': 'Sign in to access' });
    function text(key) { return currentLanguage === 'en' ? (userText[key] || recordTranslations[key] || key) : key; }

    function updateHeader() {
      const currentUser = data.users.find(user => user.id === activeUserId);
      const signedIn = Boolean(currentUser);
      document.getElementById('mainNav').textContent = text('الرئيسية');
      document.getElementById('signInNav').textContent = text('تسجيل الدخول');
      document.getElementById('profileNav').textContent = text('الملف الشخصي');
      document.getElementById('mainNav').classList.toggle('active', viewMode === 'home');
      document.getElementById('signInNav').classList.toggle('active', viewMode === 'signin');
      document.getElementById('profileNav').classList.toggle('active', viewMode === 'profile');
      document.getElementById('signInNav').hidden = signedIn;
      document.getElementById('profileNav').hidden = !signedIn;
      const avatar = document.getElementById('headerAvatar');
      avatar.classList.toggle('hidden', !signedIn);
      const identity = document.getElementById('headerIdentity');
      identity.classList.toggle('hidden', !signedIn);
      if (currentUser) { avatar.textContent = currentUser.name.trim().charAt(0).toUpperCase(); identity.textContent = currentUser.name; }
      const visibleActivity = currentUser && currentUser.role === 'superAdmin' ? data.activity : data.activity.filter(item => item.targetUserId === activeUserId || (currentUser && item.group === currentUser.selectedGroup));
      const recent = visibleActivity.slice(-5).reverse();
      const count = document.getElementById('notificationCount');
      count.textContent = recent.length;
      count.classList.toggle('hidden', recent.length === 0);
      document.getElementById('notificationPanel').innerHTML = `<div class="session-bar"><strong>${text('التحديثات')}</strong><button class="btn danger small" id="clearNotifications" type="button">${text('حذف')}</button></div><div class="list">${recent.map(item => `<div class="list-row"><div class="row-main"><small>${escapeHtml(new Date(item.createdAt).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'ar-EG'))}</small><div>${escapeHtml(item.action)}</div></div><button class="btn danger small" type="button" data-delete-notification="${escapeHtml(item.createdAt)}">${text('حذف')}</button></div>`).join('') || `<p class="empty">${text('لا توجد تحديثات بعد.')}</p>`}</div>`;
      document.getElementById('clearNotifications').addEventListener('click', () => { data.activity = data.activity.filter(item => !(item.targetUserId === activeUserId || (currentUser && currentUser.role === 'superAdmin'))); saveData(); updateHeader(); });
      document.querySelectorAll('[data-delete-notification]').forEach(button => button.addEventListener('click', () => { data.activity = data.activity.filter(item => item.createdAt !== button.dataset.deleteNotification); saveData(); updateHeader(); }));
    }

    document.getElementById('notificationsButton').addEventListener('click', () => document.getElementById('notificationPanel').classList.toggle('hidden'));
    document.getElementById('refreshButton').addEventListener('click', () => window.location.reload());
    document.getElementById('headerAvatar').addEventListener('click', () => { if (activeUserId) { viewMode = 'profile'; renderUser(); } });

    function renderHome() {
      const currentUser = data.users.find(user => user.id === activeUserId);
      const groupCards = data.groups.map(group => { const count = data.records.filter(record => record.group === group).length; const canOpen = currentUser && (currentUser.role === 'superAdmin' || currentUser.selectedGroup === group); const button = canOpen ? `<button class="btn small" type="button" data-home-group="${escapeHtml(group)}">${text('الدخول')}</button>` : currentUser ? `<button class="btn secondary small" type="button" disabled>${text('مغلق')}</button>` : `<button class="btn secondary small" type="button" data-signin-group="${escapeHtml(group)}">${text('سجّل الدخول للوصول')}</button>`; return `<article class="group-card"><h3>${escapeHtml(group)}</h3><small>${count} ${text('سجل')}</small>${button}</article>`; }).join('');
      userContent.innerHTML = `<div class="profile"><span class="avatar" aria-hidden="true">م</span><div><p class="eyebrow">${text('بوابة الدخول')}</p><h2>${text('أهلًا بك في مساحة مجموعتك')}</h2><p>${text('المحتوى الذي أضافه السوبر أدمن فقط')}</p></div></div><h3>${text('المجموعات المتاحة')}</h3><div class="group-grid">${groupCards || `<p class="empty">${text('لا يوجد محتوى مضاف بعد.')}</p>`}</div><div class="actions"><button class="btn" id="homeSignIn" type="button">${text('تسجيل الدخول')}</button></div>`;
      document.getElementById('homeSignIn').addEventListener('click', () => { viewMode = 'signin'; activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); });
      document.querySelectorAll('[data-home-group]').forEach(button => button.addEventListener('click', () => renderGroupSubjects(null, button.dataset.homeGroup, true)));
      document.querySelectorAll('[data-signin-group]').forEach(button => button.addEventListener('click', () => { viewMode = 'signin'; userMode = 'login'; renderUser(); }));
      updateHeader();
    }

    function renderPublicGroup(group) {
      const records = data.records.filter(record => record.group === group).map(record => { const types = Array.isArray(record.types) ? record.types : [record.type || 'جدول']; const links = Array.isArray(record.links) ? record.links : (record.link ? [record.link] : []); return `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${record.subject ? `${escapeHtml(record.subject)} · ` : ''}${escapeHtml(types.join(' · '))} · ${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div>${links.map(link => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`).join('<br>')}${attachmentMarkup(record)}</div></div>`; }).join('');
      viewMode = 'home';
      userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="publicBackHome" type="button">${text('رجوع')}</button><span>${text('المواد والمشاركات')}</span></div><p class="eyebrow">${text('المحتوى الذي أضافه السوبر أدمن فقط')}</p><h2>${escapeHtml(group)}</h2><div class="list">${records || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div>`;
      document.getElementById('publicBackHome').addEventListener('click', renderHome);
      updateHeader();
    }
    data.posts = Array.isArray(data.posts) ? data.posts : [];
    data.activity = Array.isArray(data.activity) ? data.activity : [];
    data.records = Array.isArray(data.records) ? data.records : [];
    data.subjects = Array.isArray(data.subjects) ? data.subjects : [];
    let superAdmin = data.users.find(user => user.email === SUPER_ADMIN_EMAIL);
    if (!superAdmin) {
      superAdmin = { id: 'main-super-admin', name: 'Main Super Admin', email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD, role: 'superAdmin', selectedGroup: '', confirmed: true };
      data.users.push(superAdmin);
      data.activity.push({ actor: 'System', action: 'Created the permanent super admin account.', createdAt: new Date().toISOString() });
      saveData();
    } else {
      superAdmin.password = SUPER_ADMIN_PASSWORD;
      superAdmin.role = 'superAdmin';
      superAdmin.name = 'Main Super Admin';
      superAdmin.confirmed = true;
      saveData();
    }
    const rememberedUserId = localStorage.getItem(SESSION_KEY);
    if (rememberedUserId && data.users.some(user => user.id === rememberedUserId)) { activeUserId = rememberedUserId; viewMode = 'profile'; }

    function renderUser() {
      const currentUser = data.users.find(user => user.id === activeUserId);
      if (viewMode === 'home') return renderHome();
      updateHeader();
      if (currentUser && currentUser.role === 'superAdmin') return renderSuperAdmin(currentUser);
      if (!currentUser) {
        if (userMode === 'register') {
          const groupOptions = data.groups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
          userContent.innerHTML = `<p class="eyebrow">${text('حساب جديد')}</p><h2>${text('إنشاء حساب مستخدم')}</h2><p class="subtext">${text('أنشئ بياناتك، ثم سجّل الدخول للمتابعة.')}</p><form id="registerForm"><div class="form-grid"><div class="field"><label for="newName">${text('الاسم')}</label><input id="newName" name="name" maxlength="80" required></div><div class="field"><label for="newEmail">${text('البريد الإلكتروني')}</label><input id="newEmail" name="email" type="email" placeholder="${text('مثال: 192600250@ecu.edu.eg')}" required></div><div class="field"><label for="newGroup">${text('المجموعة')}</label><select id="newGroup" name="group" required>${groupOptions}</select></div><div class="field full"><label for="newPassword">${text('كلمة المرور')}</label><input id="newPassword" name="password" type="password" minlength="4" required></div></div><div class="actions"><button class="btn" type="submit">${text('إنشاء الحساب')}</button><button class="link-button" id="showLogin" type="button">${text('لدي حساب بالفعل')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
          document.getElementById('showLogin').addEventListener('click', () => { userMode = 'login'; renderUser(); });
          document.getElementById('registerForm').addEventListener('submit', registerUser);
        } else {
          userContent.innerHTML = `<p class="eyebrow">${text('دخول المستخدم')}</p><h2>${text('سجّل الدخول إلى حسابك')}</h2><p class="subtext">${text('أدخل البريد الإلكتروني وكلمة المرور التي أنشأتها.')}</p><form id="userLoginForm"><div class="field"><label for="loginEmail">${text('البريد الإلكتروني')}</label><input id="loginEmail" name="email" type="email" required></div><div class="field" style="margin-top:13px"><label for="loginPassword">${text('كلمة المرور')}</label><input id="loginPassword" name="password" type="password" required></div><label style="display:flex;align-items:center;gap:8px;margin-top:13px"><input type="checkbox" name="remember" style="width:auto;min-height:0">${text('تذكرني')} (${text('تسجيل الدخول حتى تسجيل الخروج')})</label><div class="actions"><button class="btn" type="submit">${text('تسجيل الدخول')}</button><button class="link-button" id="showRegister" type="button">${text('إنشاء حساب جديد')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
          document.getElementById('showRegister').addEventListener('click', () => { userMode = 'register'; renderUser(); });
          document.getElementById('userLoginForm').addEventListener('submit', loginUser);
        }
        return;
      }
      if (!currentUser.confirmed || !currentUser.selectedGroup) return renderGroupChoice(currentUser);
      const posts = data.posts.filter(post => post.group === currentUser.selectedGroup).map(post => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(post.author)}</strong><small>${escapeHtml(new Date(post.createdAt).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'ar-EG'))}</small><div>${escapeHtml(post.text)}</div></div></div>`).join('');
      userContent.innerHTML = `<div class="session-bar"><span>${text('حساب المستخدم')}</span><button class="btn secondary small" id="userLogout" type="button">${text('تسجيل الخروج')}</button></div><p class="eyebrow">${text('تم تسجيل الدخول')}</p><h2>${text('مرحبًا، ')}${escapeHtml(currentUser.name)}</h2><p class="subtext">${text('المجموعة: ')}<span class="group-value">${escapeHtml(currentUser.selectedGroup)}</span></p><div class="profile"><span class="avatar" aria-hidden="true">${escapeHtml(currentUser.name.charAt(0))}</span><div><strong>${escapeHtml(currentUser.name)}</strong><p>${escapeHtml(currentUser.email)}</p><p>${text('يظهر هذا المحتوى لأعضاء مجموعتك فقط.')}</p></div></div><form id="postForm"><div class="field"><label for="postText">${text('مشاركة داخل المجموعة')}</label><textarea id="postText" name="text" maxlength="500" placeholder="${text('اكتب شيئًا لمشاركته مع مجموعتك...')}" required></textarea></div><div class="actions"><button class="btn" type="submit">${text('إرسال')}</button><button class="btn secondary" id="changeGroup" type="button">${text('تغيير المجموعة')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form><h3>${text('المحتوى المشترك')}</h3><div class="list">${posts || `<p class="empty">${text('لا توجد مشاركات بعد.')}</p>`}</div>`;
      document.getElementById('userLogout').addEventListener('click', () => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); });
      const userRecords = data.records.filter(record => record.group === currentUser.selectedGroup).map(record => { const types = Array.isArray(record.types) ? record.types : [record.type || 'جدول']; const links = Array.isArray(record.links) ? record.links : (record.link ? [record.link] : []); return `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${record.subject ? `${escapeHtml(record.subject)} · ` : ''}${escapeHtml(types.join(' · '))} · ${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div>${links.map(link => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`).join('<br>')}${attachmentMarkup(record)}</div></div>`; }).join('');
      userContent.insertAdjacentHTML('beforeend', `<h3>${text('المواد والمشاركات')}</h3><div class="list">${userRecords || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div>`);
      document.querySelector('#userContent .profile').insertAdjacentHTML('beforeend', `<button class="btn secondary small" id="openUserGroup" type="button">${text('فتح المجموعة')}</button>`);
      document.getElementById('openUserGroup').addEventListener('click', () => renderGroupSubjects(null, currentUser.selectedGroup, true));
      document.getElementById('changeGroup').addEventListener('click', () => { currentUser.confirmed = false; renderUser(); });
      document.getElementById('postForm').addEventListener('submit', savePost);
    }

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
      showMessage(message, text('تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.'));
      userMode = 'login';
      window.setTimeout(renderUser, 700);
    }
    function loginUser(event) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      const user = data.users.find(item => item.email === email && item.password === password);
      if (!user) return showMessage(document.getElementById('userMessage'), text('اسم الدخول أو كلمة المرور غير صحيحة.'), 'error');
      activeUserId = user.id;
      viewMode = 'profile';
      localStorage.setItem(SESSION_KEY, user.id);
      renderUser();
    }

    function renderGroupChoice(user) {
      const options = data.groups.length ? data.groups.map(group => `<option value="${escapeHtml(group)}" ${user.selectedGroup === group ? 'selected' : ''}>${escapeHtml(group)}</option>`).join('') : `<option value="">${text('لا توجد مجموعات متاحة')}</option>`;
      userContent.innerHTML = `<div class="session-bar"><span>${text('مرحبًا، ')}${escapeHtml(user.name)}</span><button class="btn secondary small" id="userLogout" type="button">${text('تسجيل الخروج')}</button></div><p class="eyebrow">${text('اختيار المجموعة')}</p><h2>${text('اختر مجموعتك')}</h2><p class="subtext">${text('راجع اختيارك وأكّده للدخول إلى صفحة المستخدم.')}</p><form id="groupChoiceForm"><div class="field"><label for="groupChoice">${text('المجموعات المتاحة')}</label><select id="groupChoice" name="group" required>${options}</select></div><div class="actions"><button class="btn" type="submit">${text('تأكيد المجموعة')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
      document.getElementById('userLogout').addEventListener('click', () => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); });
      document.getElementById('groupChoiceForm').addEventListener('submit', event => { event.preventDefault(); user.selectedGroup = new FormData(event.currentTarget).get('group'); user.confirmed = data.groups.includes(user.selectedGroup); if (!saveData()) return showMessage(document.getElementById('userMessage'), text('تعذر حفظ التغيير في هذا المتصفح.'), 'error'); renderUser(); });
    }

    function savePost(event) {
      event.preventDefault();
      const user = data.users.find(item => item.id === activeUserId);
      const postText = String(new FormData(event.currentTarget).get('text')).trim();
      if (!user || !postText) return;
      data.posts.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), group: user.selectedGroup, author: user.name, text: postText, createdAt: new Date().toISOString() });
      if (!saveData()) return showMessage(document.getElementById('userMessage'), text('تعذر حفظ التغيير في هذا المتصفح.'), 'error');
      renderUser();
    }

    document.getElementById('brandHome').addEventListener('click', () => { viewMode = 'home'; renderUser(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.getElementById('mainNav').addEventListener('click', () => { viewMode = 'home'; renderUser(); });
    document.getElementById('signInNav').addEventListener('click', () => { viewMode = 'signin'; activeUserId = null; localStorage.removeItem(SESSION_KEY); userMode = 'login'; renderUser(); });
    document.getElementById('profileNav').addEventListener('click', () => { if (!activeUserId) return; viewMode = 'profile'; renderUser(); });
    renderUser();

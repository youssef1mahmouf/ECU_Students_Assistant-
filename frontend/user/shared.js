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

    // حالة التطبيق المشتركة بين كل الصفحات.
    const PAGE = document.body.dataset.page || 'home';
    const BASE = document.body.dataset.base || '.';
    let data = loadData();
    let activeUserId = null;
    const userContent = document.getElementById('userContent');
    if (userContent) {
      userContent.addEventListener('click', event => { const button = event.target.closest('[data-open-file]'); if (!button) return; openStoredFile(button.dataset.openFile, Number(button.dataset.fileIndex)); });
    }
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
    function recordActivity(action, metadata = {}) {
      data.activity.push({ actor: 'Main Super Admin', action, createdAt: new Date().toISOString(), ...metadata });
      saveData();
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
      document.getElementById('groupsNav').textContent = text('المجموعات');
      document.getElementById('mainNav').classList.toggle('active', PAGE === 'home');
      document.getElementById('signInNav').classList.toggle('active', PAGE === 'signin' || PAGE === 'register');
      document.getElementById('profileNav').classList.toggle('active', PAGE === 'profile');
      document.getElementById('groupsNav').classList.toggle('active', PAGE === 'groups');
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
    document.getElementById('headerAvatar').addEventListener('click', () => { if (activeUserId) window.location.href = pageUrl('profile'); });

    // التنقل بين الصفحات.
    document.getElementById('brandHome').addEventListener('click', () => { window.location.href = homeUrl(); });
    document.getElementById('mainNav').addEventListener('click', () => { window.location.href = homeUrl(); });
    document.getElementById('signInNav').addEventListener('click', () => { window.location.href = pageUrl('signin'); });
    document.getElementById('profileNav').addEventListener('click', () => { window.location.href = pageUrl('profile'); });
    document.getElementById('groupsNav').addEventListener('click', () => { window.location.href = pageUrl('groups'); });

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
    const rememberedUserId = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (rememberedUserId && data.users.some(user => user.id === rememberedUserId)) activeUserId = rememberedUserId;

    // أدوات مساعدة مشتركة بين الصفحات.
    function currentUser() { return data.users.find(user => user.id === activeUserId) || null; }
    function signOut() { activeUserId = null; localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }
    function pageUrl(name) { return BASE + '/' + name + '/index.html'; }
    function homeUrl() { return BASE + '/index.html'; }
    function groupUrl(group, mode) { return BASE + '/groups/index.html?group=' + encodeURIComponent(group) + (mode ? '&mode=' + encodeURIComponent(mode) : ''); }

    const FLASH_KEY = 'groupPortalFlashV1';
    function setFlash(kind, message) { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ kind, message })); } catch (error) { /* تجاهل */ } }
    function takeFlash() {
      try {
        const raw = sessionStorage.getItem(FLASH_KEY);
        if (!raw) return null;
        sessionStorage.removeItem(FLASH_KEY);
        return JSON.parse(raw);
      } catch (error) { return null; }
    }
    function renderFlash(target) { const flash = takeFlash(); if (flash && target) showMessage(target, flash.message, flash.kind); }

    setupLanguage();
    updateHeader();
    translatePage();

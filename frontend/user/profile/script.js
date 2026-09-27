let activityFilter = 'all';

    function renderProfile() {
      const user = currentUser();
      if (!user) { window.location.href = pageUrl('signin'); return; }
      if (user.role === 'superAdmin') { renderSuperAdmin(user); translatePage(); return; }
      if (!user.confirmed || !user.selectedGroup) { renderGroupChoice(user); translatePage(); return; }
        const posts = data.posts.filter(post => post.group === user.selectedGroup).map(post => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(post.author)}</strong><small>${escapeHtml(new Date(post.createdAt).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'ar-EG'))}</small><div>${escapeHtml(post.text)}</div></div></div>`).join('');
        userContent.innerHTML = `<div class="session-bar"><span>${text('حساب المستخدم')}</span><button class="btn secondary small" id="userLogout" type="button">${text('تسجيل الخروج')}</button></div><p class="eyebrow">${text('تم تسجيل الدخول')}</p><h2>${text('مرحبًا، ')}${escapeHtml(user.name)}</h2><p class="subtext">${text('المجموعة: ')}<span class="group-value">${escapeHtml(user.selectedGroup)}</span></p><div class="profile"><span class="avatar" aria-hidden="true">${escapeHtml(user.name.charAt(0))}</span><div><strong>${escapeHtml(user.name)}</strong><p>${escapeHtml(user.email)}</p><p>${text('يظهر هذا المحتوى لأعضاء مجموعتك فقط.')}</p></div></div><form id="postForm"><div class="field"><label for="postText">${text('مشاركة داخل المجموعة')}</label><textarea id="postText" name="text" maxlength="500" placeholder="${text('اكتب شيئًا لمشاركته مع مجموعتك...')}" required></textarea></div><div class="actions"><button class="btn" type="submit">${text('إرسال')}</button><button class="btn secondary" id="changeGroup" type="button">${text('تغيير المجموعة')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form><h3>${text('المحتوى المشترك')}</h3><div class="list">${posts || `<p class="empty">${text('لا توجد مشاركات بعد.')}</p>`}</div>`;
        document.getElementById('userLogout').addEventListener('click', () => { signOut(); window.location.href = homeUrl(); });
        const userRecords = data.records.filter(record => record.group === user.selectedGroup).map(record => { const types = Array.isArray(record.types) ? record.types : [record.type || 'جدول']; const links = Array.isArray(record.links) ? record.links : (record.link ? [record.link] : []); return `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${record.subject ? `${escapeHtml(record.subject)} · ` : ''}${escapeHtml(types.join(' · '))} · ${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div>${links.map(link => `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`).join('<br>')}${attachmentMarkup(record)}</div></div>`; }).join('');
        userContent.insertAdjacentHTML('beforeend', `<h3>${text('المواد والمشاركات')}</h3><div class="list">${userRecords || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div>`);
        document.querySelector('#userContent .profile').insertAdjacentHTML('beforeend', `<a class="btn secondary small" href="${groupUrl(user.selectedGroup)}">${text('فتح المجموعة')}</a>`);
        document.getElementById('changeGroup').addEventListener('click', () => { user.confirmed = false; saveData(); renderProfile(); });
        document.getElementById('postForm').addEventListener('submit', savePost);
      updateHeader();
      translatePage();
    }

    function renderGroupChoice(user) {
      const options = data.groups.length ? data.groups.map(group => `<option value="${escapeHtml(group)}" ${user.selectedGroup === group ? 'selected' : ''}>${escapeHtml(group)}</option>`).join('') : `<option value="">${text('لا توجد مجموعات متاحة')}</option>`;
      userContent.innerHTML = `<div class="session-bar"><span>${text('مرحبًا، ')}${escapeHtml(user.name)}</span><button class="btn secondary small" id="userLogout" type="button">${text('تسجيل الخروج')}</button></div><p class="eyebrow">${text('اختيار المجموعة')}</p><h2>${text('اختر مجموعتك')}</h2><p class="subtext">${text('راجع اختيارك وأكّده للدخول إلى صفحة المستخدم.')}</p><form id="groupChoiceForm"><div class="field"><label for="groupChoice">${text('المجموعات المتاحة')}</label><select id="groupChoice" name="group" required>${options}</select></div><div class="actions"><button class="btn" type="submit">${text('تأكيد المجموعة')}</button></div><p class="message" id="userMessage" aria-live="polite"></p></form>`;
      document.getElementById('userLogout').addEventListener('click', () => { signOut(); window.location.href = homeUrl(); });
      document.getElementById('groupChoiceForm').addEventListener('submit', event => { event.preventDefault(); user.selectedGroup = new FormData(event.currentTarget).get('group'); user.confirmed = data.groups.includes(user.selectedGroup); if (!saveData()) return showMessage(document.getElementById('userMessage'), text('تعذر حفظ التغيير في هذا المتصفح.'), 'error'); renderProfile(); });
    }

      function renderSuperAdmin(admin) {
        data.records = Array.isArray(data.records) ? data.records : [];
        const users = data.users.map(user => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.role === 'superAdmin' ? 'Super admin' : user.selectedGroup || 'No group')}</small></div></div>`).join('');
        const activityStart = activityFilter === 'day' ? Date.now() - 86400000 : activityFilter === 'week' ? Date.now() - 604800000 : activityFilter === 'month' ? Date.now() - 2592000000 : 0;
        const activity = data.activity.filter(item => new Date(item.createdAt).getTime() >= activityStart).slice().reverse().map(item => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(item.actor)}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'ar-EG'))}</small><div>${escapeHtml(item.action)}</div></div></div>`).join('');
        const groups = data.groups.map(group => { const count = data.records.filter(record => record.group === group).length; return `<article class="group-card"><div><h3>${escapeHtml(group)}</h3><small>${count} ${text('سجل')}</small></div><div class="actions"><a class="btn small" href="${groupUrl(group)}">${text('فتح')}</a><a class="btn secondary small" href="${groupUrl(group, 'schedule')}">${text('رفع الجدول')}</a><button class="btn secondary small" type="button" data-edit-group-card="${escapeHtml(group)}">${text('تعديل')}</button><button class="btn danger small" type="button" data-delete-group-card="${escapeHtml(group)}">${text('حذف')}</button></div></article>`; }).join('');
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
        document.getElementById('userLogout').addEventListener('click', () => { signOut(); window.location.href = homeUrl(); });
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

      function savePost(event) {
        event.preventDefault();
        const user = data.users.find(item => item.id === activeUserId);
        const postText = String(new FormData(event.currentTarget).get('text')).trim();
        if (!user || !postText) return;
        data.posts.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), group: user.selectedGroup, author: user.name, text: postText, createdAt: new Date().toISOString() });
        if (!saveData()) return showMessage(document.getElementById('userMessage'), text('تعذر حفظ التغيير في هذا المتصفح.'), 'error');
        renderProfile();
      }

    renderProfile();

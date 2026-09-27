let editingRecordId = null;

    function renderGroupsList(noticeGroup) {
      const viewer = currentUser();
      const cards = data.groups.map(group => {
        const count = data.records.filter(record => record.group === group).length;
        const canOpen = viewer && (viewer.role === 'superAdmin' || viewer.selectedGroup === group);
        const action = canOpen
          ? `<a class="btn small" href="${groupUrl(group)}">${text('الدخول')}</a>`
          : viewer
            ? `<button class="btn secondary small" type="button" disabled>${text('مغلق')}</button>`
            : `<a class="btn secondary small" href="${pageUrl('signin')}">${text('سجّل الدخول للوصول')}</a>`;
        return `<article class="group-card"><h3>${escapeHtml(group)}</h3><small>${count} ${text('سجل')}</small>${action}</article>`;
      }).join('');
      const notice = noticeGroup ? `<p class="message error">${text('هذه المجموعة لم تعد متاحة. اختر مجموعة أخرى.')}</p>` : '';
      userContent.innerHTML = `<p class="eyebrow">${text('المجموعات')}</p><h2>${text('المجموعات المتاحة')}</h2><p class="subtext">${text('المحتوى الذي أضافه السوبر أدمن فقط')}</p>${notice}<div class="group-grid">${cards || `<p class="empty">${text('لا توجد مجموعات متاحة')}</p>`}</div>`;
      updateHeader();
      translatePage();
    }

      function renderGroupSubjects(admin, group, readOnly = false) {
        const viewer = data.users.find(user => user.id === activeUserId);
        if (readOnly && (!viewer || (viewer.role !== 'superAdmin' && viewer.selectedGroup !== group))) return renderGroupsList();
        const subjects = data.subjects.filter(subject => subject.group === group);
        const scheduleRecords = data.records.filter(record => record.group === group && (record.types || [record.type]).includes('جدول'));
        const cards = subjects.map(subject => `<article class="group-card"><h3>${escapeHtml(subject.name)}</h3><small>${data.records.filter(record => record.group === group && record.subject === subject.name).length} ${text('سجل')}</small><button class="btn small" type="button" data-open-subject="${escapeHtml(subject.name)}">${text('فتح')}</button></article>`).join('');
        const schedule = scheduleRecords.map(record => `<div class="list-row"><div class="row-main"><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.date)} ${escapeHtml(record.time)}</small><div>${escapeHtml(record.details)}</div></div><button class="btn small" type="button" data-open-schedule="${escapeHtml(record.id)}">${text('فتح')}</button></div>`).join('');
        userContent.innerHTML = `<div class="session-bar"><button class="btn secondary small" id="backToGroups" type="button">${text('رجوع')}</button><span>${text('المجموعة')} ${escapeHtml(group)}</span></div><h2>${text('جدول المجموعة')}</h2><div class="list">${schedule || `<p class="empty">${text('لا توجد سجلات بعد.')}</p>`}</div><h2 style="margin-top:22px">${text('المواد')}</h2><div class="group-grid">${cards || `<p class="empty">${text('لا توجد مواد بعد.')}</p>`}</div>${readOnly ? '' : `<form id="subjectForm" class="manage-block" style="margin-top:15px"><div class="field"><label for="subjectName">${text('اسم المادة')}</label><input id="subjectName" name="subject" placeholder="${text('مثال: Mechatronics')}" required></div><div class="actions"><button class="btn small" type="submit">${text('إضافة مادة')}</button></div><p class="message" id="subjectMessage" aria-live="polite"></p></form>`}`;
        document.getElementById('backToGroups').addEventListener('click', () => renderGroupsList());
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
        document.getElementById('backToGroups').addEventListener('click', () => { editingRecordId = null; renderGroupSubjects(admin, group, false); });
        document.getElementById('recordForm').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); const types = form.getAll('types'); const record = { id: editingRecordId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), group, title: String(form.get('title')).trim(), types: types.length ? types : ['جدول'], date: String(form.get('date')), time: String(form.get('time')), details: String(form.get('details')).trim(), links: String(form.get('links')).split(/\r?\n/).map(link => link.trim()).filter(Boolean) }; const existingIndex = data.records.findIndex(item => item.id === editingRecordId); if (existingIndex >= 0) data.records[existingIndex] = record; else data.records.push(record); recordActivity(`${editingRecordId ? 'Updated' : 'Added'} a record in ${group}.`); saveData(); renderGroupRecords(admin, group); });
        document.getElementById('recordForm').addEventListener('submit', event => { const form = new FormData(event.currentTarget); const selectedSubject = String(form.get('subject')).trim(); const selectedClass = String(form.get('className')).trim(); const target = data.records.find(record => record.group === group && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))); if (target) { target.subject = selectedSubject; target.className = selectedClass; if (selectedSubject && !data.subjects.some(item => item.group === group && item.name === selectedSubject)) data.subjects.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), group, name: selectedSubject }); saveData(); } });
        document.getElementById('recordForm').addEventListener('submit', event => { const files = Array.from(event.currentTarget.querySelector('#recordFiles').files); if (!files.length) return; const form = new FormData(event.currentTarget); Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result }); reader.readAsDataURL(file); }))).then(attachments => { const target = data.records.find(record => record.group === group && record.title === String(form.get('title')).trim() && record.date === String(form.get('date')) && record.time === String(form.get('time'))); if (target) { target.attachments = attachments; saveData(); renderGroupRecords(admin, group); } }); });
        document.querySelectorAll('[data-edit-record]').forEach(button => button.addEventListener('click', () => { const record = data.records.find(item => item.id === button.dataset.editRecord); renderGroupRecords(admin, group, record); }));
        document.querySelectorAll('[data-delete-record]').forEach(button => button.addEventListener('click', () => { data.records = data.records.filter(record => record.id !== button.dataset.deleteRecord); recordActivity(`Deleted a record from ${group}.`); saveData(); renderGroupRecords(admin, group); }));
      }

    (function bootGroups() {
      const params = new URLSearchParams(window.location.search);
      const groupParam = params.get('group');
      const modeParam = params.get('mode');
      const viewer = currentUser();
      if (!groupParam || !data.groups.includes(groupParam)) return renderGroupsList(groupParam || null);
      const isAdmin = Boolean(viewer && viewer.role === 'superAdmin');
      if (modeParam === 'schedule' && isAdmin) { renderSchedulePage(viewer, groupParam); return; }
      if (!isAdmin && (!viewer || viewer.selectedGroup !== groupParam)) return renderGroupsList(groupParam);
      renderGroupSubjects(isAdmin ? viewer : null, groupParam, !isAdmin);
    })();
    translatePage();

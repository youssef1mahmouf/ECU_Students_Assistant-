function renderHome() {
      const currentUser = data.users.find(user => user.id === activeUserId);
      const groupCards = data.groups.map(group => { const count = data.records.filter(record => record.group === group).length; const canOpen = currentUser && (currentUser.role === 'superAdmin' || currentUser.selectedGroup === group); const button = canOpen ? `<a class="btn small" href="${groupUrl(group)}">${text('الدخول')}</a>` : currentUser ? `<button class="btn secondary small" type="button" disabled>${text('مغلق')}</button>` : `<a class="btn secondary small" href="${pageUrl('signin')}">${text('سجّل الدخول للوصول')}</a>`; return `<article class="group-card"><h3>${escapeHtml(group)}</h3><small>${count} ${text('سجل')}</small>${button}</article>`; }).join('');
      userContent.innerHTML = `<div class="profile"><span class="avatar" aria-hidden="true">م</span><div><p class="eyebrow">${text('بوابة الدخول')}</p><h2>${text('أهلًا بك في مساحة مجموعتك')}</h2><p>${text('المحتوى الذي أضافه السوبر أدمن فقط')}</p></div></div><h3>${text('المجموعات المتاحة')}</h3><div class="group-grid">${groupCards || `<p class="empty">${text('لا يوجد محتوى مضاف بعد.')}</p>`}</div><div class="actions"><a class="btn" href="${pageUrl('signin')}">${text('تسجيل الدخول')}</a></div>`;
      updateHeader();
    }

    renderHome();
    translatePage();

/**
 * Bilingual layer for every area (Arabic default, English toggle).
 *
 * One dictionary, two directions: each entry is [arabic, english], and the selected
 * language decides the index, so switching works identically ar -> en and en -> ar.
 *
 * Contract used by the pages:
 *   data-i18n                 translates textContent
 *   data-i18n-placeholder     translates the placeholder attribute
 *   data-i18n-label           translates the aria-label attribute
 *   data-page-title on <body> rebuilds document.title from the dictionary
 *
 * Text produced by the API (validation problems, error messages, success notices) is
 * translated by serverText(): the server keeps speaking English, the client renders it
 * in the active language. A missing key never leaks its identifier into the page.
 */
const STORAGE_KEY = 'ga6.language';

export const dictionary = {
  'a11y.skip': ['تخطي إلى المحتوى', 'Skip to content'],
  /* ------------------------------------------------------------- brand + nav */
  'brand': ['بوابة المجموعات', 'Group Portal'],
  'brand.sub': ['إدارة بسيطة للحسابات والمجموعات', 'Simple account and group management'],
  'nav.home': ['الرئيسية', 'Home'],
  'nav.groups': ['المجموعات', 'Groups'],
  /* Display label only. The key, the /guest/assessments/ route and every API
     name stay exactly as they are; this is the word a person reads. */
  'nav.assessments': ['المساعد', 'Assistant'],
  'nav.dashboard': ['لوحة التحكم', 'Dashboard'],
  'nav.accounts': ['الحسابات', 'Accounts'],
  'nav.activity': ['سجل النشاط', 'Activity log'],
  'nav.information': ['المعلومات', 'Information'],
  'nav.content': ['المحتوى', 'Content'],
  'nav.profile': ['الملف الشخصي', 'Profile'],
  'nav.signin': ['تسجيل الدخول', 'Sign in'],
  'nav.register': ['حساب جديد', 'Create account'],
  'nav.logout': ['تسجيل الخروج', 'Sign out'],
  'nav.account': ['الحساب', 'Account'],
  'nav.menu': ['القائمة', 'Menu'],
  'nav.language': ['اللغة', 'Language'],
  'nav.site': ['الموقع العام', 'Public site'],
  'nav.openMenu': ['فتح قائمة التنقل', 'Open navigation menu'],
  'nav.signedInAs': ['مسجّل الدخول باسم {name}', 'Signed in as {name}'],

  /* -------------------------------------------------------------- page titles */
  'title.home': ['الرئيسية', 'Home'],
  'title.guest': ['الصفحة العامة', 'Public home'],
  'title.signin': ['تسجيل الدخول', 'Sign in'],
  'title.register': ['حساب جديد', 'Create account'],
  'title.groups': ['المجموعات', 'Groups'],
  'title.profile': ['الملف الشخصي', 'Profile'],
  'title.assessments': ['التقييمات المعلنة', 'Published assessments'],
  'title.gateway': ['منطقة التحكم', 'Admin area'],
  'title.dashboard': ['لوحة التحكم', 'Dashboard'],
  'title.accounts': ['الحسابات', 'Accounts'],
  'title.groupsAdmin': ['المجموعات والمحتوى', 'Groups and content'],
  'title.activity': ['سجل النشاط', 'Activity log'],
  'title.information': ['المعلومات', 'Information'],
  'title.adminProfile': ['حسابي', 'My account'],

  /* ------------------------------------------------------------------ actions */
  'action.save': ['حفظ', 'Save'],
  'action.cancel': ['إلغاء', 'Cancel'],
  'action.create': ['إنشاء', 'Create'],
  'action.delete': ['حذف', 'Delete'],
  'action.approve': ['اعتماد', 'Approve'],
  'action.refresh': ['تحديث', 'Refresh'],
  'action.open': ['الدخول', 'Open'],
  'action.openGroup': ['دخول المجموعة', 'Enter group'],
  'action.join': ['طلب انضمام', 'Request to join'],
  'action.resetPassword': ['كلمة المرور', 'Password'],
  'action.enable': ['تفعيل', 'Enable'],
  'action.disable': ['تعطيل', 'Disable'],
  'action.rename': ['إعادة تسمية', 'Rename'],
  'action.publish': ['نشر', 'Publish'],
  'action.unpublish': ['إخفاء', 'Unpublish'],
  'action.all': ['الكل', 'All'],
  'action.haveAccount': ['لدي حساب بالفعل', 'I already have an account'],
  'action.continue': ['متابعة', 'Continue'],
  'action.changeEmail': ['تغيير البريد', 'Change email'],
  'action.setPassword': ['إنشاء كلمة مرور', 'Create a password'],
  'action.signInContent': ['تسجيل الدخول للوصول للمحتوى', 'Sign in to reach the content'],
  'action.backHome': ['العودة للرئيسية', 'Back to home'],
  'action.backToPublic': ['العودة للموقع العام', 'Back to the public site'],
  'action.previewAssessments': ['معاينة صفحة التقييمات', 'Preview the assessments page'],
  'package.uploadTitle': ['رفع حزمة محاضرة', 'Upload a lecture package'],
  'package.uploadHint': ['أنشئ أسبوعًا ومحاضرة، ثم أرفق ما تحتاجه فقط. كل ملف اختياري ويمكن اختيار أكثر من ملف.', 'Create a week and lecture, then attach only what you need. Every file is optional and you can choose several.'],
  'package.week': ['الأسبوع', 'Week'],
  'package.lecture': ['المحاضرة', 'Lecture'],
  'package.title': ['عنوان الحزمة', 'Package title'],
  'package.titlePlaceholder': ['المحاضرة 1', 'Lecture 1'],
  'package.notes': ['ملاحظات المحاضرة', 'Lecture notes'],
  'package.attachments': ['المرفقات الاختيارية', 'Optional attachments'],
  'package.fileHint': ['فيديو أو تسجيل صوتي أو PDF أو Word. يمكن ترك الملفات فارغة وإضافة الملاحظات فقط. لكل ملف حد الحجم الموضح من الخادم.', 'Choose video, audio recording, PDF or Word files. Leave files empty to save notes only. Each file follows the server size limit.'],
  'package.needContent': ['أضف ملاحظات أو اختر ملفًا واحدًا على الأقل.', 'Add notes or choose at least one file.'],
  'package.subjects': ['المواد', 'Subjects'],
  'package.pickSubject': ['اختر مادة لعرض أسابيعها ومحاضراتها.', 'Choose a subject to view its weeks and lectures.'],
  'package.empty': ['لا توجد محاضرات منشورة في هذه المادة حتى الآن.', 'There are no published lectures in this subject yet.'],
  'package.weekLecture': ['الأسبوع {week} · المحاضرة {lecture}', 'Week {week} · Lecture {lecture}'],
  'package.attachmentsNone': ['لا توجد ملفات مرفقة؛ اقرأ الملاحظات أعلاه.', 'No attached files; read the notes above.'],
  'package.otherMaterials': ['مواد إضافية', 'Other materials'],
  'package.fileLimit': ['الحد الأقصى لحجم الملف الواحد {size} ميجابايت.', 'The maximum size per file is {size} MB.'],
  'action.openAdmin': ['فتح لوحة التحكم', 'Open the admin area'],
  /* ------------------------------------------------------------------- fields */
  'field.name': ['الاسم', 'Name'],
  'field.email': ['البريد الإلكتروني', 'Email'],
  'field.password': ['كلمة المرور', 'Password'],
  'field.group': ['المجموعة', 'Group'],
  'field.currentPassword': ['كلمة المرور الحالية', 'Current password'],
  'field.newPassword': ['كلمة المرور الجديدة', 'New password'],
  'field.confirmPassword': ['تأكيد كلمة المرور', 'Confirm password'],
  'field.title': ['العنوان', 'Title'],
  'field.dueDate': ['تاريخ التسليم', 'Due date'],
  'field.dueDateShort': ['التسليم', 'Due'],
  'field.summary': ['الملخص', 'Summary'],
  'field.details': ['التفاصيل', 'Details'],
  'field.status': ['الحالة', 'Status'],
  'field.description': ['الوصف', 'Description'],
  'field.role': ['الدور', 'Role'],
  'field.kind': ['النوع', 'Kind'],
  'field.members': ['الأعضاء', 'Members'],
  'field.content': ['المحتوى', 'Content'],
  'field.actions': ['إجراءات', 'Actions'],
  'field.tagline': ['الوصف المختصر', 'Tagline'],
  'field.academicYear': ['العام الدراسي', 'Academic year'],
  'field.notice': ['الإشعار', 'Notice'],
  'field.about': ['عن البوابة', 'About the portal'],
  'field.level': ['المستوى', 'Level'],
  'field.limit': ['العدد', 'Rows'],
  'field.remember': ['تذكرني (يبقى تسجيل الدخول حتى تسجيل الخروج)', 'Remember me (stays signed in until you sign out)'],
  'field.emailExample': ['مثال: 123456789@ecu.edu.eg', 'Example: 123456789@ecu.edu.eg'],
  'field.publishLabel': ['نشر للطلاب وزوار صفحة التقييمات', 'Publish to students and to the assessments page'],
  'field.noGroup': ['بدون', 'None'],
  'field.noGroups': ['لا توجد مجموعات متاحة', 'No groups available'],
  'field.lastLoginNever': ['لم يسجّل الدخول بعد', 'Never signed in'],
  'field.lastLogin': ['آخر دخول', 'Last sign-in'],
  'field.emailLocked': ['البريد لا يتغير لأنه معرّف الحساب.', 'The email cannot change because it identifies the account.'],
  'field.passwordHint': ['8 أحرف على الأقل، مع حرف كبير ورقم ورمز مثل @.', 'At least 8 characters with an upper-case letter, a number and a symbol such as @.'],
  'field.createAdminHint': ['دور أدمن متاح للسوبر أدمن فقط.', 'The admin role is available to a super admin only.'],

  /* ------------------------------------------------------------------ statuses */
  'state.pending': ['بانتظار الاعتماد', 'Awaiting approval'],
  'state.confirmed': ['معتمد', 'Approved'],
  'state.published': ['منشور', 'Published'],
  'state.draft': ['مسودة', 'Draft'],
  'state.disabled': ['موقوف', 'Disabled'],
  'state.disabledShort': ['معطّل', 'Disabled'],
  'state.active': ['نشط', 'Active'],

  /* -------------------------------------------------------------------- roles */
  'role.user': ['طالب', 'Student'],
  'role.admin': ['أدمن', 'Admin'],
  'role.superAdmin': ['سوبر أدمن', 'Super admin'],

  /* ---------------------------------------------------------------- log levels */
  'level.auth': ['دخول', 'Sign-in'],
  'level.security': ['أمني', 'Security'],
  'level.admin': ['إداري', 'Admin'],
  'level.info': ['معلومة', 'Info'],
  /* -------------------------------------------------------------- guest pages */
  'guest.eyebrow': ['ECU · Students Assessment', 'ECU · Students Assessment'],
  'guest.title': ['مساحة المجموعات والتقييمات', 'The group and assessment space'],
  'guest.lead': ['معلومات عامة عن التقييمات، ثم تسجيل الدخول للوصول إلى محتوى مجموعتك.',
    'Public assessment information, then sign in to reach your group content.'],
  'guest.latest': ['آخر التقييمات المعلنة', 'Latest published assessments'],
  'guest.latestNote': ['هذه المعلومات عامة ومسموح بها للزوار. محتوى المجموعة الخاص يظهر بعد تسجيل الدخول والاعتماد.',
    'This information is public and allowed for visitors. Private group content appears after you sign in and get approved.'],
  'guest.groups': ['المجموعات', 'Groups'],
  'guest.how': ['كيف تصل إلى المحتوى؟', 'How do you reach the content?'],
  'guest.step1': ['أدخل بريدك الجامعي المعتمد وأنشئ كلمة مروره.', 'Enter your approved university email and set its password.'],
  'guest.step2': ['ينتظر الأدمن اعتماد انضمامك للمجموعة.', 'An administrator approves your group membership.'],
  'guest.step3': ['بعد الاعتماد ترى محتوى مجموعتك فقط.', 'After approval you see only your own group content.'],
  'guest.adminNote': ['الصفحات الإدارية للحسابات المخوّل بها فقط، ويتم التحقق من الصلاحية في الخادم.',
    'Admin pages are limited to authorised accounts, and the server checks every permission.'],
  'guest.publicEyebrow': ['معلومات عامة', 'Public information'],
  'guest.assessments': ['التقييمات المعلنة', 'Published assessments'],
  'guest.assessmentsNote': ['كل ما هو مسموح للزوار بمشاهدته. تفاصيل المجموعة الكاملة تتطلب تسجيل الدخول والاعتماد.',
    'Everything a visitor is allowed to see. Full group details need a sign-in and an approval.'],
  'guest.assessmentsCaption': ['جدول التقييمات المعلنة', 'Table of published assessments'],

  /* --------------------------------------------------------------- user pages */
  'user.welcome': ['أهلًا بك في مساحة مجموعتك', 'Welcome to your group space'],
  'user.lead': ['المحتوى الذي يضيفه الأدمن لمجموعتك فقط.', 'Only the content your administrator adds for your group.'],
  'user.groupsAvailable': ['المجموعات المتاحة', 'Available groups'],
  'user.myContent': ['محتوى مجموعتي', 'My group content'],
  'user.pendingNotice': ['طلبك بانتظار اعتماد الأدمن قبل فتح محتوى المجموعة.',
    'Your request is awaiting admin approval before group content opens.'],
  'user.signInToSee': ['سجّل الدخول لعرض مجموعتك ومحتواها.', 'Sign in to see your group and its content.'],
  'user.pickGroup': ['اختيار المجموعة', 'Choose your group'],
  'user.pickGroupNote': ['تغيير المجموعة يحتاج اعتمادًا جديدًا من الأدمن.', 'Changing group needs a fresh approval from an administrator.'],
  'user.groupContent': ['محتوى المجموعة', 'Group content'],
  'user.signinTitle': ['سجّل الدخول إلى حسابك', 'Sign in to your account'],
  'user.signinNote': ['ابدأ ببريدك الجامعي، ثم تظهر لك خطوة كلمة المرور.', 'Start with your university email, then the password step appears.'],
  'user.emailStepHint': ['استخدم بريدك الجامعي بدون مسافات.', 'Use your university email, without spaces.'],
  'user.signInAs': ['المتابعة باسم {email}', 'Continuing as {email}'],
  'user.noPasswordYet': ['لا توجد كلمة مرور لهذا البريد بعد. أنشئ كلمة مرور للمتابعة.', 'This address has no password yet. Create one to continue.'],
  'user.newAccount': ['أنشئ كلمة المرور الأولى', 'Create your first password'],
  'user.newAccountNote': ['أدخل بريدك الجامعي الموجود في القائمة المعتمدة. الاسم والمجموعة يؤخذان من القائمة، لا من هذا النموذج.',
    'Enter the university email that appears on the approved list. Your name and group come from that list, not from this form.'],
  'user.registerEmailHint': ['يتم فحص البريد في الخادم مقابل القائمة المعتمدة.', 'The server checks this address against the approved list.'],
  'user.emailCodeHint': ['أدخل الرمز المكوّن من 6 أرقام الذي وصلك على البريد.', 'Enter the six-digit code sent to your email.'],
  'field.emailCode': ['رمز التحقق', 'Verification code'],
  'action.sendCode': ['إرسال رمز تحقق', 'Send verification code'],
  'action.verifyCode': ['تأكيد الرمز', 'Verify code'],
  'msg.codeSent': ['إذا كان البريد مؤهلًا، سيصلك رمز التحقق قريبًا.', 'If this address is eligible, a verification code will arrive shortly.'],
  'msg.codeVerified': ['تم تأكيد البريد. يمكنك إنشاء حسابك الآن.', 'Email verified. You can create your account now.'],
  'msg.codeRequired': ['أدخل رمز التحقق المكوّن من 6 أرقام.', 'Enter the six-digit verification code.'],
  'msg.verifyEmailFirst': ['أكّد بريدك الإلكتروني قبل إنشاء الحساب.', 'Verify your email before creating the account.'],
  'msg.reportSavedNoEmail': ['تم حفظ البلاغ، لكن تعذر إرسال إشعار البريد. ستراه الإدارة في قائمة البلاغات.', 'Your report was saved, but its email notification could not be sent. Administrators can still see it in the reports list.'],
  'user.registerApprovalNote': ['بعد الإنشاء يعتمد الأدمن عضويتك في المجموعة قبل فتح المحتوى.',
    'After you create it, an administrator approves your group membership before the content opens.'],
  'user.editData': ['تعديل البيانات', 'Edit your details'],
  'user.changePassword': ['تغيير كلمة المرور', 'Change password'],
  'user.passwordChangedRelogin': ['تم تغيير كلمة المرور. سجّل الدخول من جديد.', 'Password changed. Please sign in again.'],
  'user.myGroup': ['مجموعتي: {group}', 'My group: {group}'],
  'user.myGroupNone': ['لم تُسند لك مجموعة بعد.', 'No group has been assigned to you yet.'],
  /* --------------------------------------------------------------- shared text */
  'msg.empty': ['لا يوجد محتوى بعد.', 'Nothing here yet.'],
  'msg.loading': ['جار التحميل…', 'Loading…'],
  'msg.error': ['حدث خطأ. حاول مرة أخرى.', 'Something went wrong. Please try again.'],
  'msg.saved': ['تم الحفظ.', 'Saved.'],
  'msg.denied': ['لا تملك صلاحية لهذا الإجراء.', 'You do not have permission for this action.'],
  'msg.network': ['تعذر الاتصال بالخادم. تحقق من تشغيل الخادم ثم أعد المحاولة.',
    'The server could not be reached. Check that the server is running and try again.'],
  'msg.requestFailed': ['فشل الطلب ({status}).', 'The request failed ({status}).'],
  'msg.busy': ['جارٍ التنفيذ…', 'Working…'],
  'msg.busySaving': ['جارٍ الحفظ…', 'Saving…'],
  'msg.busySigningIn': ['جارٍ تسجيل الدخول…', 'Signing in…'],
  'msg.busyCreating': ['جارٍ الإنشاء…', 'Creating…'],
  'msg.busyChecking': ['جارٍ التحقق…', 'Checking…'],
  'msg.fillEmailAndPassword': ['يرجى إدخال البريد الإلكتروني وكلمة المرور.', 'Enter the email address and the password.'],
  'msg.emailRequired': ['أدخل بريدك الجامعي أولًا.', 'Enter your university email first.'],
  'msg.passwordMismatch': ['كلمتا المرور غير متطابقتين.', 'The two passwords do not match.'],
  'msg.signinFailed': ['تعذر تسجيل الدخول.', 'Sign-in failed.'],
  'msg.signedIn': ['تم تسجيل الدخول.', 'Signed in.'],
  'msg.notAdminAccount': ['هذا الحساب ليس لديه صلاحية أدمن.', 'This account does not have admin access.'],
  'msg.updated': ['تم التحديث.', 'Updated.'],
  'msg.accountDeleted': ['تم حذف الحساب.', 'The account was deleted.'],
  'msg.accountCreated': ['تم إنشاء الحساب.', 'The account was created.'],
  'msg.accountCreatedAs': ['تم إنشاء الحساب {email}.', 'Account {email} was created.'],
  'msg.accountCreatedPending': ['تم إنشاء الحساب. انتظر اعتماد الأدمن.', 'Account created. Wait for admin approval.'],
  'msg.passwordSet': ['تم تعيين كلمة المرور.', 'The password was set.'],
  'msg.passwordChanged': ['تم تغيير كلمة المرور.', 'The password was changed.'],
  'msg.profileSaved': ['تم حفظ البيانات.', 'Your details were saved.'],
  'msg.dataSaved': ['تم حفظ البيانات.', 'The data was saved.'],
  'msg.dataLoadFailed': ['تعذر تحميل البيانات.', 'The data could not be loaded.'],
  'msg.statsLoadFailed': ['تعذر تحميل الأرقام.', 'The numbers could not be loaded.'],
  'msg.nameRequired': ['الاسم يجب أن يكون 3 أحرف على الأقل.', 'The name must be at least 3 characters.'],
  'msg.emailDomainRequired': ['يجب أن ينتهي البريد بـ @ecu.edu.eg.', 'The email must end with @ecu.edu.eg.'],
  'msg.passwordTooShort': ['كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'The password must be at least 8 characters.'],
  'msg.passwordPolicy': ['كلمة المرور تحتاج حرفًا كبيرًا ورقمًا ورمزًا.', 'The password needs an upper-case letter, a number and a symbol.'],
  'msg.groupRequired': ['اختر المجموعة.', 'Choose a group.'],
  'footer.createdBy': ['إنشاء', 'Created by'],
  'footer.contact': ['واتساب', 'WhatsApp'],
  'confirm.joinGroup': ['طلب الانضمام إلى {group}؟ سيتم إيقاف وصولك الحالي حتى اعتماد الطلب.',
    'Request to join {group}? Your current access stops until the request is approved.'],
  'confirm.deleteAccount': ['حذف حساب {name} نهائيًا؟', 'Permanently delete the account {name}?'],
  'confirm.deleteGroup': ['حذف مجموعة {name} نهائيًا؟', 'Permanently delete the group {name}?'],
  'confirm.deleteContent': ['حذف المحتوى {name} نهائيًا؟', 'Permanently delete the content {name}?'],
  'prompt.newPassword': ['كلمة مرور جديدة لـ {name} (8 أحرف على الأقل، حرف كبير ورقم ورمز):',
    'New password for {name} (at least 8 characters, with an upper-case letter, a number and a symbol):'],
  'prompt.renameGroup': ['الاسم الجديد لمجموعة {name}:', 'New name for the group {name}:'],
  /* --------------------------------------------------------------- admin pages */
  'admin.dashboard': ['لوحة التحكم', 'Dashboard'],
  'admin.groups': ['المجموعات', 'Groups'],
  'admin.accounts': ['الحسابات', 'Accounts'],
  'admin.activity': ['سجل النشاط', 'Activity log'],
  'admin.content': ['المحتوى', 'Content'],
  'admin.information': ['المعلومات', 'Information'],
  'admin.gatewayEyebrow': ['منطقة الأدمن', 'Admin area'],
  'admin.gatewayTitle': ['منطقة التحكم', 'Control area'],
  'admin.gatewayNote': ['هذه المنطقة لحسابات الأدمن فقط. كل صلاحية تٌتحقّق في الخادم.',
    'This area is for admin accounts only. Every permission is checked by the server.'],
  'admin.overview': ['نظرة عامة', 'Overview'],
  'admin.overviewNote': ['أرقام لحظية من مخزن البيانات.', 'Live numbers from the data store.'],
  'admin.recentActivity': ['آخر النشاط', 'Recent activity'],
  'admin.statsAccounts': ['الحسابات', 'Accounts'],
  'admin.statsPending': ['بانتظار الاعتماد', 'Awaiting approval'],
  'admin.statsContent': ['المحتوى', 'Content'],
  'admin.statsAdmins': ['الأدمن', 'Admins'],
  'admin.manageAccounts': ['إدارة الحسابات', 'Manage accounts'],
  'admin.manageAccountsNote': ['اعتماد الانضمام، التعطيل، تغيير المجموعة، إعادة تعيين كلمة المرور. السوبر أدمن فقط يغيّر الأدوار أو يدير حسابات الأدمن.',
    'Approve memberships, disable accounts, change groups and reset passwords. Only a super admin changes roles or manages staff accounts.'],
  'admin.accountsCaption': ['قائمة الحسابات', 'List of accounts'],
  'admin.newAccount': ['حساب جديد', 'New account'],
  'admin.manageGroups': ['إدارة المجموعات', 'Manage groups'],
  'admin.manageGroupsNote': ['تغيير اسم المجموعة ينقل الأعضاء والمحتوى تلقائيًا (يتحقق الخادم من ذلك).',
    'Renaming a group moves its members and content automatically (the server enforces this).'],
  'admin.groupsCaption': ['قائمة المجموعات', 'List of groups'],
  'admin.contentCaption': ['محتوى المجموعات', 'Group content'],
  'admin.siteInfo': ['بيانات الموقع', 'Site information'],
  'admin.siteInfoNote': ['هذه الحقول تظهر في الصفحة العامة وصفحة التقييمات.',
    'These fields appear on the public home and the assessments page.'],
  'admin.events': ['الأحداث المسجّلة', 'Recorded events'],
  'admin.eventsNote': ['لا يتضمن السجل أي كلمات مرور. السجل في وضع SQLite لا يُمسح من الواجهة.',
    'The log never contains passwords. In SQLite mode the log cannot be cleared from the interface.'],
  'admin.myData': ['البيانات', 'Details'],
  'admin.passwordHeading': ['كلمة المرور', 'Password'],
  'admin.passwordNote': ['بعد التغيير تٌغلق الجلسات الأخرى تلقائيًا.', 'After a change, your other sessions close automatically.'],
  /* ----------------------------------------------------- API validation messages */
  'v.required': ['{field} مطلوب.', '{field} is required.'],
  'v.mustText': ['{field} يجب أن يكون نصًا.', '{field} must be text.'],
  'v.invalidChars': ['{field} يحتوي على أحرف غير صالحة.', '{field} contains invalid characters.'],
  'v.minChars': ['{field} يجب أن يكون {min} أحرف على الأقل.', '{field} must be at least {min} characters.'],
  'v.maxChars': ['{field} يجب أن يقل عن {max} حرفًا.', '{field} must be under {max} characters.'],
  'v.invalid': ['{field} غير صالح.', '{field} is not valid.'],
  'v.idInvalid': ['{field} غير صحيح.', '{field} is invalid.'],
  'v.tooLong': ['{field} طويل جدًا.', '{field} is too long.'],
  'v.emailDomain': ['{field} يجب أن ينتهي بـ @{domain}.', '{field} must end with @{domain}.'],
  'v.passwordPolicy': ['{field} تحتاج حرفًا كبيرًا ورقمًا ورمزًا (مثل @).',
    '{field} needs an upper-case letter, a number and a symbol (e.g. @).'],
  'v.oneOf': ['{field} يجب أن تكون واحدة من: {options}.', '{field} must be one of: {options}.'],
  'v.groupChars': ['{field} يسمح بالأحرف والأرقام والمسافة و . ( ) + - فقط.',
    '{field} may contain letters, numbers, spaces, . ( ) + - only.'],

  /* -------------------------------------------------------- content type names */
  'kind.Assignment': ['تكليف', 'Assignment'],
  'kind.Exam': ['امتحان', 'Exam'],
  'kind.Quiz': ['اختبار قصير', 'Quiz'],
  'kind.Project': ['مشروع', 'Project'],
  'kind.Note': ['ملاحظة', 'Note'],
  'kind.Lecture': ['محاضرة', 'Lecture'],
  'action.backPortal': ['العودة للموقع العام', 'Back to the portal'],
  'action.changePassword': ['تغيير كلمة المرور', 'Change password'],
  'admin.accountList': ['قائمة الحسابات', 'Account list'],
  'admin.accountsManage': ['إدارة الحسابات', 'Accounts management'],
  'admin.accountsNote': ['اعتماد الانضمام، التعطيل، تغيير المجموعة، إعادة تعيين كلمة المرور. السوبر أدمن فقط يغيّر الأدوار أو يدير حسابات الأدمن.', 'Approve join requests, disable accounts, move them between groups, and reset passwords. Only the super admin changes roles or manages admin accounts.'],
  'admin.areaNote': ['هذه المنطقة لحسابات الأدمن فقط. كل صلاحية تُتحقّق في الخادم.', 'Sign in with an account that holds admin permissions to open the control area.'],
  'admin.areaTitle': ['منطقة التحكم', 'Admin sign-in'],
  'admin.dashLead': ['أرقام لحظية من مخزن البيانات.', 'Live numbers, groups, and the latest activity in one place.'],
  'admin.eyebrow': ['منطقة الأدمن', 'Admin area'],
  'admin.groupList': ['قائمة المجموعات', 'Group list'],
  'admin.groupsManage': ['إدارة المجموعات', 'Group management'],
  'admin.groupsNote': ['إنشاء المجموعات، إعادة تسميتها، وحذفها مع محتواها.', 'Create groups, rename them, and delete them together with their content.'],
  'admin.logNote': ['لا يتضمن السجل أي كلمات مرور. السجل في وضع SQLite لا يُمسح من الواجهة.', 'Every sign-in, security change, and admin action is recorded here.'],
  'admin.newGroup': ['مجموعة جديدة', 'New group'],
  'admin.newRecord': ['محتوى جديد', 'New content'],
  'admin.recordList': ['قائمة المحتوى', 'Content list'],
  'admin.roleHint': ['دور أدمن متاح للسوبر أدمن فقط.', 'The admin role is available to the super admin only.'],
  'admin.siteData': ['بيانات الموقع', 'Site information'],
  'admin.siteDataNote': ['هذه الحقول تظهر في الصفحة العامة وصفحة التقييمات.', 'These values appear across the site and can be updated by admins.'],
  'field.body': ['المحتوى', 'Content'],
  'field.contents': ['المحتويات', 'Contents'],
  'field.published': ['منشور للطلاب', 'Published to students'],
  'filter.admin': ['إداري', 'Admin'],
  'filter.all': ['الكل', 'All'],
  'filter.auth': ['دخول', 'Sign-in'],
  'filter.info': ['معلومة', 'Information'],
  'filter.security': ['أمني', 'Security'],
  'profile.changePassword': ['تغيير كلمة المرور', 'Change password'],
  'profile.details': ['بيانات الحساب', 'Account details'],
  'profile.passwordHint': ['سيتم إغلاق الجلسات في الأجهزة الأخرى بعد التغيير.', 'Other devices are signed out once the password changes.'],
  'profile.subtext': ['بيانات الحساب وكلمة المرور.', 'Account details and password.'],
  'profile.title': ['الملف الشخصي', 'Profile'],
  'title.admin': ['منطقة التحكم', 'Admin sign-in'],

  /* ------------------------------------------------ dashboard metrics */
  'admin.totalUsers': ['إجمالي الحسابات', 'Total accounts'],
  'admin.byRole': ['الحسابات حسب الدور', 'Accounts by role'],
  'admin.online': ['المتصلون الآن', 'Online now'],
  'admin.onlineNote': ['حساب لديه جلسة نشطة خلال آخر {minutes} دقيقة.', 'Accounts with a session seen in the last {minutes} minutes.'],
  'admin.activityCharts': ['مخططات النشاط', 'Activity charts'],
  'admin.chartNote': ['عدد الأحداث المسجّلة فعليًا في كل فترة، محسوبة من سجل النشاط.', 'Counts of real recorded events per period, taken from the activity log.'],
  'admin.chartDaily': ['يومي — آخر 14 يومًا', 'Daily — last 14 days'],
  'admin.chartWeekly': ['أسبوعي — آخر 8 أسابيع (الاثنين إلى الأحد)', 'Weekly — last 8 weeks (Monday to Sunday)'],
  'admin.chartMonthly': ['شهري — آخر 12 شهرًا', 'Monthly — last 12 months'],
  'admin.chartRange': ['النطاق: {from} → {to}', 'Range: {from} → {to}'],
  'admin.chartCount': ['{count} حدثًا', '{count} events'],
  'admin.chartsEmpty': ['لا أحداث في هذه الفترة.', 'No events in this period.'],
  'admin.viewPublic': ['عرض الصفحة العامة', 'View the public homepage'],
  'admin.viewPublicNote': ['تُفتح كما يراها الزائر تمامًا: بلا انتحال شخصية وبلا تجاوز صلاحيات.', 'Opens exactly as a visitor sees it: no impersonation and no permission bypass.'],
  'guest.previewNotice': ['أنت تعاين الصفحة العامة كما يراها الزائر (بلا انتحال شخصية).', 'You are previewing the public page exactly as a visitor sees it (no impersonation).'],

  /* ------------------------------------------------------- group management */
  'admin.editGroup': ['تعديل المجموعة', 'Edit group'],
  'admin.notesHint': ['ملاحظات داخلية للأدمن فقط ولا تظهر للطلاب.', 'Internal notes for admins only - students never see them.'],
  'admin.assignedSubjects': ['المواد المرتبطة', 'Assigned subjects'],
  'admin.membersCount': ['{count} عضوًا', '{count} members'],
  'admin.recordsCount': ['{count} عنصر محتوى', '{count} content items'],
  'admin.noSubjects': ['لا مواد مرتبطة بعد.', 'No subjects assigned yet.'],
  'field.notes': ['ملاحظات', 'Notes'],
  'field.groups': ['المجموعات', 'Groups'],
  'field.dueDateDefault': ['يُقترح بعد أسبوع من اليوم ويمكن تعديله.', 'Pre-filled one week from today; you can change it.'],
  'field.multiSelectHint': ['اختيار متعدد: Ctrl (أو Cmd) لتحديد أكثر من قيمة.', 'Multi-select: hold Ctrl (or Cmd) to choose more than one value.'],

  /* -------------------------------------------------------------- accounts */
  'role.adminAssistant': ['مساعد أدمن', 'Admin assistant'],
  'role.superAdminAssistant': ['مساعد سوبر أدمن', 'Super admin assistant'],
  'role.doctor': ['دكتور', 'Doctor'],
  'role.engineer': ['مهندس', 'Engineer'],
  'state.protected': ['حساب محمي', 'Protected account'],
  'admin.roleHintPrivileged': ['الأدوار غير الطلابية (مساعدون، دكتور، مهندس، أدمن) يُنشئها السوبر أدمن فقط.', 'Non-student roles (assistants, doctor, engineer, admin) can only be created by a super admin.'],
  'admin.protectedNote': ['الحساب الأساسي محمي: كلمة مروره وتعطيله وحذفه غير متاحة من هنا.', 'The primary owner account is protected: password, disable and delete are unavailable here.'],

  /* ----------------------------------------------------------- activity log */
  'admin.showWho': ['عرض', 'Show'],
  'filter.students': ['الطلاب', 'Students'],
  'admin.actorLabel': ['الشخص', 'Person'],
  'admin.allActors': ['كل الأشخاص', 'Everyone'],
  'action.details': ['التفاصيل', 'Details'],
  'admin.eventDetails': ['تفاصيل الحدث', 'Event details'],
  'admin.detailWho': ['من نفّذ الإجراء', 'Who performed it'],
  'admin.detailWhen': ['التاريخ والوقت', 'Date and time'],
  'admin.detailWhat': ['ما حدث', 'What happened'],
  'admin.detailWhere': ['الصفحة أو العنصر', 'Page or item'],
  'admin.detailType': ['نوع السجل', 'Record type'],
  'admin.kindAction': ['إجراء', 'Action'],
  'admin.kindPageview': ['زيارة صفحة', 'Page visit'],
  'action.close': ['إغلاق', 'Close'],

  /* ---------------------------------------------------------- problem reports */
  'nav.report': ['الإبلاغ عن مشكلة', 'Report a problem'],
  'problems.title': ['الإبلاغ عن مشكلة', 'Report a problem'],
  'problems.note': ['يُحفظ البلاغ ويظهر للإدارة، وتُرسل نسخة إلى بريد الدعم عند توفر البريد.', 'Your report is saved for administrators and emailed to the support inbox when email is configured.'],
  'problems.categoryBug': ['مشكلة تقنية', 'Technical bug'],
  'problems.categoryContent': ['محتوى غير صحيح', 'Incorrect content'],
  'problems.categoryAccount': ['مشكلة في الحساب', 'Account problem'],
  'problems.categoryGroup': ['مشكلة في المجموعة', 'Group problem'],
  'problems.categoryOther': ['موضوع آخر', 'Something else'],
  'problems.pageAuto': ['تُرفق الصفحة التي تُبلِّغ منها تلقائيًا.', 'The page you are reporting from is attached automatically.'],
  'field.category': ['التصنيف', 'Category'],
  'field.page': ['الصفحة', 'Page'],
  'msg.reportSent': ['تم إرسال البلاغ. سيراه الأدمن في قائمة البلاغات.', 'Your report was sent. An administrator will see it in the reports list.'],
  'admin.problems': ['البلاغات', 'Problem reports'],
  'admin.problemsManage': ['بلاغات المشاكل', 'Problem reports'],
  'admin.problemsNote': ['بلاغات المستخدمين المحفوظة مع المُبلِّغ والوقت والصفحة والتصنيف.', 'Stored user reports with reporter, time, page and category.'],
  'admin.problemList': ['قائمة البلاغات', 'List of reports'],
  'admin.problemReporter': ['المُبلِّغ', 'Reporter'],
  'admin.problemTime': ['الوقت', 'Time'],
  'admin.problemCategory': ['التصنيف', 'Category'],
  'admin.problemDescription': ['الوصف', 'Description'],
  'admin.problemPage': ['الصفحة', 'Page'],
  'admin.problemStatus': ['الحالة', 'Status'],
  'state.open': ['مفتوح', 'Open'],
  'state.resolved': ['تم الحل', 'Resolved'],
  'action.resolve': ['تحديد كمحلول', 'Mark resolved'],
  'action.reopen': ['إعادة الفتح', 'Reopen'],
  'admin.problemsEmpty': ['لا بلاغات بعد.', 'No reports yet.'],

  /* --------------------------------------------------------------- subjects */
  'admin.editSubject': ['تعديل المادة', 'Edit subject'],
  'admin.subjectEditNote': ['تغيير الأسماء والوصف فقط؛ المرجع (slug) يبقى لأنه اسم مجلد التخزين.', 'Only the names and the description change here; the reference (slug) stays because it names the storage folder.'],

  /* ---------------------------------------------------------------- profile */
  'profile.rosterName': ['الاسم الكامل في القائمة الرسمية', 'Full name on the official roster'],
  'profile.rosterNote': ['الاسم كما ورد في ملف المجموعة المعتمد، ولا يتغيّر من هنا.', 'The name exactly as printed on the approved group file; it cannot be changed here.'],
  'title.problems': ['البلاغات', 'Problem reports'],
  'title.report': ['الإبلاغ عن مشكلة', 'Report a problem'],
  'action.edit': ['تعديل', 'Edit'],
  'action.send': ['إرسال', 'Send'],
  'msg.sending': ['جارٍ الإرسال…', 'Sending…'],
  'msg.reportEmailed': ['تم حفظ البلاغ وإرسال إشعار إلى بريد الدعم.', 'Your report was saved and emailed to the support inbox.'],
  'problems.descriptionPlaceholder': ['اكتب ما حدث بالتفصيل…', 'Describe what happened in detail…'],

  /* ======================================================================
     Added by the 2026 redesign: brand, theme, notifications, the library
     explorer, the resource viewer and the shared data-state vocabulary.
     Kept in this one dictionary so a component never carries its own copy
     of a translated string.
     ====================================================================== */
  'brand.name': ['بوابة الطلاب', 'ECU Students Portal'],
  'brand.tag': ['مساحة التعلّم', 'Learning space'],

  'nav.library': ['المكتبة', 'Library'],
  'nav.documents': ['الملفات', 'Documents'],
  'nav.notifications': ['الإشعارات', 'Notifications'],
  'nav.support': ['الدعم', 'Support'],
  'nav.settings': ['الإعدادات', 'Settings'],
  'nav.security': ['الأمن', 'Security'],
  'nav.health': ['صحة النظام', 'System health'],
  'nav.libraryAdmin': ['فهرس المكتبة', 'Library index'],
  'nav.sectionOverview': ['نظرة عامة', 'Overview'],
  'nav.sectionPeople': ['الأشخاص', 'People'],
  'nav.sectionContent': ['المحتوى', 'Content'],
  'nav.sectionSystem': ['النظام', 'System'],
  'nav.sectionStudy': ['الدراسة', 'Study'],
  'nav.sectionBrowse': ['تصفح', 'Browse'],

  'theme.light': ['المظهر الفاتح', 'Light theme'],
  'theme.dark': ['المظهر الداكن', 'Dark theme'],
  'theme.system': ['حسب النظام', 'Match the system'],
  'theme.title': ['المظهر', 'Appearance'],
  'theme.label': ['السمة', 'Theme'],
  'theme.density': ['كثافة العرض', 'Display density'],
  'theme.densityComfortable': ['مريحة', 'Comfortable'],
  'theme.densityCompact': ['مضغوطة', 'Compact'],
  'theme.motion': ['الحركة', 'Motion'],
  'theme.motionFull': ['كاملة', 'Full'],
  'theme.motionReduced': ['مقلّلة', 'Reduced'],
  'theme.language': ['لغة الواجهة', 'Interface language'],
  'theme.note': ['تُحفظ هذه الاختيارات في هذا المتصفح فقط، ولا تُرسل إلى الخادم.', 'These choices are stored in this browser only and are never sent to the server.'],
  'theme.systemNote': ['يتبع إعداد نظام التشغيل ويتغير تلقائيًا.', 'Follows the operating system setting and changes automatically.'],

  /* ---------------------------------------------------- library explorer */
  'library.title': ['مكتبة المواد', 'Material library'],
  'library.subtitle': ['فهرس المواد الدراسية المشترك: المواد ثم الأسابيع ثم الجلسات ثم الملفات.', 'The shared teaching-material index: subjects, then weeks, then sessions, then files.'],
  'library.search': ['ابحث في المكتبة', 'Search the library'],
  'library.searchPlaceholder': ['اسم ملف…', 'File name…'],
  'library.loading': ['جار تحميل فهرس المكتبة…', 'Loading the library index…'],
  'library.root': ['المكتبة', 'Library'],
  'library.breadcrumbLabel': ['مسار المجلد', 'Folder path'],
  'library.subjectsWord': ['مادة', 'subjects'],
  'library.weeksWord': ['أسبوع', 'weeks'],
  'library.filesWord': ['ملف', 'files'],
  'library.folderMeta': ['{files} ملف · {count}', '{files} files · {count}'],
  'library.folderWeeks': ['{count} أسبوع', '{count} weeks'],
  'library.folderEmptyTitle': ['هذا المجلد فارغ', 'This folder is empty'],
  'library.folderEmptyBody': ['لا توجد ملفات مسجّلة في هذا المجلد حاليًا.', 'No files are recorded in this folder yet.'],
  'library.notFoundTitle': ['المجلد غير موجود', 'Folder not found'],
  'library.notFoundBody': ['الرابط يشير إلى مسار غير موجود في الفهرس.', 'The address points at a path the index does not contain.'],
  'library.backToRoot': ['العودة إلى جذر المكتبة', 'Back to the library root'],
  'library.notGeneratedTitle': ['فهرس المكتبة غير مُولَّد بعد', 'The library index has not been generated'],
  'library.notGeneratedBody': ['شغّل الأمر npm run import:library في الخادم ثم أعد تحميل الصفحة.', 'Run "npm run import:library" on the server, then reload this page.'],
  'library.searchResults': ['{count} نتيجة', '{count} results'],
  'library.openFolder': ['افتح المجلد', 'Open folder'],
  'library.updated': ['آخر تحديث للفهرس: {date}', 'Index generated: {date}'],

  /* --------------------------------------------------------- the viewer */
  'viewer.loading': ['جار تحضير الملف…', 'Preparing the file…'],
  'viewer.pageOf': ['صفحة {page} من {total}', 'Page {page} of {total}'],
  'viewer.previous': ['الصفحة السابقة', 'Previous page'],
  'viewer.next': ['الصفحة التالية', 'Next page'],
  'viewer.zoomIn': ['تكبير', 'Zoom in'],
  'viewer.zoomOut': ['تصغير', 'Zoom out'],
  'viewer.notFoundTitle': ['لا يمكن عرض هذا الملف', 'This file cannot be shown'],
  'viewer.notFoundBody': ['الملف غير موجود ضمن ما تملك صلاحية الوصول إليه.', 'The file is not among the ones you are entitled to open.'],
  'viewer.loadFailedTitle': ['تعذر تحضير الملف', 'Could not prepare the file'],
  'viewer.loadFailedBody': ['حدث خطأ أثناء جلب بيانات الملف من الخادم.', 'Something went wrong while fetching the file from the server.'],
  'viewer.renderFailedTitle': ['تعذر عرض الملف', 'Could not display the file'],
  'viewer.renderFailedBody': ['تحميل الملف نجح لكن عرضه داخل الصفحة فشل. يمكنك تنزيله بدلًا من ذلك.', 'The file loaded but could not be displayed in the page. You can download it instead.'],
  'viewer.noPreviewTitle': ['لا يمكن معاينة هذا النوع داخل الصفحة', 'This file type cannot be previewed here'],
  'viewer.noPreviewBody': ['استخدم زر التنزيل لفتحه بالبرنامج المناسب.', 'Use the download button to open it in a suitable application.'],

  /* ---------------------------------------------- the shared data states */
  'state.loading': ['جار التحميل…', 'Loading…'],
  'state.empty': ['لا توجد بيانات', 'Nothing here yet'],
  'state.error': ['حدث خطأ', 'Something went wrong'],

  /* ======================== admin pages, shared vocabulary and titles ==== */
  'title.library': ['مكتبة المواد', 'Material library'],
  'title.viewer': ['عارض الملفات', 'Resource viewer'],
  'title.documentsUser': ['ملفات مجموعتي', 'My group files'],
  'title.libraryAdmin': ['فهرس المكتبة', 'Library index'],
  'title.notifications': ['الإشعارات', 'Notifications'],
  'title.notificationsAdmin': ['إشعارات النظام', 'System notifications'],
  'title.security': ['الأمن', 'Security'],
  'title.health': ['صحة النظام', 'System health'],
  'title.settings': ['الإعدادات', 'Settings'],
  'title.settingsAdmin': ['إعدادات النظام', 'System settings'],

  'admin.quickLinks': ['روابط سريعة', 'Quick links'],
  'admin.library': ['فهرس المكتبة', 'Library index'],
  'admin.libraryNote': ['الفهرس يُولَّد من مجلد المواد على الخادم عبر npm run import:library.', 'The index is generated from the server material folder with npm run import:library.'],
  'admin.joinedOn': ['انضم في {date}', 'Joined {date}'],
  'admin.filterStaff': ['الطاقم', 'Staff'],
  'admin.managedByOwner': ['محمي', 'Protected'],
  'admin.noAccounts': ['لا توجد حسابات', 'No accounts'],
  'admin.noAccountsBody': ['لم يُنشأ أي حساب بعد.', 'No account has been created yet.'],
  'admin.noGroupsBody': ['لا توجد مجموعات بعد. أنشئ أول مجموعة للبدء.', 'There are no groups yet. Create the first one to begin.'],
  'admin.noRecordsBody': ['لا يوجد محتوى منشور أو مسودة لهذه المجموعة.', 'This group has no published content or drafts.'],
  'admin.noSubjects': ['لا توجد مواد', 'No subjects'],
  'admin.noSubjectsBody': ['أضف مادة لتتمكن من رفع الملفات داخلها.', 'Add a subject so files can be filed under it.'],
  'admin.noDocumentsBody': ['لم يُرفع أي ملف بعد.', 'No file has been uploaded yet.'],
  'admin.noActivityBody': ['لا توجد أحداث مسجّلة مطابقة لهذه المرشحات.', 'No recorded events match these filters.'],
  'admin.noProblems': ['لا توجد بلاغات', 'No reports'],
  'admin.noProblemsBody': ['لم يرسل أي مستخدم بلاغًا بعد.', 'No user has submitted a report yet.'],
  'admin.securityNote': ['أحداث الدخول والأمان المقروءة من سجل النشاط الفعلي.', 'Sign-in and security events, read from the real activity log.'],
  'admin.securityEvents': ['أحداث الدخول والأمان', 'Sign-in and security events'],
  'admin.securityTotal': ['إجمالي الأحداث', 'Total events'],
  'admin.securityLast24h': ['آخر 24 ساعة', 'Last 24 hours'],
  'admin.securityActors': ['أشخاص مختلفون', 'Distinct actors'],
  'admin.noSecurityEvents': ['لا توجد أحداث أمنية', 'No security events'],
  'admin.noSecurityEventsBody': ['لم يُسجَّل أي حدث دخول أو أمني بعد.', 'No sign-in or security event has been recorded yet.'],
  'admin.healthNote': ['الحالة كما يبلّغ عنها الخادم مباشرة.', 'Status as reported by the server itself.'],
  'admin.healthOk': ['الخدمة تعمل بشكل طبيعي', 'The service is responding normally'],
  'admin.healthDegraded': ['الخدمة لا تعمل كما هو متوقع', 'The service is not responding as expected'],
  'admin.healthUnreachable': ['تعذر الوصول إلى الخدمة', 'Could not reach the service'],
  'admin.healthUnreachableBody': ['لم يستجب نقطة الفحص الصحية. تحقق من تشغيل الخادم.', 'The health endpoint did not answer. Check that the server is running.'],
  'admin.healthStore': ['مخزن البيانات', 'Data store'],
  'admin.healthEnv': ['بيئة التشغيل', 'Environment'],
  'admin.healthTime': ['وقت الخادم', 'Server time'],
  'admin.healthFacts': ['تفاصيل الخدمة', 'Service details'],
  'admin.healthActions': ['إجراءات', 'Actions'],
  'admin.settingsNote': ['تفضيلات العرض محفوظة في هذا المتصفح، ومعلومات الموقع تُحرَّر من صفحة المعلومات.', 'Display preferences are stored in this browser; site copy is edited on the Information page.'],
  'admin.siteInfo': ['معلومات الموقع', 'Site information'],
  'admin.siteInfoNote': ['العنوان والوصف والإشعار الظاهرة على الصفحات العامة.', 'The title, tagline and notice shown on the public pages.'],

  'field.actor': ['الشخص', 'Actor'],
  'field.time': ['الوقت', 'Time'],
  'field.advisor': ['المرشد', 'Advisor'],
  'field.passwordConfirm': ['تأكيد كلمة المرور', 'Confirm password'],
  'field.passwordPolicy': ['حرف كبير ورقم ورمز، 8 أحرف على الأقل.', 'One upper-case letter, one number and one symbol, at least 8 characters.'],
  'footer.owner': ['Youssef Mahmoud Shaban', 'Youssef Mahmoud Shaban'],
  'meter.percent': ['{percent}٪', '{percent}%'],
  'package.dropTitle': ['اختر ملفات أو أفلتها هنا', 'Choose files or drop them here'],
  'profile.nameHint': ['اسم العرض فقط؛ لا يغيّر بيانات القائمة الرسمية.', 'Display name only; it does not change the official roster record.'],
  'profile.passwordChanged': ['تم تغيير كلمة المرور. سجّل الدخول من جديد.', 'Your password was changed. Please sign in again.'],
  'state.inactive': ['غير نشط', 'Inactive'],
  'state.active': ['نشط', 'Active'],
  'user.needApproval': ['بانتظار الاعتماد', 'Awaiting approval'],
  'user.pendingBody': ['يعتمد الأدمن عضويتك في المجموعة قبل أن يظهر المحتوى.', 'An administrator approves your group membership before content appears.'],
  'user.registerTitle': ['إنشاء كلمة مرور', 'Create your password'],
  'user.registerNote': ['التسجيل مغلق؛ يُقبل فقط البريد المدرج في القائمة الرسمية.', 'Registration is closed; only an address on the official roster is accepted.'],
  'user.codeHint': ['أرسل الرمز إلى بريدك ثم أدخله هنا.', 'Send the code to your email, then enter it here.'],
  'action.createPassword': ['إنشاء كلمة المرور', 'Create password'],
  'msg.accountApproved': ['تم اعتماد الحساب.', 'The account was approved.'],
  'msg.deleted': ['تم الحذف.', 'Deleted.'],
  'msg.readFailed': ['تعذّر قراءة الملف.', 'The file could not be read.'],

  /* ------------------------------------------------ student dashboard */
  'user.overview': ['نظرة سريعة', 'At a glance'],
  'user.statContent': ['محتوى منشور', 'Published items'],
  'user.noContentTitle': ['لا يوجد محتوى منشور بعد', 'Nothing published yet'],
  'user.noContentBody': ['ينشر الأدمن محتوى مجموعتك هنا، ويظهر فور نشره.', 'An administrator publishes your group content here; it appears as soon as it is published.'],
  'field.studentId': ['الرقم الجامعي', 'Student ID'],
  'documents.title': ['ملفات مجموعتي', 'My group files'],
  'documents.subtitle': ['الملفات التي رفعها الأدمن لمجموعتك فقط.', 'Files an administrator uploaded for your group only.'],
  'documents.libraryElsewhere': ['فهرس المكتبة المشترك له صفحته الخاصة.', 'The shared library index has its own page.'],
  'documents.openLibrary': ['افتح فهرس المكتبة', 'Open the library index'],
  'documents.emptyTitle': ['لا توجد ملفات لمجموعتك', 'No files for your group'],
  'documents.emptyBody': ['لم يرفع الأدمن أي ملف لمجموعتك بعد.', 'No administrator has uploaded a file to your group yet.'],
  'documents.count': ['{count} ملف', '{count} files'],
  'documents.size': ['الحجم', 'Size'],
  'documents.published': ['منشور', 'Published'],
  'documents.draft': ['مسودة', 'Draft'],
  'documents.uploadedBy': ['رفعه', 'Uploaded by'],
  'documents.filterSubject': ['كل المواد', 'All subjects'],
  'documents.updated': ['آخر تحديث: {date}', 'Updated: {date}'],
  'groups.title': ['مجموعتك', 'Your group'],
  'groups.subtitle': ['اختر مجموعتك؛ أي تغيير يحتاج اعتمادًا جديدًا من الأدمن.', 'Choose your group; any change needs fresh approval from an administrator.'],
  'groups.content': ['محتوى المجموعة', 'Group content'],
  'groups.yourGroup': ['مجموعتك', 'Your group'],
  'groups.join': ['طلب انضمام', 'Request to join'],
  'groups.requestSent': ['تم إرسال طلب الانضمام.', 'Your join request was sent.'],
  'support.title': ['الدعم والإبلاغ', 'Support and reporting'],
  'support.subtitle': ['أبلغ عن مشكلة في البوابة؛ يصل البلاغ للإدارة ويحفظ.', 'Report a problem in the portal; the report is saved and reaches an administrator.'],
  'profile.title': ['ملفي', 'My profile'],
  'profile.subtitle': ['بياناتك كما يراها النظام. الاسم فقط قابل للتعديل.', 'Your details as the system sees them. Only the display name can be edited.'],
  'profile.saved': ['تم حفظ التغييرات.', 'Your changes were saved.'],
  'settings.title': ['الإعدادات', 'Settings'],
  'settings.subtitle': ['تفضيلات العرض محفوظة في هذا المتصفح فقط.', 'Display preferences are stored in this browser only.'],


  'action.retry': ['إعادة المحاولة', 'Retry'],
  'action.viewAll': ['عرض الكل', 'View all'],
  'action.back': ['رجوع', 'Back'],
  'action.up': ['لأعلى', 'Up'],
  'action.search': ['بحث', 'Search'],
  'action.clear': ['مسح', 'Clear'],
  'action.openInViewer': ['فتح في العارض', 'Open in viewer'],
  'action.download': ['تنزيل', 'Download'],
  'action.markRead': ['تعليم الكل كمقروء', 'Mark all as read'],
  'action.openLibrary': ['افتح المكتبة', 'Open the library'],

  'msg.emptyBody': ['لا يوجد محتوى لعرضه هنا بعد.', 'There is nothing to show here yet.'],
  'msg.loadFailed': ['تعذر تحميل البيانات', 'Could not load this data'],
  'msg.loadFailedBody': ['حدث خطأ أثناء جلب البيانات من الخادم.', 'Something went wrong while fetching data from the server.'],
  'msg.retry': ['أعد المحاولة', 'Try again'],
  'msg.saved': ['تم الحفظ', 'Saved'],
  'msg.searchNoResults': ['لا نتائج', 'No results'],
  'msg.searchNoResultsBody': ['لا يوجد ملف بهذا الاسم. جرّب كلمة أقصر.', 'No file matches that name. Try a shorter word.'],
  'msg.searchHint': ['اكتب جزءًا من اسم الملف', 'Type part of a file name'],

  'level.security': ['أمني', 'Security'],
  'level.admin': ['إداري', 'Administrative'],
  'level.auth': ['دخول', 'Sign-in'],
  'level.content': ['محتوى', 'Content'],
  'level.info': ['معلومة', 'Information'],

  'kind.pdf': ['ملف PDF', 'PDF'],
  'kind.image': ['صورة', 'Image'],
  'kind.video': ['فيديو', 'Video'],
  'kind.audio': ['تسجيل صوتي', 'Audio'],
  'kind.text': ['نص', 'Text'],
  'kind.file': ['ملف', 'File'],

  'notif.title': ['الإشعارات', 'Notifications'],
  'notif.none': ['لا توجد إشعارات الآن.', 'There are no notifications right now.'],
  'notif.noneBody': ['ستظهر هنا الأحداث、重要 الإشعارات الجديدة.', 'New events and important updates will appear here.'],
  'notif.unreadCount': ['عدد الإشعارات غير المقروءة: {count}', 'Unread notifications: {count}'],
  'notif.markRead': ['تعليم الكل كمقروء', 'Mark all as read'],
  'notif.actorLabel': ['بواسطة {actor}', 'by {actor}'],
  'notif.unread': ['غير مقروء', 'Unread'],
  'notif.read': ['مقروء', 'Read'],
  'notif.filterAll': ['الكل', 'All'],
  'notif.sourceNote': ['هذه الإشعارات مبنية على السجل الفعلي في الخادم، ولا تحتوي أي بيانات تجريبية.', 'These notifications are derived from the real server log and contain no sample data.'],

};

/** Field names the API interpolates into its validation messages. */
const FIELD_NAMES = {
  Name: ['الاسم', 'Name'],
  Email: ['البريد الإلكتروني', 'Email'],
  Password: ['كلمة المرور', 'Password'],
  Group: ['المجموعة', 'Group'],
  'Group name': ['اسم المجموعة', 'Group name'],
  'Group id': ['معرّف المجموعة', 'Group id'],
  Title: ['العنوان', 'Title'],
  Summary: ['الملخص', 'Summary'],
  Body: ['التفاصيل', 'Details'],
  Description: ['الوصف', 'Description'],
  Kind: ['النوع', 'Kind'],
  'Due date': ['تاريخ التسليم', 'Due date'],
  Status: ['الحالة', 'Status'],
  Role: ['الدور', 'Role'],
  Tagline: ['الوصف المختصر', 'Tagline'],
  'Academic year': ['العام الدراسي', 'Academic year'],
  Notice: ['الإشعار', 'Notice'],
  About: ['عن البوابة', 'About the portal'],
  Content: ['المحتوى', 'Content'],
  'Group name': ['اسم المجموعة', 'Group name'],
  'Group id': ['معرّف المجموعة', 'Group id'],
  'Academic year': ['السنة الدراسية', 'Academic year'],
  'Account id': ['معرّف الحساب', 'Account id'],
  'Record id': ['معرّف المحتوى', 'Record id'],
  Subject: ['المادة', 'Subject'],
  'Subject id': ['معرّف المادة', 'Subject id'],
  'Document id': ['معرّف الملف', 'Document id'],
  'English name': ['الاسم بالإنجليزية', 'English name'],
  'Arabic name': ['الاسم بالعربية', 'Arabic name'],
  Code: ['الرمز', 'Code'],
  'Display name': ['الاسم المعروض', 'Display name'],
  Identifier: ['المعرّف', 'Identifier'],
  Value: ['القيمة', 'Value'],
  Notes: ['الملاحظات', 'Notes'],
  Category: ['التصنيف', 'Category'],
  Page: ['الصفحة', 'Page'],
  Subjects: ['المواد', 'Subjects'],
  'Problem id': ['معرّف البلاغ', 'Report id'],
  Who: ['المحدد', 'Filter'],
};

/** Exact strings the API answers with, mapped to a dictionary key. */
const SERVER_EXACT = {
  /* backend/src/lib/errors.js - the defaults every typed error falls back to. */
  'Invalid request.': 'server.invalidRequest',
  'Authentication required.': 'server.authRequired',
  'You do not have permission to perform this action.': 'server.forbidden',
  'Not found.': 'server.notFound',
  'Resource already exists.': 'server.conflict',
  'Too many attempts. Try again later.': 'server.rateLimitedDefault',
  'Email or password is incorrect.': 'server.creds',
  'This email is not registered for access to this portal.': 'server.notRegistered',
  'Password is required.': 'server.passwordRequired',
  'This account has been disabled.': 'server.accountDisabled',
  'This account has been disabled. Contact an administrator.': 'server.accountDisabledContact',
  'Sign in to continue.': 'server.signInRequired',
  'Administrator access required.': 'server.adminRequired',
  'Super admin access required.': 'server.superRequired',
  'Join a group to view its content.': 'server.joinGroupRequired',
  'Your group membership is awaiting approval.': 'server.pendingApproval',
  'Security token missing or invalid. Reload the page and try again.': 'server.csrf',
  'Cross-origin request blocked.': 'server.crossOrigin',
  'Too many attempts. Please wait before trying again.': 'server.rateLimited',
  'Too many sign-in attempts. Try again in a few minutes.': 'server.signinRateLimited',
  'An account already uses this email address.': 'server.emailTaken',
  'A group with this name already exists.': 'server.groupExists',
  'Group not found.': 'server.groupNotFound',
  'Content not found.': 'server.contentNotFound',
  'Account not found.': 'server.accountNotFound',
  'The selected group is not available.': 'server.groupUnavailable',
  'You cannot delete your own account.': 'server.deleteOwn',
  'You cannot disable or demote your own account.': 'server.disableOwn',
  'At least one active super admin must remain.': 'server.superMustRemain',
  'Only a super admin can change roles.': 'server.roleOnlySuper',
  'Only a super admin can create administrator accounts.': 'server.adminCreateOnlySuper',
  'Only a super admin can manage staff accounts.': 'server.staffManageOnlySuper',
  'The new password must be different.': 'server.passwordSame',
  'Current password is incorrect.': 'server.currentPasswordWrong',
  'Verify your email address before creating an account.': 'msg.verifyEmailFirst',
  'The code is invalid or expired. Request a new code.': 'server.emailCodeInvalid',
  'Enter the six-digit code from your email.': 'msg.codeRequired',
  'Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM.': 'server.mailNotConfigured',
  'Account created. An administrator must approve your group membership before group content opens.': 'server.accountCreatedPending',
  'Request sent. An administrator must approve the new group.': 'server.groupRequestSent',
  'Password updated. Other devices were signed out.': 'server.passwordUpdated',
  'Password reset. The account was signed out everywhere.': 'server.passwordReset',
  'Signed out.': 'server.signedOut',
  'Account deleted.': 'server.accountDeleted',
  'Group deleted.': 'server.groupDeleted',
  'Content deleted.': 'server.contentDeleted',
  'Unknown API route.': 'server.unknownRoute',
  /* subjects + documents */
  'Subject not found.': 'server.subjectNotFound',
  'A subject with this reference already exists.': 'server.subjectExists',
  'The selected subject is not available.': 'server.subjectUnavailable',
  'This subject is archived; pick an active one.': 'server.subjectArchived',
  'Document not found.': 'server.documentNotFound',
  'The stored file is no longer available on this server.': 'server.documentFileMissing',
  'Document deleted.': 'server.documentDeleted',
  'Choose a file to upload.': 'server.fileRequired',
  'The uploaded file is empty.': 'server.fileEmpty',
  'The uploaded data is not a valid file.': 'server.fileInvalid',
  'This file type is not allowed. Upload a PDF or an image (PNG, JPG, WebP, GIF).': 'server.fileTypeRefused',
  'The file content does not match its extension, so it was rejected.': 'server.fileContentMismatch',
  'A file with this name already exists.': 'server.fileExists',
  'This document path is not allowed.': 'server.documentPathRefused',
  'Display name is too short.': 'server.displayTooShort',
  /* roles, owner protection, problem reports */
  'Only a super admin can create or assign privileged roles.': 'server.privilegedRolesOnlySuper',
  'The protected owner account cannot be disabled through the admin API.': 'server.ownerProtected',
  'The protected owner account cannot be re-roled through the admin API.': 'server.ownerProtected',
  'The protected owner account cannot be password-reset through the admin API.': 'server.ownerProtected',
  'The protected owner account cannot be deleted through the admin API.': 'server.ownerProtected',
  'The protected owner account cannot be moved between groups through the admin API.': 'server.ownerProtected',
  'Report sent. An administrator will see it in the reports list.': 'server.reportSent',
  'Report not found.': 'server.problemNotFound',
  'Subjects must be a list.': 'server.subjectsList',
  'A group accepts at most 50 subjects.': 'server.tooManySubjects',
  'Group accepts at most 25 groups.': 'server.tooManyGroups',
};

/* The Arabic side of every message the API can answer with. The English side repeats the
   canonical server sentence, so a message always reads in the language the user picked. */
Object.assign(dictionary, {
  'server.invalidRequest': ['الطلب غير صالح.', 'Invalid request.'],
  'server.authRequired': ['يجب تسجيل الدخول للمتابعة.', 'Authentication required.'],
  'server.forbidden': ['ليس لديك صلاحية لتنفيذ هذا الإجراء.', 'You do not have permission to perform this action.'],
  'server.notFound': ['العنصر غير موجود.', 'Not found.'],
  'server.conflict': ['العنصر موجود بالفعل.', 'Resource already exists.'],
  'server.rateLimitedDefault': ['محاولات كثيرة. أعد المحاولة بعد قليل.', 'Too many attempts. Try again later.'],
  'server.creds': ['البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Email or password is incorrect.'],
  'server.notRegistered': ['هذا البريد غير مسجّل للوصول إلى هذه البوابة.', 'This email is not registered for access to this portal.'],
  'server.passwordRequired': ['كلمة المرور مطلوبة.', 'Password is required.'],
  'server.accountDisabled': ['تم إيقاف هذا الحساب.', 'This account has been disabled.'],
  'server.accountDisabledContact': ['تم إيقاف هذا الحساب. تواصل مع الإدارة.', 'This account has been disabled. Contact an administrator.'],
  'server.signInRequired': ['سجّل الدخول للمتابعة.', 'Sign in to continue.'],
  'server.adminRequired': ['هذه المنطقة مخصّصة لحسابات الأدمن.', 'Administrator access required.'],
  'server.superRequired': ['هذه العملية تتطلب حساب أدمن عام.', 'Super admin access required.'],
  'server.joinGroupRequired': ['انضم إلى مجموعة لعرض محتواها.', 'Join a group to view its content.'],
  'server.pendingApproval': ['عضويتك في المجموعة بانتظار الاعتماد.', 'Your group membership is awaiting approval.'],
  'server.csrf': ['رمز الأمان مفقود أو غير صالح. حدّث الصفحة ثم حاول مجددًا.', 'Security token missing or invalid. Reload the page and try again.'],
  'server.crossOrigin': ['تم حظر الطلب لأنه صدر من مصدر آخر.', 'Cross-origin request blocked.'],
  'server.rateLimited': ['محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.', 'Too many attempts. Please wait before trying again.'],
  'server.signinRateLimited': ['محاولات دخول كثيرة. أعد المحاولة بعد دقائق.', 'Too many sign-in attempts. Try again in a few minutes.'],
  'server.emailTaken': ['هذا البريد الإلكتروني مستخدم بالفعل.', 'An account already uses this email address.'],
  'server.groupExists': ['توجد مجموعة بهذا الاسم بالفعل.', 'A group with this name already exists.'],
  'server.groupNotFound': ['لم يتم العثور على المجموعة.', 'Group not found.'],
  'server.contentNotFound': ['لم يتم العثور على المحتوى.', 'Content not found.'],
  'server.accountNotFound': ['لم يتم العثور على الحساب.', 'Account not found.'],
  'server.groupUnavailable': ['المجموعة المختارة غير متاحة حاليًا.', 'The selected group is not available.'],
  'server.deleteOwn': ['لا يمكنك حذف حسابك.', 'You cannot delete your own account.'],
  'server.disableOwn': ['لا يمكنك تعطيل حسابك أو خفض صلاحيتك.', 'You cannot disable or demote your own account.'],
  'server.superMustRemain': ['يجب أن يبقى أدمن عامّ نشط واحدًا على الأقل.', 'At least one active super admin must remain.'],
  'server.roleOnlySuper': ['تغيير الأدوار متاح للأدمن العام فقط.', 'Only a super admin can change roles.'],
  'server.adminCreateOnlySuper': ['إنشاء حسابات أدمن متاح للأدمن العام فقط.', 'Only a super admin can create administrator accounts.'],
  'server.staffManageOnlySuper': ['إدارة حسابات الأدمن متاحة للأدمن العام فقط.', 'Only a super admin can manage staff accounts.'],
  'server.passwordSame': ['كلمة المرور الجديدة يجب أن تختلف عن الحالية.', 'The new password must be different.'],
  'server.currentPasswordWrong': ['كلمة المرور الحالية غير صحيحة.', 'Current password is incorrect.'],
  'server.emailCodeInvalid': ['الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.', 'The code is invalid or expired. Request a new code.'],
  'server.mailNotConfigured': ['إرسال البريد غير مضبوط على الخادم. تواصل مع الإدارة.', 'Email delivery is not configured on the server. Contact an administrator.'],
  'server.accountCreatedPending': ['تم إنشاء الحساب. على الأدمن اعتماد عضويتك في المجموعة قبل فتح المحتوى.', 'Account created. An administrator must approve your group membership before group content opens.'],
  'server.groupRequestSent': ['تم إرسال الطلب. على الأدمن اعتماد المجموعة الجديدة.', 'Request sent. An administrator must approve the new group.'],
  'server.passwordUpdated': ['تم تحديث كلمة المرور، وسُجّل الخروج من الأجهزة الأخرى.', 'Password updated. Other devices were signed out.'],
  'server.passwordReset': ['تم تعيين كلمة المرور، وسُجّل الخروج من كل الأجهزة.', 'Password reset. The account was signed out everywhere.'],
  'server.signedOut': ['تم تسجيل الخروج.', 'Signed out.'],
  'server.accountDeleted': ['تم حذف الحساب.', 'Account deleted.'],
  'server.groupDeleted': ['تم حذف المجموعة.', 'Group deleted.'],
  'server.contentDeleted': ['تم حذف المحتوى.', 'Content deleted.'],
  'server.unknownRoute': ['هذا المسار غير موجود في الواجهة البرمجية.', 'Unknown API route.'],
  'server.subjectNotFound': ['لم يتم العثور على المادة.', 'Subject not found.'],
  'server.subjectExists': ['توجد مادة بنفس المرجع بالفعل.', 'A subject with this reference already exists.'],
  'server.subjectUnavailable': ['المادة المختارة غير متاحة حاليًا.', 'The selected subject is not available.'],
  'server.subjectArchived': ['هذه المادة مؤرشفة، اختر مادة نشطة.', 'This subject is archived; pick an active one.'],
  'server.documentNotFound': ['لم يتم العثور على الملف.', 'Document not found.'],
  'server.documentFileMissing': ['الملف المخزّن لم يعد متاحًا على هذا الخادم.', 'The stored file is no longer available on this server.'],
  'server.documentDeleted': ['تم حذف الملف.', 'Document deleted.'],
  'server.fileRequired': ['اختر ملفًا للرفع.', 'Choose a file to upload.'],
  'server.fileEmpty': ['الملف المرفوع فارغ.', 'The uploaded file is empty.'],
  'server.fileInvalid': ['البيانات المرفوعة ليست ملفًا صالحًا.', 'The uploaded data is not a valid file.'],
  'server.fileTypeRefused': ['نوع الملف غير مسموح. ارفع PDF أو صورة (PNG أو JPG أو WebP أو GIF).', 'This file type is not allowed. Upload a PDF or an image (PNG, JPG, WebP, GIF).'],
  'server.fileContentMismatch': ['محتوى الملف لا يطابق الامتداد، لذلك تم رفضه.', 'The file content does not match its extension, so it was rejected.'],
  'server.fileExists': ['يوجد ملف بهذا الاسم بالفعل.', 'A file with this name already exists.'],
  'server.documentPathRefused': ['مسار هذا الملف غير مسموح.', 'This document path is not allowed.'],
  'server.displayTooShort': ['الاسم المعروض قصير جدًا.', 'Display name is too short.'],
});


/* Keys for the subjects and documents areas. They merge into the same dictionary, so the
   language switch treats them exactly like every other entry. */
Object.assign(dictionary, {
  'nav.documents': ['الملفات', 'Documents'],
  'nav.subjects': ['المواد', 'Subjects'],
  'title.subjects': ['المواد', 'Subjects'],
  'title.documentsAdmin': ['الملفات', 'Documents'],
  'title.userDocuments': ['ملفات المجموعة', 'Group documents'],
  'admin.subjects': ['المواد', 'Subjects'],
  'admin.subjectsManage': ['إدارة المواد', 'Manage subjects'],
  'admin.subjectsNote': ['المواد تنظّم ملفات كل مجموعة. المرجع المختصر يسمّي مجلد التخزين ولا يتغيّر بعد الإنشاء.', 'Subjects organise the files of each group. The short reference names the storage folder and never changes after creation.'],
  'admin.subjectList': ['قائمة المواد', 'Subject list'],
  'admin.newSubject': ['مادة جديدة', 'New subject'],
  'admin.subjectReferenceHint': ['مثال: math-1', 'For example: math-1'],
  'admin.documents': ['الملفات', 'Documents'],
  'admin.documentsManage': ['إدارة الملفات', 'Manage documents'],
  'admin.documentsNote': ['صور و PDF فقط. تُخزَّن الملفات في مجلدات آمنة داخل الخادم وتُخدم بعد التحقق من الصلاحية.', 'Images and PDF only. Files live in safe folders on the server and are served through the permission check.'],
  'admin.documentList': ['قائمة الملفات', 'Document list'],
  'admin.uploadDocument': ['رفع ملف', 'Upload a document'],
  'admin.uploadHint': ['PDF أو صورة (PNG، JPG، WebP، GIF). يٌتحقق من النوع من محتوى الملف نفسه.', 'PDF or an image (PNG, JPG, WebP, GIF). The type is proven from the file content itself.'],
  'user.documents': ['ملفاتي', 'My documents'],
  'user.documentsTitle': ['ملفات مجموعتك', 'Your group documents'],
  'user.documentsNote': ['تظهر هنا ملفات مجموعتك المنشورة فقط. غير المنشور وملفات المجموعات الأخرى لا تٌعرض ولا تٌفتح.', 'Only published documents of your own group appear here. Drafts and other groups are neither listed nor opened.'],
  'user.documentsEmpty': ['لا توجد ملفات منشورة لمجموعتك بعد.', 'No published documents for your group yet.'],
  'field.subject': ['المادة', 'Subject'],
  'field.reference': ['المرجع', 'Reference'],
  'field.code': ['الرمز', 'Code'],
  'field.nameEn': ['الاسم بالإنجليزية', 'English name'],
  'field.nameAr': ['الاسم بالعربية', 'Arabic name'],
  'field.files': ['الملفات', 'Files'],
  'field.fileName': ['اسم الملف', 'File name'],
  'field.size': ['الحجم', 'Size'],
  'field.file': ['الملف', 'File'],
  'field.displayName': ['الاسم المعروض', 'Display name'],
  'field.uploadedBy': ['رفعه', 'Uploaded by'],
  'field.publishedToStudents': ['متاح للطلاب', 'Available to students'],
  'action.upload': ['رفع', 'Upload'],
  'action.uploadToFolders': ['رفع في المجلدات', 'Upload to folders'],
  'action.viewPublicSite': ['عرض الموقع العام', 'View the public site'],
  'field.folder': ['المجلد', 'Folder'],
  'package.sessionKind': ['نوع الجلسة', 'Session type'],
  'package.session': ['رقم الجلسة', 'Session number'],
  'kind.lecture': ['محاضرة', 'Lecture'],
  'kind.tutorial': ['تمارين', 'Tutorial'],
  'kind.lab': ['معمل', 'Lab'],
  'msg.replacedSlot': ['ملف تم استبداله بنفس المجلد', 'file(s) replaced in the same folder'],
  'msg.documentsSaved': ['تم الحفظ داخل المجلدات', 'Saved into the folders'],
  'action.download': ['تنزيل', 'Download'],
  'action.archive': ['أرشفة', 'Archive'],
  'action.restore': ['إعادة تنشيط', 'Restore'],
  'state.archived': ['مؤرشفة', 'Archived'],
  'msg.subjectCreated': ['تم إنشاء المادة.', 'Subject created.'],
  'msg.documentUploaded': ['تم رفع الملف.', 'Document uploaded.'],
  'msg.documentUpdated': ['تم تحديث الملف.', 'Document updated.'],
  'msg.documentDeleted': ['تم حذف الملف.', 'Document deleted.'],
  'msg.pickFileFirst': ['اختر ملفًا أولًا.', 'Choose a file first.'],
  'msg.uploading': ['جارٍ الرفع…', 'Uploading…'],
  'msg.saving': ['جارٍ الحفظ…', 'Saving…'],
  'msg.checking': ['جارٍ التحقق…', 'Checking…'],
  'msg.groupCreated': ['تم إنشاء المجموعة.', 'Group created.'],
  'msg.accountDeleted': ['تم حذف الحساب.', 'Account deleted.'],
  'msg.passwordSet': ['تم تعيين كلمة المرور.', 'Password set.'],
  'msg.profileSaved': ['تم حفظ البيانات.', 'Profile saved.'],
  'msg.passwordChanged': ['تم تغيير كلمة المرور.', 'Password changed.'],
  'msg.passwordChangedElsewhere': ['تم تغيير كلمة المرور، وأغلقت الأجهزة الأخرى.', 'Password changed, and other devices were signed out.'],
  'msg.notAdminAccount': ['هذا الحساب ليس لديه صلاحية أدمن.', 'This account does not have administrator access.'],
  'msg.signInFailed': ['تعذر تسجيل الدخول.', 'Sign-in failed.'],
  'msg.neverSignedIn': ['لم يسجل الدخول بعد', 'Never signed in'],
  'msg.lastLogin': ['آخر دخول: {time}', 'Last sign-in: {time}'],
  'msg.noGroup': ['بدون', 'None'],
  'msg.disabled': ['معطل', 'Disabled'],
  'msg.allGroups': ['الكل', 'All'],
  'msg.noGroupsYet': ['لا توجد مجموعات', 'No groups yet'],
  'msg.confirmDelete': ['حذف {name} نهائيًا؟', 'Delete {name} permanently?'],
  'msg.promptNewGroupName': ['الاسم الجديد للمجموعة {name}:', 'New name for group {name}:'],
  'msg.promptNewPassword': ['كلمة مرور جديدة لـ {name} (8 أحرف على الأقل، حرف كبير ورقم ورمز):', 'New password for {name} (8+ characters, upper case, a digit and a symbol):'],
  'server.subjectNotEmpty': ['لا يمكن حذف مادة تحتوي ملفات؛ انقلها أو احذفها أولًا.', 'This subject still holds documents; move or delete them first.'],
  /* roles, owner protection and problem reports */
  'server.privilegedRolesOnlySuper': ['إنشاء أو إسناد الأدوار المميزة متاح للسوبر أدمن فقط.', 'Only a super admin can create or assign privileged roles.'],
  'server.ownerProtected': ['هذا الحساب الأساسي محمي من تنفيذ هذا الإجراء.', 'This protected owner account cannot be changed by that action.'],
  'server.reportSent': ['تم إرسال البلاغ. سيراه الأدمن في قائمة البلاغات.', 'Report sent. An administrator will see it in the reports list.'],
  'server.problemNotFound': ['لم يتم العثور على البلاغ.', 'Report not found.'],
  'server.subjectsList': ['المواد يجب أن تكون قائمة.', 'Subjects must be a list.'],
  'server.tooManySubjects': ['الحد الأقصى 50 مادة لكل مجموعة.', 'A group accepts at most 50 subjects.'],
  'server.tooManyGroups': ['الحد الأقصى 25 مجموعة في الاختيار الواحد.', 'At most 25 groups can be selected.'],
  'v.subjectSlug': ['{field} يجب أن يكون مرجعًا قصيرًا مثل math-1 (أحرف وأرقام وشرطات).', '{field} must be a short reference such as math-1 (letters, numbers, hyphens).'],
});
/* --------------------------------------------------------------------- state */
const listeners = new Set();
let current = readStoredLanguage();

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar'; // storage blocked (private mode): Arabic is the default language
  }
}

/** 0 = arabic, 1 = english. Every lookup goes through the current language. */
function index() {
  return current === 'en' ? 1 : 0;
}

export function language() {
  return current;
}

export function isRtl() {
  return current === 'ar';
}

function interpolate(text, values) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    values[name] === undefined ? match : String(values[name])
  );
}

/** Dictionary lookup. An unknown key falls back to Arabic, never to its own name. */
export function t(key, values) {
  const entry = dictionary[key];
  if (!entry) return '';
  return interpolate(entry[index()] ?? entry[0], values);
}

/**
 * Text that arrives from the API. English messages are looked up in the registry so the
 * user always reads them in the selected language; anything unrecognised (for example
 * group names or titles typed by staff) is returned untouched.
 */
export function serverText(message, { status } = {}) {
  const raw = String(message || '').replace(/^Validation failed:\s*/i, '').trim();
  if (!raw) return t('msg.error');

  const exact = SERVER_EXACT[raw];
  if (exact) return t(exact);

  /* lib/validate.js answers with one sentence per problem ("<Field> is required."), a few of
     them joined by "; ". When every piece is a rule we know, the whole message is rebuilt in
     the selected language; anything else is text a human typed (group names, titles) and is
     returned untouched. */
  const parts = raw.split(/;\s+/).map((part) => translateProblem(part.trim()));
  if (parts.length && parts.every((part) => part)) {
    return parts.map((part) => t(part.key, part.values)).join(' · ');
  }

  if (/Failed fetch|fetch failed|NetworkError|ECONNREFUSED/i.test(raw)) return t('msg.network');
  if (status === 401) return t('server.signInRequired');
  if (status === 403) return t('msg.denied');
  if (status === 429) return t('server.rateLimited');
  /* A 5xx used to collapse into the generic sentence, which hid the real cause of every
     server fault (a bad store call read as "something went wrong"). The server already
     replaces its message with a generic one in production, so surfacing `raw` here leaks
     nothing extra and makes development faults readable. */
  if (status && status >= 500) return raw;
  if (status) return t('msg.requestFailed', { status });
  return raw;
}

/* Ordered longest-first so "Group name" wins over "Group". */
const KNOWN_FIELDS = Object.keys(FIELD_NAMES).sort((a, b) => b.length - a.length);

/* The English sentences lib/validate.js produces, each with the key that renders it. */
const PROBLEM_RULES = [
  [/^"?(.+?)"? is required\.?$/, 'v.required', () => ({})],
  [/^"?(.+?)"? must be text\.?$/, 'v.mustText', () => ({})],
  [/^"?(.+?)"? contains invalid characters\.?$/, 'v.invalidChars', () => ({})],
  [/^"?(.+?)"? must be at least (\d+) characters\.?$/, 'v.minChars', (m) => ({ min: m[2] })],
  [/^"?(.+?)"? must be under (\d+) characters\.?$/, 'v.maxChars', (m) => ({ max: m[2] })],
  [/^"?(.+?)"? is not valid\.?$/, 'v.invalid', () => ({})],
  [/^"?(.+?)"? is invalid\.?$/, 'v.invalid', () => ({})],
  [/^"?(.+?)"? must be a valid identifier\.?$/, 'v.idInvalid', () => ({})],
  [/^"?(.+?)"? is too long\.?$/, 'v.tooLong', () => ({})],
  [/^"?(.+?)"? must end with @([\w.-]+)\.?$/, 'v.emailDomain', (m) => ({ domain: m[2] })],
  [/^"?(.+?)"? needs an upper-case letter, a number and a symbol \(e\.g\. @\)\.?$/, 'v.passwordPolicy', () => ({})],
  [/^"?(.+?)"? must be one of: (.+)\.?$/, 'v.oneOf', (m) => ({ options: m[2] })],
  [/^"?(.+?)"? may contain letters, numbers, spaces, \. \( \) \+ - only\.?$/, 'v.groupChars', () => ({})],
    [/^"?(.+?)"? must be a short reference such as "math-1" \(letters, numbers, hyphens\)\.?$/, 'v.subjectSlug', () => ({})],
];

/** One "<Field> <rule>." sentence -> { key, values }, or null when the sentence is unknown. */
function translateProblem(part) {
  if (!part) return null;
  const field = KNOWN_FIELDS.find((name) => part.startsWith(`${name} `));
  if (!field) return null;
  for (const [pattern, key, values] of PROBLEM_RULES) {
    const match = part.match(pattern);
    if (match && match[1] === field) {
      return { key, values: { field: FIELD_NAMES[field][index()], ...values(match) } };
    }
  }
  return null;
}

/** A free-form "kind" stored by staff: translated when it matches a known type. */
export function kindLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const entry = dictionary[`kind.${text}`];
  return entry ? entry[index()] : text;
}

/** The label of a dictionary entry in the *other* language (used by the toggle). */
export function otherLanguageLabel() {
  const entry = dictionary['nav.language'];
  return current === 'en' ? entry[0] : entry[1];
}
/* ------------------------------------------------------------ document + DOM */
const TITLE_SUFFIX = 'ECU · GA6';

function currentPageTitle() {
  const key = document.body?.dataset?.pageTitle;
  return key && dictionary[key] ? t(key) : '';
}

/** Keeps <html lang/dir>, the tab title and the form direction in step with the page. */
function syncDocument() {
  const root = document.documentElement;
  root.lang = current;
  root.dir = current === 'ar' ? 'rtl' : 'ltr';
  const title = currentPageTitle();
  if (title) document.title = `${title} · ${TITLE_SUFFIX}`;
  for (const form of document.querySelectorAll('form')) form.setAttribute('novalidate', '');
}

/** Translates the static markup of `root` (defaults to the whole document). */
export function applyI18n(root = document) {
  if (!root || !root.querySelectorAll) return;
  const scope = root.closest?.('[data-i18n]') ? [root, ...root.querySelectorAll('[data-i18n]')] : root.querySelectorAll('[data-i18n]');
  for (const element of scope) {
    const text = t(element.dataset.i18n);
    if (text) element.textContent = text;
  }
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    const text = t(element.dataset.i18nPlaceholder);
    if (text) element.setAttribute('placeholder', text);
  }
  for (const element of root.querySelectorAll('[data-i18n-label]')) {
    const text = t(element.dataset.i18nLabel);
    if (text) element.setAttribute('aria-label', text);
  }
  syncDocument();
}

/** Re-translates the page and tells every area (header, lists, menus) to redraw. */
export function setLanguage(next) {
  const value = next === 'en' ? 'en' : 'ar';
  if (value === current) return current;
  current = value;
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    /* storage blocked: the language still applies for this page load */
  }
  applyI18n();
  for (const listener of listeners) {
    try {
      listener(current);
    } catch (error) {
      console.error('language listener failed', error);
    }
  }
  return current;
}

export function toggleLanguage() {
  return setLanguage(current === 'ar' ? 'en' : 'ar');
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Wires the language button. Bound once per element: a second call on the same button
 * (or on its replacement) never stacks a second listener, which used to make the toggle
 * switch to English and straight back to Arabic.
 */
const boundToggles = new WeakSet();

export function mountLanguageToggle(button = document.getElementById('languageToggle')) {
  if (!button || boundToggles.has(button)) return;
  boundToggles.add(button);
  paintToggle(button);
  button.title = t('nav.language');
  button.addEventListener('click', () => toggleLanguage());
}

function paintToggle(button) {
  if (!button) return;
  /* The button always offers the language you are not reading. */
  button.textContent = current === 'ar' ? 'English' : 'العربية';
  button.setAttribute('lang', current === 'ar' ? 'en' : 'ar');
  button.title = t('nav.language');
}

/* Apply the stored language as soon as the module loads, so a page in English never
   flashes in Arabic first, and re-draw every toggle and menu on a language change. */
syncDocument();
onLanguageChange(() => {
  for (const button of document.querySelectorAll('.language-button')) paintToggle(button);
});






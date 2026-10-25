import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.LEARNNEST_CONFIG || {};
const hasConfig = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') && /^sb_publishable_/.test(config.supabasePublishableKey || '') || /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') && /^eyJ/.test(config.supabasePublishableKey || '');
const supabase = hasConfig ? createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const $ = (id) => document.getElementById(id);
const backdrop = $('modalBackdrop');
const modalBody = $('modalBody');
const toastNode = $('toast');
let toastTimer;
let stagedFiles = [];
let currentSession = null;
let libraryScope = 'mine';

function toast(message, isError = false) {
  toastNode.textContent = message;
  toastNode.classList.toggle('toast-error', isError);
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3200);
}
function escapeHtml(text) { return String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function displayName(user) { return user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Learner'; }
function syncHeader(session) {
  currentSession = session;
  const user = session?.user;
  $('loginButton').textContent = user ? 'Log out' : 'Log in';
  $('signupButton').innerHTML = user ? `${escapeHtml(displayName(user).split(' ')[0])}’s notes <span>↗</span>` : 'Get started <span>↗</span>';
  $('loginButton').onclick = user ? signOut : () => openAuth('login');
}
function openModal(content) {
  modalBody.innerHTML = content;
  backdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('modalClose').focus();
}
function closeModal() {
  backdrop.classList.add('hidden');
  document.body.style.overflow = '';
  stagedFiles = [];
}
function requireBackend() {
  if (supabase) return true;
  openModal(`<div class="modal-kicker">LEARNNEST SETUP</div><h2 id="modalTitle">The site is ready to connect.</h2><p class="modal-copy">Account and file storage are built in. This copy needs the public Supabase project URL and publishable key in <code>config.js</code> before accounts can be enabled.</p><p class="form-note">The browser uses only the public publishable key. Database access is restricted with user-level security rules.</p>`);
  return false;
}
function openAuth(mode = 'login') {
  if (!requireBackend()) return;
  const signup = mode === 'signup';
  const reset = mode === 'reset';
  const updatePassword = mode === 'update-password';
  openModal(`<div class="modal-kicker">${signup ? 'MAKE A LITTLE SPACE FOR LEARNING' : 'YOUR LEARNNEST SPACE'}</div><h2 id="modalTitle">${signup ? 'Start your learning journey.' : reset ? 'Reset your password.' : updatePassword ? 'Choose a new password.' : 'Welcome back.'}</h2><p class="modal-copy">${signup ? 'Create an account to save your notes and keep them with you.' : reset ? 'We’ll email you a secure password reset link.' : updatePassword ? 'Choose a new password for your LearnNest account.' : 'Log in to see your notes and continue learning.'}</p><form id="authForm">${signup ? '<label class="form-field"><span>Your name</span><input name="name" autocomplete="name" placeholder="How should we call you?" required maxlength="80"></label>' : ''}${updatePassword ? '' : '<label class="form-field"><span>Email address</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>'}${reset ? '' : '<label class="form-field"><span>Password</span><input name="password" type="password" autocomplete="' + (signup || updatePassword ? 'new-password' : 'current-password') + '" placeholder="At least 8 characters" minlength="8" required></label>'}<button class="primary-button modal-submit" type="submit">${signup ? 'Create my account' : reset ? 'Send reset link' : updatePassword ? 'Save new password' : 'Log in'} <span>→</span></button></form><p class="modal-switch">${signup ? 'Already have an account?' : reset ? 'Remembered your password?' : 'New to LearnNest?'} <button id="switchAuth">${signup || reset || updatePassword ? 'Log in' : 'Create an account'}</button>${!signup && !reset && !updatePassword ? ' · <button id="forgotPassword">Forgot password?</button>' : ''}</p><p class="form-note">Your account is securely managed by Supabase. Your password is never stored by this website.</p>`);
  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = 'Please wait…';
    let result;
    if (reset) {
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
      if (!result.error) { closeModal(); toast('Password reset link sent. Check your email.'); }
    } else if (updatePassword) {
      result = await supabase.auth.updateUser({ password: String(form.get('password')) });
      if (!result.error) { closeModal(); toast('Your password has been updated.'); }
    } else if (signup) {
      result = await supabase.auth.signUp({ email, password: String(form.get('password')), options: { data: { display_name: String(form.get('name')).trim() }, emailRedirectTo: window.location.href.split('#')[0] } });
      if (!result.error) {
        closeModal();
        if (result.data.session) toast('Your account is ready. Welcome to LearnNest!');
        else {
          openModal(`<div class="modal-kicker">ONE QUICK CHECK</div><h2 id="modalTitle">Check your inbox.</h2><p class="modal-copy">We sent a confirmation link to <b>${escapeHtml(email)}</b>. Confirm your email, then log in to start saving notes.</p><button class="primary-button modal-submit" id="confirmLogin">Back to log in <span>→</span></button>`);
          $('confirmLogin').onclick = () => openAuth('login');
        }
      }
    } else {
      result = await supabase.auth.signInWithPassword({ email, password: String(form.get('password')) });
      if (!result.error) { closeModal(); toast('You’re logged in. Welcome back!'); }
    }
    if (result?.error) {
      button.disabled = false;
      button.innerHTML = `${signup ? 'Create my account' : reset ? 'Send reset link' : updatePassword ? 'Save new password' : 'Log in'} <span>→</span>`;
      toast(result.error.message, true);
    }
  });
  $('switchAuth').onclick = () => openAuth(signup || reset || updatePassword ? 'login' : 'signup');
  $('forgotPassword')?.addEventListener('click', () => openAuth('reset'));
}
async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) toast(error.message, true);
  else toast('You’re logged out.');
}
function openUpload() {
  if (!requireBackend()) return;
  if (!currentSession?.user) {
    openModal(`<div class="modal-kicker">SAVE A LITTLE KNOWLEDGE</div><h2 id="modalTitle">Log in to add your notes.</h2><p class="modal-copy">Create an account first, then upload handwritten pages, PDFs, or Word documents to your private notes library.</p><button class="primary-button modal-submit" id="uploadSignup">Create an account <span>→</span></button><p class="modal-switch">Already have an account? <button id="uploadLogin">Log in</button></p>`);
    $('uploadSignup').onclick = () => openAuth('signup');
    $('uploadLogin').onclick = () => openAuth('login');
    return;
  }
  stagedFiles = [];
  openModal(`<div class="modal-kicker">A HOME FOR YOUR HANDWRITTEN NOTES</div><h2 id="modalTitle">Add a page to your nest.</h2><p class="modal-copy">Choose clear photos, scans, PDFs, or Word documents. New notes are private; you can share or unshare them later.</p><label class="form-field"><span>Subject</span><select id="noteSubject"><option>Biology</option><option>Mathematics</option><option>History</option><option>Physics</option><option>Computer science</option><option>Other</option></select></label><div class="upload-drop" id="uploadDrop"><strong>Drop your files here</strong><small>JPG, PNG, WebP, HEIC, PDF, or DOCX · up to 25 MB each</small><button id="chooseFiles" type="button">Choose files</button><div class="file-list" id="fileList"></div></div><label class="form-field"><span>Note title (optional)</span><input id="noteTitle" placeholder="e.g. Plant cell revision" maxlength="140"></label><button class="primary-button modal-submit" id="saveNotes" type="button">Upload my notes <span>↑</span></button><p class="form-note">Your files are stored securely. Private notes are visible only to you.</p>`);
  const fileInput = $('fileInput');
  $('chooseFiles').onclick = () => fileInput.click();
  fileInput.onchange = () => { stagedFiles = [...fileInput.files]; fileInput.value = ''; displayStagedFiles(); };
  const drop = $('uploadDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); stagedFiles = [...e.dataTransfer.files].filter(validFile); displayStagedFiles(); });
  $('saveNotes').onclick = uploadNotes;
}
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function fileMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return extension === 'docx' ? DOCX_MIME : extension === 'pdf' ? 'application/pdf' : '';
}
function validFile(file) { return ['image/jpeg','image/png','image/webp','image/heic','application/pdf',DOCX_MIME].includes(fileMimeType(file)) && file.size <= 25 * 1024 * 1024; }
function displayStagedFiles() {
  const list = $('fileList');
  if (!list) return;
  const invalid = stagedFiles.some(file => !validFile(file));
  list.textContent = stagedFiles.length ? stagedFiles.map(file => `${file.name} · ${formatSize(file.size)}`).join('\n') : '';
  list.style.whiteSpace = 'pre-line';
  if (invalid) list.textContent += '\nOne or more files are too large or use an unsupported format.';
}
function formatSize(bytes) { return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
async function uploadNotes() {
  if (!stagedFiles.length) return toast('Choose at least one photo, PDF, or Word document first.', true);
  if (stagedFiles.some(file => !validFile(file))) return toast('Use JPG, PNG, WebP, HEIC, PDF, or DOCX files under 25 MB.', true);
  const button = $('saveNotes');
  button.disabled = true;
  const user = currentSession.user;
  const subject = $('noteSubject').value;
  const typedTitle = $('noteTitle').value.trim();
  const files = [...stagedFiles];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const fileType = fileMimeType(file);
    button.innerHTML = `Uploading ${index + 1} of ${files.length}…`;
    const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: storageError } = await supabase.storage.from('study-notes').upload(path, file, { contentType: fileType, upsert: false });
    if (storageError) { button.disabled = false; button.innerHTML = 'Upload my notes <span>↑</span>'; return toast(`Upload failed: ${storageError.message}`, true); }
    const title = files.length === 1 && typedTitle ? typedTitle : file.name.replace(/\.[^.]+$/, '');
    const { error: rowError } = await supabase.from('notes').insert({ user_id: user.id, owner_name: displayName(user), title, subject, file_path: path, file_name: file.name, file_type: fileType, file_size: file.size, is_public: false });
    if (rowError) {
      await supabase.storage.from('study-notes').remove([path]);
      button.disabled = false;
      button.innerHTML = 'Upload my notes <span>↑</span>';
      return toast(`Could not save note details: ${rowError.message}`, true);
    }
  }
  closeModal();
  toast(files.length === 1 ? 'Your note has a new home.' : 'Your notes have a new home.');
  if (libraryScope === 'mine') openNotes('mine');
}
async function openNotes(scope = 'mine') {
  if (!requireBackend()) return;
  libraryScope = scope;
  let query = supabase.from('notes').select('id,user_id,owner_name,title,subject,file_path,file_name,file_type,file_size,is_public,created_at').order('created_at', { ascending: false }).limit(100);
  if (scope === 'mine') query = query.eq('user_id', currentSession.user.id);
  else query = query.eq('is_public', true);
  const { data: notes, error } = await query;
  if (error) return toast(`Couldn’t load notes: ${error.message}`, true);
  const shared = scope === 'shared';
  const cards = notes?.length ? await Promise.all(notes.map(async note => {
    const { data: linkData } = await supabase.storage.from('study-notes').createSignedUrl(note.file_path, 600);
    const isOwner = currentSession?.user?.id === note.user_id;
    const owner = shared && !isOwner ? `<small>Shared by ${escapeHtml(note.owner_name || 'a learner')}</small>` : '';
    const controls = isOwner ? `<button class="note-action" data-toggle="${note.id}" title="${note.is_public ? 'Make private' : 'Share publicly'}">${note.is_public ? 'Unshare' : 'Share'}</button><button class="note-action delete-action" data-delete="${note.id}" title="Delete this note">Delete</button>` : '';
    return `<article class="saved-note"><div class="saved-note-icon">${note.file_type === 'application/pdf' ? 'PDF' : note.file_type === DOCX_MIME ? 'DOCX' : '✎'}</div><div class="saved-note-info"><b>${escapeHtml(note.title)}</b><small>${escapeHtml(note.subject)} · ${note.is_public ? 'Shared' : 'Private'} · ${formatSize(note.file_size)}</small>${owner}</div>${linkData?.signedUrl ? `<a class="open-note" href="${linkData.signedUrl}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(note.title)}">↗</a>` : ''}${controls}</article>`;
  })).then(items => items.join('')) : `<div class="no-notes"><span>✳</span><b>${shared ? 'No shared notes yet.' : 'Your note shelf is empty.'}</b><small>${shared ? 'When someone shares a note, it’ll show up here.' : 'Upload a handwritten page, PDF, or Word document to get started.'}</small></div>`;
  openModal(`<div class="modal-kicker">${shared ? 'SHARED BY LEARNERS' : 'YOUR LEARNING SPACE'}</div><h2 id="modalTitle">${shared ? 'Browse study notes.' : 'Your saved notes.'}</h2><p class="modal-copy">${shared ? 'Explore handwritten notes shared by the LearnNest community.' : 'Your saved files are available in your private notes library.'}</p><div class="saved-notes-list">${cards}</div>${!shared ? '<button class="primary-button modal-submit" id="libraryUpload">Upload another note <span>↑</span></button>' : ''}`);
  $('libraryUpload')?.addEventListener('click', openUpload);
  modalBody.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleVisibility(button.dataset.toggle)));
  modalBody.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteNote(button.dataset.delete)));
}
async function toggleVisibility(id) {
  const { data: note, error: readError } = await supabase.from('notes').select('is_public').eq('id', id).single();
  if (readError) return toast(readError.message, true);
  const { error } = await supabase.from('notes').update({ is_public: !note.is_public }).eq('id', id);
  if (error) return toast(`Couldn’t update sharing: ${error.message}`, true);
  toast(note.is_public ? 'This note is private now.' : 'This note is now shared with the community.');
  openNotes(libraryScope);
}
async function deleteNote(id) {
  const { data: note, error: readError } = await supabase.from('notes').select('file_path').eq('id', id).single();
  if (readError) return toast(readError.message, true);
  const { error: fileError } = await supabase.storage.from('study-notes').remove([note.file_path]);
  if (fileError) return toast(`Couldn’t delete file: ${fileError.message}`, true);
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return toast(`Couldn’t delete note: ${error.message}`, true);
  toast('Note deleted.');
  openNotes(libraryScope);
}

const courseData = {
  web: { title: 'Web development', intro: 'Build a clear foundation for your first website. Work through these short lessons at your own pace.', lessons: [
    { title: 'A webpage starts with HTML', text: 'HTML gives a page its structure. Headings, paragraphs, images, and links are all described with HTML elements. A browser reads those elements and turns them into the page you see.', code: '<h1>My first page</h1>\n<p>I made something today.</p>' },
    { title: 'Give it a style with CSS', text: 'CSS controls the look and layout of HTML. A rule selects an element, then applies one or more style declarations. Try changing the color or spacing to see what changes.', code: 'h1 {\n  color: seagreen;\n  margin-bottom: 1rem;\n}' },
    { title: 'Add a little interaction', text: 'JavaScript can respond when someone uses a page. This example finds a button and changes its label when clicked. Small interactions are a great first project.', code: "document.querySelector('button')\n  .addEventListener('click', (event) => {\n    event.target.textContent = 'You did it!';\n  });" }
  ]},
  math: { title: 'Maths, made clearer', intro: 'Build confidence in everyday number skills, one worked example at a time.', lessons: [
    { title: 'Fractions with a shared denominator', text: 'To add fractions, first give them the same denominator. For example, one half is the same as two quarters. Then add the numerators: 2/4 + 1/4 = 3/4.', code: '1/2 + 1/4\n= 2/4 + 1/4\n= 3/4' },
    { title: 'Order of operations', text: 'When an expression has several operations, use parentheses first, then multiplication and division, then addition and subtraction. This keeps everyone’s answer consistent.', code: '3 + 2 × 4\n= 3 + 8\n= 11' },
    { title: 'A first look at algebra', text: 'A letter can stand for a number we do not know yet. Solve  x + 5 = 12  by undoing the addition: subtract 5 from both sides, so x = 7.', code: 'x + 5 = 12\nx = 12 − 5\nx = 7' }
  ]},
  science: { title: 'Science all around', intro: 'Notice the patterns and processes that help explain the world around us.', lessons: [
    { title: 'How plants make food', text: 'In photosynthesis, plants use light energy to turn water and carbon dioxide into sugar. Oxygen is released along the way. The process mainly happens in leaves.', code: 'carbon dioxide + water\n  — light energy →\n sugar + oxygen' },
    { title: 'The journey of a water drop', text: 'The water cycle moves water through the environment. Sunlight warms water and causes evaporation. The vapor cools into clouds, then returns to Earth as precipitation.', code: 'evaporation → condensation\n       → precipitation\n       → collection' },
    { title: 'Forces can change motion', text: 'A force is a push or pull. An unbalanced force can change an object’s speed or direction. If the forces balance, its motion does not change.', code: 'balanced forces → no change\nunbalanced force → acceleration' }
  ]}
};
function courseProgress() {
  try { return JSON.parse(localStorage.getItem('learnnest-course-progress') || '{}'); }
  catch { return {}; }
}
function showCourse(courseId) {
  const course = courseData[courseId];
  if (!course) return;
  const progress = courseProgress()[courseId] || [];
  const lessonRows = course.lessons.map((lesson, index) => `<button class="course-lesson" data-course-lesson="${courseId}" data-lesson-index="${index}"><span class="lesson-number">${progress.includes(index) ? '✓' : String(index + 1).padStart(2,'0')}</span><span><b>${escapeHtml(lesson.title)}</b><small>${progress.includes(index) ? 'Completed' : 'Short lesson'}</small></span><i>→</i></button>`).join('');
  openModal(`<div class="modal-kicker">LEARNING PATH</div><h2 id="modalTitle">${course.title}</h2><p class="modal-copy">${course.intro}</p><div class="course-lesson-list">${lessonRows}</div><p class="form-note">Your lesson progress is saved in this browser.</p>`);
  modalBody.querySelectorAll('[data-course-lesson]').forEach(button => button.addEventListener('click', () => showLesson(button.dataset.courseLesson, Number(button.dataset.lessonIndex))));
}
function showLesson(courseId, index) {
  const course = courseData[courseId];
  const lesson = course?.lessons[index];
  if (!lesson) return;
  const escapedCode = escapeHtml(lesson.code);
  const progress = courseProgress();
  const done = (progress[courseId] || []).includes(index);
  openModal(`<button class="back-to-course" id="backToCourse">← ${escapeHtml(course.title)}</button><div class="modal-kicker">LESSON ${index + 1} OF ${course.lessons.length}</div><h2 id="modalTitle">${escapeHtml(lesson.title)}</h2><p class="modal-copy lesson-copy">${escapeHtml(lesson.text)}</p><pre class="lesson-code"><code>${escapedCode}</code></pre><button class="primary-button modal-submit" id="completeLesson">${done ? 'Completed ✓' : 'Mark lesson complete'} <span>→</span></button>`);
  $('backToCourse').onclick = () => showCourse(courseId);
  $('completeLesson').onclick = () => {
    const current = courseProgress();
    current[courseId] = [...new Set([...(current[courseId] || []), index])];
    localStorage.setItem('learnnest-course-progress', JSON.stringify(current));
    toast('Lesson progress saved. Nice work!');
    showCourse(courseId);
  };
}
document.querySelectorAll('[data-course-open]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showCourse(link.dataset.courseOpen);
}));

$('modalClose').addEventListener('click', closeModal);
backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
$('signupButton').addEventListener('click', () => currentSession?.user ? openNotes('mine') : openAuth('signup'));
$('ctaSignup').addEventListener('click', () => openAuth('signup'));
$('uploadButton').addEventListener('click', openUpload);
$('heroNotesButton').addEventListener('click', openUpload);
$('browseNotes').addEventListener('click', () => openNotes('shared'));
$('footerUpload').addEventListener('click', event => { event.preventDefault(); openUpload(); });
$('footerLogin').addEventListener('click', event => { event.preventDefault(); currentSession?.user ? openNotes('mine') : openAuth('login'); });
$('menuToggle').addEventListener('click', () => $('mainNav').classList.toggle('open'));
for (const link of document.querySelectorAll('.main-nav a')) link.addEventListener('click', () => $('mainNav').classList.remove('open'));

if (supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  syncHeader(session);
  supabase.auth.onAuthStateChange((event, nextSession) => {
    syncHeader(nextSession);
    if (event === 'PASSWORD_RECOVERY') setTimeout(() => openAuth('update-password'), 0);
  });
  if (window.location.hash.includes('type=recovery')) openAuth('update-password');
} else {
  syncHeader(null);
}



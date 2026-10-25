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
let noteActionTargets = new Map();
let noteLibraryData = [];
let noteViewMode = 'grid';

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
  backdrop.querySelector('.modal')?.classList.remove('wide-modal');
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
  libraryScope = 'mine';
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
  noteViewMode = 'grid';
  const host = $('notesLibrary');
  if (!host) return;
  $('notes')?.classList.remove('reader-open');
  if (scope === 'mine' && !currentSession?.user) {
    noteActionTargets = new Map();
    noteLibraryData = [];
    host.innerHTML = '<div class="notes-signin-state"><div class="notes-state-icon">✎</div><div class="eyebrow section-eyebrow">YOUR PERSONAL STUDY SPACE</div><h3>Your notes, all in one place.</h3><p>Log in to upload, organize, view, and download your study notes.</p><div class="notes-state-actions"><button class="primary-button" id="notesLogin">Log in <span>→</span></button><button class="outline-button" id="notesSignup">Create account</button><button class="quiet-link" id="showSharedNotes">Browse shared notes</button></div></div>';
    $('notesLogin').onclick = () => openAuth('login');
    $('notesSignup').onclick = () => openAuth('signup');
    $('showSharedNotes').onclick = () => openNotes('shared');
    return;
  }
  host.innerHTML = '<div class="notes-loading"><span class="loading-dot"></span> Loading your notes…</div>';
  let query = supabase.from('notes').select('id,user_id,owner_name,title,subject,file_path,file_name,file_type,file_size,is_public,created_at').order('created_at', { ascending: false }).limit(100);
  if (scope === 'mine') query = query.eq('user_id', currentSession.user.id);
  else query = query.eq('is_public', true);
  const { data: notes, error } = await query;
  if (error) {
    host.innerHTML = '<div class="notes-error-state"><b>We couldn’t load these notes.</b><p>' + escapeHtml(error.message) + '</p><button class="outline-button" id="retryNotes">Try again</button></div>';
    $('retryNotes').onclick = () => openNotes(scope);
    return;
  }
  noteLibraryData = notes || [];
  noteActionTargets = new Map(noteLibraryData.map(note => [String(note.id), note]));
  const shared = scope === 'shared';
  const subjects = [...new Set(noteLibraryData.map(note => String(note.subject || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const subjectOptions = '<option value="all">All subjects</option>' + subjects.map(subject => '<option value="' + escapeHtml(subject) + '">' + escapeHtml(subject) + '</option>').join('');
  host.innerHTML =
    '<div class="notes-library-heading"><div><div class="eyebrow section-eyebrow">' + (shared ? 'LEARN TOGETHER' : 'YOUR LEARNING SPACE') + '</div><h3>' + (shared ? 'Notes from the community.' : 'Your notes shelf.') + '</h3><p>' + (shared ? 'Browse notes other learners have chosen to share.' : 'Search, sort, and open your files right here on LearnNest.') + '</p></div>' + (!shared ? '<button class="primary-button notes-upload-button" id="notesUpload">Upload a note <span>↑</span></button>' : '') + '</div>' +
    '<div class="notes-library-tabs" role="tablist" aria-label="Notes library"><button class="notes-tab' + (!shared ? ' active' : '') + '" type="button" data-note-scope="mine" role="tab" aria-selected="' + (!shared) + '">My notes</button><button class="notes-tab' + (shared ? ' active' : '') + '" type="button" data-note-scope="shared" role="tab" aria-selected="' + shared + '">Shared notes</button></div>' +
    '<div class="notes-tools"><label class="notes-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="noteSearch" type="search" placeholder="Search notes by title or subject" autocomplete="off" aria-label="Search notes"></label><label class="notes-filter"><span>Subject</span><select id="noteSubjectFilter">' + subjectOptions + '</select></label><label class="notes-filter"><span>Sort</span><select id="noteSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label><button class="notes-view-toggle" id="noteViewToggle" type="button" aria-label="Switch to list view"><span aria-hidden="true">☷</span> List view</button></div>' +
    '<div class="notes-results"><span id="notesResultCount"></span><span>' + (shared ? 'Shared by learners' : 'Private to your account unless you share') + '</span></div>' +
    '<div class="notes-library-list" id="notesList" data-layout="grid"></div>';
  $('notesUpload')?.addEventListener('click', openUpload);
  host.querySelectorAll('[data-note-scope]').forEach(button => button.addEventListener('click', () => openNotes(button.dataset.noteScope)));
  $('noteSearch').addEventListener('input', renderNoteCards);
  $('noteSubjectFilter').addEventListener('change', renderNoteCards);
  $('noteSort').addEventListener('change', renderNoteCards);
  $('noteViewToggle').addEventListener('click', () => {
    noteViewMode = noteViewMode === 'grid' ? 'list' : 'grid';
    $('noteViewToggle').innerHTML = '<span aria-hidden="true">' + (noteViewMode === 'grid' ? '☷' : '▦') + '</span> ' + (noteViewMode === 'grid' ? 'List view' : 'Grid view');
    $('noteViewToggle').setAttribute('aria-label', 'Switch to ' + (noteViewMode === 'grid' ? 'list' : 'grid') + ' view');
    renderNoteCards();
  });
  renderNoteCards();
}
function renderNoteCards() {
  const list = $('notesList');
  if (!list) return;
  const search = String($('noteSearch')?.value || '').trim().toLowerCase();
  const subject = $('noteSubjectFilter')?.value || 'all';
  const sortBy = $('noteSort')?.value || 'newest';
  const filtered = noteLibraryData.filter(note => {
    const matchesSubject = subject === 'all' || note.subject === subject;
    const searchable = [note.title, note.subject, note.file_name].join(' ').toLowerCase();
    return matchesSubject && searchable.includes(search);
  });
  filtered.sort((a, b) => {
    if (sortBy === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
    const first = Date.parse(a.created_at || '') || 0;
    const second = Date.parse(b.created_at || '') || 0;
    return sortBy === 'oldest' ? first - second : second - first;
  });
  $('notesResultCount').textContent = filtered.length + (filtered.length === 1 ? ' note' : ' notes');
  list.dataset.layout = noteViewMode;
  if (!filtered.length) {
    const hasNotes = noteLibraryData.length > 0;
    list.innerHTML = '<div class="notes-empty-state"><span>✳</span><b>' + (hasNotes ? 'No notes match those filters.' : (libraryScope === 'shared' ? 'No shared notes yet.' : 'Your notes shelf is ready.')) + '</b><small>' + (hasNotes ? 'Try another search or subject.' : (libraryScope === 'shared' ? 'When someone shares a note, it’ll appear here.' : 'Upload your first photo, PDF, or Word document.')) + '</small>' + (!hasNotes && libraryScope === 'mine' ? '<button class="primary-button" id="emptyUpload">Upload your first note <span>↑</span></button>' : '') + '</div>';
    $('emptyUpload')?.addEventListener('click', openUpload);
    return;
  }
  list.innerHTML = filtered.map(note => {
    const isOwner = currentSession?.user?.id === note.user_id;
    const fileName = note.file_name || note.title || 'study-note';
    const isPdf = note.file_type === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isImage = String(note.file_type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(fileName);
    const viewButton = isPdf || isImage
      ? '<button class="note-icon-action" type="button" data-view-note="' + escapeHtml(note.id) + '" title="View on site" aria-label="View ' + escapeHtml(note.title) + ' on site"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg></button>'
      : '';
    const fileActions = '<div class="note-file-actions">' + viewButton + '<button class="note-icon-action" type="button" data-download-note="' + escapeHtml(note.id) + '" title="Download note" aria-label="Download ' + escapeHtml(note.title) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v4h14v-4"></path></svg></button></div>';
    const controls = isOwner
      ? '<div class="note-owner-actions"><button class="note-action" type="button" data-toggle="' + escapeHtml(note.id) + '" title="' + (note.is_public ? 'Make private' : 'Share publicly') + '">' + (note.is_public ? 'Unshare' : 'Share') + '</button><button class="note-action delete-action" type="button" data-delete="' + escapeHtml(note.id) + '" title="Delete this note">Delete</button></div>'
      : '';
    const fileBadge = isPdf ? 'PDF' : note.file_type === DOCX_MIME ? 'DOCX' : '✎';
    const sharedBy = libraryScope === 'shared' && !isOwner ? '<small>Shared by ' + escapeHtml(note.owner_name || 'a learner') + '</small>' : '';
    return '<article class="saved-note"><div class="saved-note-icon">' + fileBadge + '</div><div class="saved-note-info"><b>' + escapeHtml(note.title || fileName) + '</b><small>' + escapeHtml(note.subject || 'Other') + ' · ' + (note.is_public ? 'Shared' : 'Private') + ' · ' + formatSize(note.file_size) + '</small>' + sharedBy + '</div><div class="saved-note-actions">' + fileActions + controls + '</div></article>';
  }).join('');
  list.querySelectorAll('[data-view-note]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await openNotePreview(button.dataset.viewNote); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
  list.querySelectorAll('[data-download-note]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await downloadNote(button.dataset.downloadNote); }
    finally { if (button.isConnected) button.disabled = false; }
  }));
  list.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleVisibility(button.dataset.toggle)));
  list.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteNote(button.dataset.delete)));
}
async function openNotePreview(noteId) {
  const note = noteActionTargets.get(String(noteId));
  const host = $('notesLibrary');
  if (!note || !host) return toast('Couldn’t find this note. Reopen your notes and try again.', true);
  const { data, error } = await supabase.storage.from('study-notes').createSignedUrl(note.file_path, 3600);
  if (error || !data?.signedUrl) return toast('Couldn’t open this note: ' + (error?.message || 'A preview link could not be created.'), true);
  const title = escapeHtml(note.title || note.file_name || 'Study note');
  const url = escapeHtml(data.signedUrl);
  const isPdf = note.file_type === 'application/pdf' || /\.pdf$/i.test(note.file_name || '');
  const viewer = isPdf
    ? '<iframe class="note-pdf-viewer" src="' + url + '#toolbar=1&navpanes=0" title="PDF preview: ' + title + '" referrerpolicy="no-referrer"></iframe><p class="pdf-viewer-hint">If the preview doesn’t appear, use Download to read the PDF.</p>'
    : '<div class="note-image-preview"><img src="' + url + '" alt="Preview of ' + title + '"></div>';
  $('notes').classList.add('reader-open');
  host.innerHTML = '<div class="note-reader-page"><div class="note-view-toolbar"><button class="note-back-button" id="backToNotes">← Back to notes</button><button class="note-download-link" id="readerDownload" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v4h14v-4"></path></svg> Download</button></div><div class="note-reader-heading"><div class="eyebrow section-eyebrow">' + (isPdf ? 'PDF NOTE' : 'IMAGE NOTE') + ' · ' + escapeHtml(note.subject || 'Study notes') + '</div><h2>' + title + '</h2><p>' + escapeHtml(note.file_name || '') + '</p></div>' + viewer + '</div>';
  $('backToNotes').onclick = () => openNotes(libraryScope);
  $('readerDownload').onclick = () => downloadNote(noteId);
}
async function downloadNote(noteId) {
  const note = noteActionTargets.get(String(noteId));
  if (!note) return toast('Couldn’t find this note. Reopen your notes and try again.', true);
  const { data, error } = await supabase.storage.from('study-notes').createSignedUrl(note.file_path, 3600, { download: note.file_name || true });
  if (error || !data?.signedUrl) return toast('Couldn’t download this note: ' + (error?.message || 'A download link could not be created.'), true);
  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.download = note.file_name || '';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
const pageTitles = {
  home: 'LearnNest — Learn something new, every day',
  courses: 'Courses · LearnNest',
  how: 'How LearnNest works',
  notes: 'Study notes · LearnNest'
};
function routeFromHash() {
  const route = window.location.hash.slice(1).split(/[?&]/)[0];
  return Object.prototype.hasOwnProperty.call(pageTitles, route) ? route : 'home';
}
function navigatePage(page, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(pageTitles, page)) page = 'home';
  if (options.scope) libraryScope = options.scope;
  document.body.dataset.page = page;
  document.querySelectorAll('main > [data-page-view]').forEach(section => {
    const visible = section.dataset.pageView === page;
    section.classList.toggle('page-view-hidden', !visible);
    section.setAttribute('aria-hidden', String(!visible));
    if (visible) {
      section.classList.remove('page-view-enter');
      void section.offsetWidth;
      section.classList.add('page-view-enter');
    }
  });
  document.querySelectorAll('[data-page-link]').forEach(link => {
    const active = link.dataset.pageLink === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = pageTitles[page];
  $('mainNav').classList.remove('open');
  if (options.updateHistory !== false && window.location.hash !== '#' + page) {
    window.history.pushState({ learnNestPage: page }, '', '#' + page);
  }
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'notes') openNotes(options.scope || libraryScope);
}
document.querySelectorAll('[data-course-open]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  showCourse(link.dataset.courseOpen);
}));
document.addEventListener('click', event => {
  if (event.defaultPrevented) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.hasAttribute('data-course-open')) return;
  const route = link.getAttribute('href').slice(1);
  if (!Object.prototype.hasOwnProperty.call(pageTitles, route)) return;
  event.preventDefault();
  navigatePage(route);
});
window.addEventListener('popstate', () => navigatePage(routeFromHash(), { updateHistory: false, scroll: false }));

$('modalClose').addEventListener('click', closeModal);
backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
$('signupButton').addEventListener('click', () => currentSession?.user ? navigatePage('notes', { scope: 'mine' }) : openAuth('signup'));
$('ctaSignup').addEventListener('click', () => openAuth('signup'));
$('uploadButton').addEventListener('click', openUpload);
$('heroNotesButton').addEventListener('click', () => { navigatePage('notes', { scope: 'mine' }); openUpload(); });
$('browseNotes').addEventListener('click', () => navigatePage('notes', { scope: 'shared' }));
$('footerUpload').addEventListener('click', event => { event.preventDefault(); navigatePage('notes', { scope: 'mine' }); openUpload(); });
$('footerLogin').addEventListener('click', event => { event.preventDefault(); navigatePage('notes', { scope: 'mine' }); if (!currentSession?.user) openAuth('login'); });
$('menuToggle').addEventListener('click', () => $('mainNav').classList.toggle('open'));

if (supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  syncHeader(session);
  supabase.auth.onAuthStateChange((event, nextSession) => {
    syncHeader(nextSession);
    if (document.body.dataset.page === 'notes') setTimeout(() => openNotes(libraryScope), 0);
    if (event === 'PASSWORD_RECOVERY') setTimeout(() => openAuth('update-password'), 0);
  });
  if (window.location.hash.includes('type=recovery')) openAuth('update-password');
} else {
  syncHeader(null);
}
navigatePage(routeFromHash(), { updateHistory: false, scroll: false });

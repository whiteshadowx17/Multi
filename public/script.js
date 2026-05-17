// ===============================
//  GLOBAL STATE
// ===============================

let currentCalendarId = null;
let currentCalendar = null;
let calendars = [];
let displayStart = getWeekStart(new Date()); // always start on Sunday

let currentDate = null;
let quill = null;

// ===============================
//  THEME DEFINITIONS
// ===============================

const CALENDAR_THEMES = {
  blue: {
    primaryBg: 'bg-blue-500',
    primaryHover: 'hover:bg-blue-400',
    calendarBg: 'bg-slate-900/80',
    dayBg: 'bg-blue-50',
    todayBg: 'bg-blue-100',
    todayRing: 'ring-blue-400',
    accentText: 'text-blue-600'
  },
  green: {
    primaryBg: 'bg-green-500',
    primaryHover: 'hover:bg-green-400',
    calendarBg: 'bg-emerald-900/80',
    dayBg: 'bg-green-50',
    todayBg: 'bg-green-100',
    todayRing: 'ring-green-400',
    accentText: 'text-green-600'
  },
  amber: {
    primaryBg: 'bg-amber-500',
    primaryHover: 'hover:bg-amber-400',
    calendarBg: 'bg-amber-900/80',
    dayBg: 'bg-amber-50',
    todayBg: 'bg-amber-100',
    todayRing: 'ring-amber-400',
    accentText: 'text-amber-600'
  },
  purple: {
    primaryBg: 'bg-purple-500',
    primaryHover: 'hover:bg-purple-400',
    calendarBg: 'bg-purple-900/80',
    dayBg: 'bg-purple-50',
    todayBg: 'bg-purple-100',
    todayRing: 'ring-purple-400',
    accentText: 'text-purple-600'
  },
  rose: {
    primaryBg: 'bg-rose-500',
    primaryHover: 'hover:bg-rose-400',
    calendarBg: 'bg-rose-900/80',
    dayBg: 'bg-rose-50',
    todayBg: 'bg-rose-100',
    todayRing: 'ring-rose-400',
    accentText: 'text-rose-600'
  },
  emerald: {
    primaryBg: 'bg-emerald-500',
    primaryHover: 'hover:bg-emerald-400',
    calendarBg: 'bg-emerald-900/80',
    dayBg: 'bg-emerald-50',
    todayBg: 'bg-emerald-100',
    todayRing: 'ring-emerald-400',
    accentText: 'text-emerald-600'
  }
};

function getCurrentTheme() {
  if (!currentCalendar || !currentCalendar.color) return CALENDAR_THEMES.blue;
  return CALENDAR_THEMES[currentCalendar.color] || CALENDAR_THEMES.blue;
}

// ===============================
//  UTILS
// ===============================

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function deltaToHtml(delta) {
  if (!delta || !delta.ops) return '';

  const temp = document.createElement('div');
  const q = new Quill(temp);
  q.setContents(delta);

  return temp.querySelector('.ql-editor').innerHTML;
}


function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getStatusColor(status) {
  if (!status) return 'text-slate-700';
  const s = status.toLowerCase();
  if (s.includes('not')) return 'text-red-500';
  if (s.includes('progress')) return 'text-yellow-500';
  if (s.includes('complete')) return 'text-green-500';
  return 'text-slate-700';
}

// ===============================
//  FULL TEXT EXTRACTION (IMPROVED)
// ===============================

function getFullText(delta) {
  if (!delta || !delta.ops) return '';
  return delta.ops
    .map(op => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .trim();
}

// ===============================
//  IMAGE EXTRACTION
// ===============================

function extractImageFromDelta(delta) {
  if (!delta || !delta.ops) return null;
  let lastImage = null;
  for (const op of delta.ops) {
    if (op.insert && typeof op.insert === 'object' && op.insert.image) {
      lastImage = op.insert.image;
    }
  }
  return lastImage;
}

// ===============================
//  IMAGE UPLOAD
// ===============================

async function uploadImageToServer(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error('Image upload failed');

  const data = await res.json();
  return data.url;
}
// ===============================
//  CALENDAR MANAGEMENT
// ===============================

async function loadCalendars() {
  try {
    const res = await fetch('/api/calendars');
    calendars = await res.json();

    if (calendars.length === 0) {
      const created = await createCalendar('Default', 'blue');
      calendars = [created];
    }

    if (!currentCalendarId) currentCalendarId = calendars[0].id;

    currentCalendar = calendars.find(c => c.id === currentCalendarId);
    renderCalendarSelector();
    applyTheme();
    await loadCalendar();
  } catch (e) {
    console.error('Failed to load calendars:', e);
  }
}

function renderCalendarSelector() {
  const select = document.getElementById('calendar-select');
  select.innerHTML = '';

  calendars.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.name;
    if (cal.id === currentCalendarId) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = () => {
    currentCalendarId = parseInt(select.value, 10);
    currentCalendar = calendars.find(c => c.id === currentCalendarId);
    applyTheme();
    loadCalendar();
  };
}

function applyTheme() {
  const theme = getCurrentTheme();

  const todayBtn = document.getElementById('today-btn');
  const exportBtn = document.getElementById('export-btn');
  const calendarSaveBtn = document.querySelector(
    '#calendar-form-modal button[onclick="saveCalendarFromForm()"]'
  );

  [todayBtn, exportBtn, calendarSaveBtn].forEach(btn => {
    if (!btn) return;
    btn.className = `px-4 py-2 rounded-xl text-white ${theme.primaryBg} ${theme.primaryHover}`;
  });

  const grid = document.getElementById('calendar');
  grid.className = `grid grid-cols-7 grid-rows-2 gap-4 p-4 rounded-3xl shadow h-[75vh] ${theme.calendarBg}`;
}

// ===============================
//  CALENDAR FORM HELPERS
// ===============================

function getWeekStart(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function showCalendarForm(mode) {
  const modal = document.getElementById('calendar-form-modal');
  const title = document.getElementById('calendar-form-title');
  const nameInput = document.getElementById('calendar-name-input');
  const colorSelect = document.getElementById('calendar-color-select');

  modal.setAttribute('data-mode', mode);

  if (mode === 'edit') {
    title.textContent = 'Edit Calendar';
    nameInput.value = currentCalendar.name;
    colorSelect.value = currentCalendar.color;
  } else {
    title.textContent = 'New Calendar';
    nameInput.value = '';
    colorSelect.value = 'blue';
  }

  modal.classList.remove('hidden');
}

function hideCalendarForm() {
  const modal = document.getElementById('calendar-form-modal');
  modal.classList.add('hidden');
}

async function createCalendar(name, color) {
  const res = await fetch('/api/calendars', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  return await res.json();
}

async function updateCalendar(id, name, color) {
  const res = await fetch(`/api/calendars/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  return await res.json();
}

async function deleteCurrentCalendar() {
  if (!confirm('Delete this calendar?')) return;

  await fetch(`/api/calendars/${currentCalendarId}`, { method: 'DELETE' });
  await loadCalendars();
}

async function saveCalendarFromForm() {
  const modal = document.getElementById('calendar-form-modal');
  const mode = modal.getAttribute('data-mode');
  const name = document.getElementById('calendar-name-input').value.trim();
  const color = document.getElementById('calendar-color-select').value;

  if (!name) return alert('Name required');

  if (mode === 'edit') {
    await updateCalendar(currentCalendarId, name, color);
  } else {
    const created = await createCalendar(name, color);
    currentCalendarId = created.id;
  }

  hideCalendarForm();
  await loadCalendars();
}

// ===============================
//  LOAD MODAL DATA (TASKS ONLY)
// ===============================

async function loadModalData(dateStr) {
  const res = await fetch(`/api/tasks?calendarId=${currentCalendarId}`);
  const allTasks = await res.json();
  const dateTasks = allTasks.filter(t => t.note_date === dateStr);
  renderTasks(dateTasks);
}

// ===============================
//  TICKER (TASKS ONLY)
// ===============================

function updateTicker(tasks) {
  const ticker = document.getElementById('ticker-content');
  ticker.innerHTML = '';

  const now = new Date();
  const next7 = new Date();
  next7.setDate(now.getDate() + 7);

  const upcoming = tasks.filter(t => {
    const d = new Date(t.note_date);
    return d >= now && d <= next7;
  });

  if (upcoming.length === 0) {
    ticker.innerHTML = `<span class="text-slate-400">No upcoming items</span>`;
    return;
  }

  upcoming.forEach(item => {
    ticker.innerHTML += `
      <span class="text-blue-600 mx-4 whitespace-nowrap">
        📋 ${new Date(item.note_date).toLocaleDateString()} - ${item.subject} [${item.status}]
      </span>
    `;
  });
}
// ===============================
//  OPEN NOTE MODAL + QUILL SETUP
// ===============================

async function openNoteModal(dateStr) {
  currentDate = dateStr;

  const dateObj = parseDate(dateStr);

  const dateDisplay = document.getElementById('modal-date-display');
  dateDisplay.textContent = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const modal = document.getElementById('note-modal');
  modal.classList.remove('hidden');

  // Reset editor container
  const container = document.getElementById('editor-container');
  container.innerHTML = `<div id="editor" class="bg-white text-slate-900 rounded-2xl shadow-inner flex-1"></div>`;

  // Initialize Quill
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link', 'image', 'video'],
        ['clean'],
        ['divider']
      ]
    },
    placeholder: 'Write your notes here...'
  });

  const toolbar = quill.getModule('toolbar');

  // Divider button
  toolbar.addHandler('divider', () => {
    const range = quill.getSelection();
    if (range) {
      quill.insertEmbed(range.index, 'divider', true, 'user');
      quill.setSelection(range.index + 1, 0);
    }
  });

  // Style divider button
  setTimeout(() => {
    const dividerBtn = document.querySelector('.ql-divider');
    if (dividerBtn) {
      dividerBtn.innerHTML = '<i>―</i>';
      dividerBtn.title = 'Insert Horizontal Line';
      dividerBtn.style.fontWeight = 'bold';
    }
  }, 100);

  // Custom image handler (toolbar)
  toolbar.addHandler('image', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const url = await uploadImageToServer(file);
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', url, 'user');
        quill.setSelection(range.index + 1);
      } catch (e) {
        console.error('Image upload failed:', e);
        alert('Image upload failed');
      }
    };

    input.click();
  });

  // Paste image support
  quill.root.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const url = await uploadImageToServer(file);
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', url, 'user');
          quill.setSelection(range.index + 1);
        } catch (err) {
          console.error('Paste image upload failed:', err);
          alert('Image upload failed');
        }
      }
    }
  });

  // Drag & drop image support
  quill.root.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      const url = await uploadImageToServer(file);
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', url, 'user');
      quill.setSelection(range.index + 1);
    } catch (err) {
      console.error('Drop image upload failed:', err);
      alert('Image upload failed');
    }
  });

  // Load existing note
  try {
    const res = await fetch(`/api/notes/${dateStr}?calendarId=${currentCalendarId}`);
    const data = await res.json();
    if (data) quill.setContents(data);
  } catch (e) {
    console.warn('No existing note or failed to load note:', e);
  }

  await loadModalData(dateStr);
}

// ===============================
//  SAVE NOTE
// ===============================

async function saveNote() {
  if (!currentDate || !currentCalendarId || !quill) return;

  const delta = quill.getContents();

  try {
    await fetch(`/api/notes/${currentDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarId: currentCalendarId,
        content: delta
      })
    });

    loadCalendar();
  } catch (e) {
    console.error('Failed to save note:', e);
    alert('Failed to save note');
  }
}

// ===============================
//  CLOSE MODAL
// ===============================

function closeModal() {
  saveNote();
  document.getElementById('note-modal').classList.add('hidden');
  currentDate = null;
}
// ===============================
//  RENDER TASKS (MODAL)
// ===============================

function renderTasks(tasks) {
  const container = document.getElementById('modal-tasks-list');
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `<div class="text-slate-500 text-sm italic p-2">No tasks for this day.</div>`;
    return;
  }

  tasks.forEach(task => {
    const statusColor = getStatusColor(task.status);

    let timeInfo = '';
    if (task.start_datetime || task.end_datetime) {
      const start = task.start_datetime ? task.start_datetime.replace('T', ' ') : '';
      const end = task.end_datetime ? task.end_datetime.replace('T', ' ') : '';
      timeInfo = `<div class="text-xs text-slate-500 mt-1">${start} ${end ? '→ ' + end : ''}</div>`;
    }

    const item = document.createElement('div');
    item.className = `
      flex items-center justify-between 
      bg-white rounded-xl px-4 py-3 text-sm mb-2 shadow-sm 
      cursor-pointer hover:bg-slate-100
    `;

    item.innerHTML = `
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div class="font-medium ${statusColor}">${task.subject}</div>
          <span class="${statusColor} text-xs font-medium px-3 py-0.5 rounded-full">
            ${task.status}
          </span>
        </div>
        ${task.description ? `<div class="text-xs text-slate-500 mt-1 line-clamp-1">${task.description}</div>` : ''}
        ${timeInfo}
      </div>

      <button 
        onclick="deleteTask(${task.id}); event.stopPropagation();"
        class="ml-4 px-3 py-1 text-red-500 hover:bg-red-100 rounded-xl text-xl leading-none"
      >×</button>
    `;

    item.querySelector('.flex-1').addEventListener('click', () => {
      editTask(task);
    });

    container.appendChild(item);
  });
}

// ===============================
//  DELETE TASK
// ===============================

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;

  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });

  if (currentDate) await loadModalData(currentDate);
  loadCalendar();
}

// ===============================
//  EDIT TASK
// ===============================

function editTask(task) {
  document.getElementById('task-subject-input').value = task.subject || '';
  document.getElementById('task-desc-textarea').value = task.description || '';
  document.getElementById('task-start-input').value = task.start_datetime || '';
  document.getElementById('task-end-input').value = task.end_datetime || '';
  document.getElementById('task-status-select').value = task.status || 'Not Started';

  const form = document.getElementById('task-form');
  form.setAttribute('data-id', task.id);
  form.setAttribute('data-mode', 'edit');

  showTaskForm();
}

// ===============================
//  TASK FORM
// ===============================

function showTaskForm() {
  document.getElementById('task-form').classList.remove('hidden');
}

function hideTaskForm() {
  const form = document.getElementById('task-form');
  form.classList.add('hidden');
  form.removeAttribute('data-id');
  form.removeAttribute('data-mode');

  document.getElementById('task-subject-input').value = '';
  document.getElementById('task-desc-textarea').value = '';
  document.getElementById('task-start-input').value = '';
  document.getElementById('task-end-input').value = '';
  document.getElementById('task-status-select').value = 'Not Started';
}

async function saveTask() {
  if (!currentDate || !currentCalendarId) return;

  const subject = document.getElementById('task-subject-input').value.trim();
  const desc = document.getElementById('task-desc-textarea').value.trim();
  const start = document.getElementById('task-start-input').value;
  const end = document.getElementById('task-end-input').value;
  const status = document.getElementById('task-status-select').value;

  if (!subject) return alert('Task subject is required');

  const form = document.getElementById('task-form');
  const mode = form.getAttribute('data-mode');
  const id = form.getAttribute('data-id');

  const payload = {
    calendar_id: currentCalendarId,
    note_date: currentDate,
    subject,
    description: desc,
    start_datetime: start,
    end_datetime: end,
    status
  };

  try {
    if (mode === 'edit') {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    hideTaskForm();
    await loadModalData(currentDate);
    loadCalendar();
  } catch (e) {
    console.error('Failed to save task:', e);
    alert('Failed to save task');
  }
}
// ===============================
//  LOAD CALENDAR GRID (14 DAYS)
// ===============================

async function loadCalendar() {
  const end = new Date(displayStart);
  end.setDate(end.getDate() + 13);

  const startStr = formatDate(displayStart);
  const endStr = formatDate(end);

  const [notesRes, tasksRes] = await Promise.all([
    fetch(`/api/calendar?start=${startStr}&end=${endStr}&calendarId=${currentCalendarId}`),
    fetch(`/api/tasks?calendarId=${currentCalendarId}`)
  ]);

  const notes = await notesRes.json();
  const tasks = await tasksRes.json();

  updateTicker(tasks);

  const monthTitle = document.getElementById('month-title');
  monthTitle.textContent = new Date(displayStart).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  });

  const grid = document.getElementById('calendar');
  grid.innerHTML = '';

  const theme = getCurrentTheme();

  for (let i = 0; i < 14; i++) {
    const date = new Date(displayStart);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    const isToday = dateStr === formatDate(new Date());
    const note = notes[dateStr];

    // Extract background image (if any)
    let bgImage = null;
    if (note) {
      try {
        bgImage = extractImageFromDelta(note);
      } catch {}
    }

    // Create day cell
    const cell = document.createElement('div');
    cell.className = `
      rounded-2xl shadow-sm overflow-hidden cursor-pointer transition hover:shadow-md
      ${theme.dayBg}
      ${isToday ? `${theme.todayBg} ring-2 ${theme.todayRing}` : ''}
      relative flex flex-col h-full
    `;

    // Background image layer
    if (bgImage) {
      cell.innerHTML += `
        <div class="absolute inset-0 bg-cover bg-center opacity-70 pointer-events-none"
             style="background-image: url('${bgImage}');"></div>
      `;
    }

    // White overlay for readability
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-white/30 pointer-events-none';
    cell.appendChild(overlay);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'relative z-10 flex flex-col h-full';

    // TOP SECTION — DATE + NOTE PREVIEW
    const top = document.createElement('div');
    top.className = 'flex-1 p-3 overflow-auto'; // scrollable

    // Date number
    top.innerHTML = `
      <div class="text-3xl font-semibold mb-2 ${isToday ? theme.accentText : 'text-slate-700'}">
        ${date.getDate()}
      </div>
    `;

    // Full note preview
    if (note) {
      const html = deltaToHtml(note);
if (html) {
  top.innerHTML += `
    <div class="note-preview ql-editor text-[0.75rem] leading-snug overflow-auto">
      ${html}
    </div>
  `;
}

    }

    // Append content
    content.appendChild(top);
    cell.appendChild(content);

    // Click to open modal
    cell.onclick = () => openNoteModal(dateStr);

    grid.appendChild(cell);
  }
}
// ===============================
//  NAVIGATION
// ===============================

function prevWeek() {
  displayStart.setDate(displayStart.getDate() - 7);
  loadCalendar();
}

function nextWeek() {
  displayStart.setDate(displayStart.getDate() + 7);
  loadCalendar();
}

function today() {
  displayStart = getWeekStart(new Date());
  loadCalendar();
}

// ===============================
//  EXPORT DATA
// ===============================

async function exportData() {
  try {
    const [notesRes, tasksRes, calendarsRes] = await Promise.all([
      fetch(`/api/calendar?start=0000-01-01&end=9999-12-31&calendarId=${currentCalendarId}`),
      fetch(`/api/tasks?calendarId=${currentCalendarId}`),
      fetch('/api/calendars')
    ]);

    const data = {
      calendars: await calendarsRes.json(),
      notes: await notesRes.json(),
      tasks: await tasksRes.json()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifeflow_export.json';
    a.click();

    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed:', e);
    alert('Export failed');
  }
}

// ===============================
//  IMPORT DATA (placeholder)
// ===============================

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    JSON.parse(text);
    alert('Import feature not implemented yet.');
  } catch (e) {
    console.error('Import failed:', e);
    alert('Import failed');
  }
}

// ===============================
//  INIT APP
// ===============================

window.addEventListener('DOMContentLoaded', () => {
  loadCalendars();
});

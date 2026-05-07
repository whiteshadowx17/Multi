// ===============================
//  GLOBAL STATE
// ===============================

let currentCalendarId = null;
let currentCalendar = null;
let calendars = [];
let displayStart = new Date();
displayStart.setDate(displayStart.getDate() - 10);

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

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getStatusColor(status) {
  if (!status) return 'text-slate-700';
  const s = status.toLowerCase();
  if (s.includes('not')) return 'text-slate-700';
  if (s.includes('progress')) return 'text-blue-600';
  if (s.includes('done') || s.includes('complete')) return 'text-emerald-600';
  if (s.includes('blocked') || s.includes('hold')) return 'text-amber-600';
  return 'text-slate-700';
}

// Extract first line of text from Quill delta
function getFirstLine(delta) {
  if (!delta || !delta.ops) return '';
  for (const op of delta.ops) {
    if (typeof op.insert === 'string') {
      const text = op.insert.trim();
      if (text.length > 0) {
        return text.split('\n').filter(Boolean)[0] || '';
      }
    }
  }
  return '';
}

// Extract last image URL from Quill delta
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

// Upload image file to backend
async function uploadImageToServer(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error('Image upload failed');
  }

  const data = await res.json();
  return data.url;
}

// ===============================
//  CALENDAR MANAGEMENT
// ===============================

async function loadCalendars() {
  try {
    const res = await fetch('/api/calendars');
    const data = await res.json();
    calendars = data || [];

    if (calendars.length === 0) {
      const created = await createCalendar('Default', 'blue');
      calendars = [created];
    }

    if (!currentCalendarId) {
      currentCalendarId = calendars[0].id;
    }

    currentCalendar = calendars.find(c => c.id === currentCalendarId) || calendars[0];
    currentCalendarId = currentCalendar.id;

    renderCalendarSelector();
    applyTheme();
    await loadCalendar();
  } catch (e) {
    console.error('Failed to load calendars:', e);
  }
}

function renderCalendarSelector() {
  const select = document.getElementById('calendar-select');
  if (!select) return;

  select.innerHTML = '';
  calendars.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.name;
    if (cal.id === currentCalendarId) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = () => {
    const id = parseInt(select.value, 10);
    currentCalendarId = id;
    currentCalendar = calendars.find(c => c.id === id) || null;
    applyTheme();
    loadCalendar();
  };
}

function applyTheme() {
  const theme = getCurrentTheme();

  const todayBtn = document.getElementById('today-btn');
  const exportBtn = document.getElementById('export-btn');
  const calendarSaveBtn = document.querySelector('#calendar-form-modal button[onclick="saveCalendarFromForm()"]');

  const themedButtons = [todayBtn, exportBtn, calendarSaveBtn].filter(Boolean);

  themedButtons.forEach(btn => {
    btn.classList.remove(
      'bg-blue-500','hover:bg-blue-400',
      'bg-green-500','hover:bg-green-400',
      'bg-amber-500','hover:bg-amber-400',
      'bg-purple-500','hover:bg-purple-400',
      'bg-rose-500','hover:bg-rose-400',
      'bg-emerald-500','hover:bg-emerald-400'
    );
    btn.classList.add(theme.primaryBg, theme.primaryHover);
  });

  const grid = document.getElementById('calendar');
  if (grid) {
    grid.className = `grid grid-cols-7 gap-4 p-4 rounded-3xl shadow ${theme.calendarBg}`;
  }
}

// ===============================
//  CALENDAR FORM HELPERS
// ===============================

function showCalendarForm(mode) {
  const modal = document.getElementById('calendar-form-modal');
  const title = document.getElementById('calendar-form-title');
  const nameInput = document.getElementById('calendar-name-input');
  const colorSelect = document.getElementById('calendar-color-select');

  modal.setAttribute('data-mode', mode || 'create');

  if (mode === 'edit' && currentCalendar) {
    title.textContent = 'Edit Calendar';
    nameInput.value = currentCalendar.name;
    colorSelect.value = currentCalendar.color || 'blue';
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
  modal.removeAttribute('data-mode');
}

async function createCalendar(name, color) {
  const res = await fetch('/api/calendars', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  if (!res.ok) throw new Error('Failed to create calendar');
  return await res.json();
}

async function updateCalendar(id, name, color) {
  const res = await fetch(`/api/calendars/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  if (!res.ok) throw new Error('Failed to update calendar');
  return await res.json();
}

async function deleteCurrentCalendar() {
  if (!currentCalendarId) return;
  const cal = calendars.find(c => c.id === currentCalendarId);
  if (!cal) return;

  if (!confirm(`Delete calendar "${cal.name}" and all its notes, reminders, and tasks?`)) return;

  try {
    const res = await fetch(`/api/calendars/${currentCalendarId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to delete calendar');
      return;
    }

    await loadCalendars();
  } catch (e) {
    console.error('Failed to delete calendar:', e);
    alert('Failed to delete calendar');
  }
}

async function saveCalendarFromForm() {
  const modal = document.getElementById('calendar-form-modal');
  const nameInput = document.getElementById('calendar-name-input');
  const colorSelect = document.getElementById('calendar-color-select');

  const mode = modal.getAttribute('data-mode') || 'create';
  const name = nameInput.value.trim();
  const color = colorSelect.value;

  if (!name) {
    alert('Calendar name is required');
    return;
  }

  try {
    if (mode === 'edit' && currentCalendar) {
      const updated = await updateCalendar(currentCalendar.id, name, color);
      const idx = calendars.findIndex(c => c.id === updated.id);
      if (idx !== -1) calendars[idx] = updated;
      currentCalendar = updated;
      currentCalendarId = updated.id;
    } else {
      const created = await createCalendar(name, color);
      calendars.push(created);
      currentCalendar = created;
      currentCalendarId = created.id;
    }

    hideCalendarForm();
    renderCalendarSelector();
    applyTheme();
    await loadCalendar();
  } catch (e) {
    console.error('Failed to save calendar:', e);
    alert('Failed to save calendar');
  }
}

// ===============================
//  LOAD MODAL DATA (REMINDERS + TASKS)
// ===============================

async function loadModalData(dateStr) {
  if (!currentCalendarId) return;

  try {
    const [remRes, taskRes] = await Promise.all([
      fetch(`/api/reminders?calendarId=${currentCalendarId}`),
      fetch(`/api/tasks?calendarId=${currentCalendarId}`)
    ]);

    const allReminders = await remRes.json();
    const allTasks = await taskRes.json();

    const dateReminders = allReminders.filter(r => r.note_date === dateStr);
    const dateTasks = allTasks.filter(t => t.note_date === dateStr);

    renderReminders(dateReminders);
    renderTasks(dateTasks);
  } catch (e) {
    console.error('Failed to load modal data:', e);
  }
}

// ===============================
//  TICKER (UPCOMING REMINDERS + TASKS)
// ===============================

function updateTicker(reminders, tasks) {
  const tickerContainer = document.getElementById('ticker-content');
  if (!tickerContainer) return;

  const upcoming = [];
  const now = new Date();
  const next7 = new Date();
  next7.setDate(now.getDate() + 7);

  reminders.forEach(r => {
    const d = new Date(r.note_date);
    if (d >= now && d <= next7) {
      upcoming.push({
        type: 'reminder',
        date: d,
        message: r.message,
        time: r.reminder_time
      });
    }
  });

  tasks.forEach(t => {
    const d = new Date(t.note_date);
    if (d >= now && d <= next7) {
      upcoming.push({
        type: 'task',
        date: d,
        message: t.subject,
        status: t.status
      });
    }
  });

  upcoming.sort((a, b) => a.date - b.date);

  if (upcoming.length === 0) {
    tickerContainer.innerHTML = `<span class="text-slate-400">No upcoming items</span>`;
    return;
  }

  let html = '';
  upcoming.forEach(item => {
    const dateStr = item.date.toLocaleDateString();
    const timeStr = item.time ? `at ${item.time}` : '';
    const statusStr = item.status ? `[${item.status}]` : '';
    const icon = item.type === 'reminder' ? '🔔' : '📋';
    const color = item.type === 'reminder' ? 'text-amber-600' : 'text-blue-600';

    html += `
      <span class="${color} mx-4 whitespace-nowrap">
        ${icon} ${dateStr} ${timeStr} - ${item.message} ${statusStr}
      </span>
    `;
  });

  tickerContainer.innerHTML = html;
}

// ===============================
//  LOAD CALENDAR GRID
// ===============================

async function loadCalendar() {
  if (!currentCalendarId) return;

  const end = new Date(displayStart);
  end.setDate(end.getDate() + 20);

  const startStr = formatDate(displayStart);
  const endStr = formatDate(end);

  try {
    const [notesRes, remindersRes, tasksRes] = await Promise.all([
      fetch(`/api/calendar?start=${startStr}&end=${endStr}&calendarId=${currentCalendarId}`),
      fetch(`/api/reminders?calendarId=${currentCalendarId}`),
      fetch(`/api/tasks?calendarId=${currentCalendarId}`)
    ]);

    const notes = await notesRes.json();
    const reminders = await remindersRes.json();
    const tasks = await tasksRes.json();

    updateTicker(reminders, tasks);

    const monthTitle = document.getElementById('month-title');
    if (monthTitle) {
      monthTitle.textContent = new Date(displayStart).toLocaleString('default', {
        month: 'long',
        year: 'numeric'
      });
    }

    const grid = document.getElementById('calendar');
    if (!grid) return;
    grid.innerHTML = '';

    const theme = getCurrentTheme();

    for (let i = 0; i < 21; i++) {
      const date = new Date(displayStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      const isToday = dateStr === formatDate(new Date());
      const note = notes[dateStr];

      let bgImage = null;
      if (note) {
        try {
          const parsed = typeof note === 'string' ? JSON.parse(note) : note;
          bgImage = extractImageFromDelta(parsed);
        } catch {}
      }

      const cell = document.createElement('div');
      cell.className = `
        rounded-2xl shadow-sm overflow-hidden cursor-pointer transition hover:shadow-md
        ${theme.dayBg}
        ${isToday ? `${theme.todayBg} ring-2 ${theme.todayRing}` : ''}
        relative
        h-[220px]
        flex flex-col
      `;

      if (bgImage) {
  cell.style.position = 'relative';
  cell.innerHTML += `
    <div class="absolute inset-0 bg-cover bg-center opacity-70 pointer-events-none"
         style="background-image: url('${bgImage}'); z-index:0;"></div>
  `;
}

      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 bg-white/30 pointer-events-none';
      cell.appendChild(overlay);

      const content = document.createElement('div');
      content.className = 'relative z-10 flex flex-col h-full';

      const top = document.createElement('div');
      top.className = 'p-4 flex-1';

      top.innerHTML = `
        <div class="text-4xl font-semibold mb-2 ${isToday ? theme.accentText : 'text-slate-700'}">
          ${date.getDate()}
        </div>
      `;

      if (note) {
        try {
          const parsed = typeof note === 'string' ? JSON.parse(note) : note;
          const firstLine = getFirstLine(parsed);
          if (firstLine) {
            top.innerHTML += `
              <div class="text-sm text-slate-700 line-clamp-3">${firstLine}</div>
            `;
          }
        } catch {}
      }

      const bottom = document.createElement('div');
      bottom.className = `
        h-12 border-t border-slate-300 bg-white/60 backdrop-blur-sm
        flex
      `;

      const dayReminders = reminders.filter(r => r.note_date === dateStr);
      const dayTasks = tasks.filter(t => t.note_date === dateStr);

      bottom.innerHTML = `
        <div class="w-1/2 flex items-center justify-center text-amber-600 text-sm">
          ${dayReminders.length > 0 ? `🔔 ${dayReminders.length}` : `<span class="text-slate-400 text-xs">0</span>`}
        </div>
        <div class="w-1/2 flex items-center justify-center text-blue-600 text-sm">
          ${dayTasks.length > 0 ? `📋 ${dayTasks.length}` : `<span class="text-slate-400 text-xs">0</span>`}
        </div>
      `;

      content.appendChild(top);
      content.appendChild(bottom);
      cell.appendChild(content);

      cell.onclick = () => openNoteModal(dateStr);
      grid.appendChild(cell);
    }
  } catch (error) {
    console.error('Error loading calendar:', error);
    const grid = document.getElementById('calendar');
    if (grid) {
      grid.innerHTML = `<div class="col-span-7 text-center text-red-500 p-8">Error loading calendar</div>`;
    }
  }
}

// ===============================
//  RENDER REMINDERS
// ===============================

function renderReminders(reminders) {
  const container = document.getElementById('modal-reminders-list');
  if (!container) return;

  container.innerHTML = '';

  if (reminders.length === 0) {
    container.innerHTML = `<div class="text-slate-500 text-sm italic p-2">No reminders for this day.</div>`;
    return;
  }

  reminders.forEach(rem => {
    const item = document.createElement('div');
    item.className = `
      flex items-center justify-between 
      bg-white rounded-xl px-4 py-3 text-sm mb-2 shadow-sm 
      cursor-pointer hover:bg-slate-100
    `;

    item.innerHTML = `
      <div class="flex-1">
        <div class="font-medium text-amber-600">${rem.message}</div>
        <div class="text-xs text-slate-500 mt-1">${rem.reminder_time || 'No time set'}</div>
      </div>
      <button 
        onclick="deleteReminder(${rem.id}); event.stopPropagation();"
        class="ml-4 px-3 py-1 text-red-500 hover:bg-red-100 rounded-xl text-xl leading-none"
      >×</button>
    `;

    item.querySelector('.flex-1').addEventListener('click', () => {
      editReminder(rem);
    });

    container.appendChild(item);
  });
}

// ===============================
//  RENDER TASKS
// ===============================

function renderTasks(tasks) {
  const container = document.getElementById('modal-tasks-list');
  if (!container) return;

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
          <span class="${statusColor} text-xs font-medium px-3 py-0.5 rounded-full ">
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
//  DELETE REMINDER
// ===============================

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;

  try {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    if (currentDate) await loadModalData(currentDate);
    loadCalendar();
  } catch (e) {
    console.error(e);
    alert('Failed to delete reminder');
  }
}

// ===============================
//  DELETE TASK
// ===============================

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;

  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (currentDate) await loadModalData(currentDate);
    loadCalendar();
  } catch (e) {
    console.error(e);
    alert('Failed to delete task');
  }
}

// ===============================
//  EDIT REMINDER
// ===============================

function editReminder(rem) {
  const subjectInput = document.getElementById('reminder-subject-input');
  const descInput = document.getElementById('reminder-desc-input');
  const timeInput = document.getElementById('reminder-time-input');
  const form = document.getElementById('reminder-form');

  let subject = rem.message;
  let desc = '';

  if (rem.message.includes(' - ')) {
    const parts = rem.message.split(' - ');
    subject = parts[0];
    desc = parts.slice(1).join(' - ');
  }

  subjectInput.value = subject;
  descInput.value = desc;
  timeInput.value = rem.reminder_time || '';

  form.setAttribute('data-id', rem.id);
  form.setAttribute('data-mode', 'edit');

  showReminderForm();
}

// ===============================
//  EDIT TASK
// ===============================

function editTask(task) {
  const subjectInput = document.getElementById('task-subject-input');
  const descInput = document.getElementById('task-desc-textarea');
  const startInput = document.getElementById('task-start-input');
  const endInput = document.getElementById('task-end-input');
  const statusSelect = document.getElementById('task-status-select');
  const form = document.getElementById('task-form');

  subjectInput.value = task.subject || '';
  descInput.value = task.description || '';
  startInput.value = task.start_datetime || '';
  endInput.value = task.end_datetime || '';
  statusSelect.value = task.status || 'Not Started';

  form.setAttribute('data-id', task.id);
  form.setAttribute('data-mode', 'edit');

  showTaskForm();
}

// ===============================
//  OPEN NOTE MODAL + QUILL SETUP
// ===============================

async function openNoteModal(dateStr) {
  if (!currentCalendarId) return;

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

  const container = document.getElementById('editor-container');
  container.innerHTML = `<div id="editor" class="bg-white text-slate-900 rounded-2xl shadow-inner flex-1"></div>`;

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

  // Style divider button
  setTimeout(() => {
    const dividerBtn = document.querySelector('.ql-divider');
    if (dividerBtn) {
      dividerBtn.innerHTML = '<i>―</i>';
      dividerBtn.title = 'Insert Horizontal Line';
      dividerBtn.style.fontWeight = 'bold';
    }
  }, 100);

  // Paste image support
  quill.root.addEventListener('paste', async (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
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
    const dt = e.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;

    const file = dt.files[0];
    if (!file.type.startsWith('image/')) return;

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
  } catch {}

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
  const modal = document.getElementById('note-modal');
  modal.classList.add('hidden');
  currentDate = null;
}

// ===============================
//  REMINDER FORM
// ===============================

function showReminderForm() {
  document.getElementById('reminder-form').classList.remove('hidden');
}

function hideReminderForm() {
  const form = document.getElementById('reminder-form');
  form.classList.add('hidden');
  form.removeAttribute('data-id');
  form.removeAttribute('data-mode');

  document.getElementById('reminder-subject-input').value = '';
  document.getElementById('reminder-desc-input').value = '';
  document.getElementById('reminder-time-input').value = '';
}

async function saveReminder() {
  if (!currentDate || !currentCalendarId) return;

  const subject = document.getElementById('reminder-subject-input').value.trim();
  const desc = document.getElementById('reminder-desc-input').value.trim();
  const time = document.getElementById('reminder-time-input').value;

  if (!subject) {
    alert('Reminder subject is required');
    return;
  }

  const message = desc ? `${subject} - ${desc}` : subject;

  const form = document.getElementById('reminder-form');
  const mode = form.getAttribute('data-mode');
  const id = form.getAttribute('data-id');

  try {
    if (mode === 'edit' && id) {
      await fetch(`/api/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: currentCalendarId,
          note_date: currentDate,
          reminder_time: time,
          message
        })
      });
    } else {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: currentCalendarId,
          note_date: currentDate,
          reminder_time: time,
          message
        })
      });
    }

    hideReminderForm();
    await loadModalData(currentDate);
    loadCalendar();
  } catch (e) {
    console.error('Failed to save reminder:', e);
    alert('Failed to save reminder');
  }
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

  if (!subject) {
    alert('Task subject is required');
    return;
  }

  const form = document.getElementById('task-form');
  const mode = form.getAttribute('data-mode');
  const id = form.getAttribute('data-id');

  try {
    if (mode === 'edit' && id) {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: currentCalendarId,
          note_date: currentDate,
          subject,
          description: desc,
          start_datetime: start,
          end_datetime: end,
          status
        })
      });
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendar_id: currentCalendarId,
          note_date: currentDate,
          subject,
          description: desc,
          start_datetime: start,
          end_datetime: end,
          status
        })
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
  displayStart = new Date();
  displayStart.setDate(displayStart.getDate() - 10);
  loadCalendar();
}

// ===============================
//  EXPORT DATA
// ===============================

async function exportData() {
  try {
    const [notesRes, remindersRes, tasksRes, calendarsRes] = await Promise.all([
      fetch('/api/calendar?start=0000-01-01&end=9999-12-31&calendarId=' + currentCalendarId),
      fetch('/api/reminders?calendarId=' + currentCalendarId),
      fetch('/api/tasks?calendarId=' + currentCalendarId),
      fetch('/api/calendars')
    ]);

    const data = {
      calendars: await calendarsRes.json(),
      notes: await notesRes.json(),
      reminders: await remindersRes.json(),
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
    const data = JSON.parse(text);

    alert('Import feature is not yet implemented in this merged version.');
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

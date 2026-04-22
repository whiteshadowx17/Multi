let quill = null;
let currentDate = null;
let displayStart = new Date();
displayStart.setDate(displayStart.getDate() - 10);

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPreview(delta) {
  if (!delta?.ops) return { text: '', image: null };
  let text = '';
  let image = null;
  for (const op of delta.ops) {
    if (typeof op.insert === 'string') text += op.insert;
    else if (op.insert?.image) image = op.insert.image;
  }
  return {
    text: text.slice(0, 90) + (text.length > 90 ? '…' : ''),
    image
  };
}

async function loadCalendar() {
  const end = new Date(displayStart);
  end.setDate(end.getDate() + 20);
  const startStr = formatDate(displayStart);
  const endStr = formatDate(end);

  const [notesRes, remindersRes] = await Promise.all([
    fetch(`/api/calendar?start=${startStr}&end=${endStr}`),
    fetch('/api/reminders')
  ]);

  const notes = await notesRes.json();
  const allReminders = await remindersRes.json();

  const remindersMap = {};
  allReminders.forEach(r => {
    if (!remindersMap[r.note_date]) remindersMap[r.note_date] = [];
    remindersMap[r.note_date].push(r);
  });

  const monthTitle = document.getElementById('month-title');
  monthTitle.textContent = new Date(displayStart).toLocaleString('default', { month: 'long', year: 'numeric' });

  const grid = document.getElementById('calendar');
  grid.innerHTML = '';

  for (let i = 0; i < 21; i++) {
    const date = new Date(displayStart);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    const isToday = dateStr === formatDate(new Date());
    const note = notes[dateStr];
    const preview = getPreview(note);
    const dayReminders = remindersMap[dateStr] || [];

    let bgStyle = preview.image ? `background-image: url('${preview.image}');` : '';

    const cell = document.createElement('div');
    cell.className = `calendar-cell bg-slate-900 border border-slate-700 rounded-3xl p-6 flex flex-col cursor-pointer hover:ring-2 hover:ring-blue-400 h-full min-h-[200px] relative overflow-hidden ${isToday ? 'ring-2 ring-blue-400' : ''}`;
    cell.style = bgStyle;

    let html = `<div class="relative z-10 text-4xl font-semibold mb-4 ${isToday ? 'text-blue-400' : 'text-slate-100'}">${date.getDate()}</div>`;

    if (preview.text) {
      html += `<div class="relative z-10 flex-1 text-sm text-slate-200 line-clamp-4">${preview.text}</div>`;
    }

    if (dayReminders.length > 0) {
      const first = dayReminders[0];
      html += `<div class="relative z-10 mt-3 flex items-center gap-2 text-amber-400 text-sm"><span>🛎️</span> ${first.message}</div>`;
    }

    cell.innerHTML = html;
    cell.onclick = () => openNoteModal(dateStr);
    grid.appendChild(cell);
  }
}

async function loadModalData(dateStr) {
  try {
    const [remRes, taskRes] = await Promise.all([
      fetch('/api/reminders'),
      fetch('/api/tasks')
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

function renderReminders(reminders) {
  const container = document.getElementById('modal-reminders-list');
  container.innerHTML = '';

  if (reminders.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-sm italic p-2">No reminders for this day.</div>`;
    return;
  }

  reminders.forEach(rem => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-3 text-sm mb-2';
    item.innerHTML = `
      <div class="flex-1">
        <div class="font-medium text-amber-300">${rem.message}</div>
        <div class="text-xs text-slate-500 mt-1">${rem.reminder_time || 'No time set'}</div>
      </div>
      <button 
        onclick="deleteReminder(${rem.id}); event.stopImmediatePropagation();"
        class="ml-4 px-3 py-1 text-red-400 hover:bg-red-900/50 rounded-xl text-xl leading-none">×</button>
    `;
    container.appendChild(item);
  });
}

function renderTasks(tasks) {
  const container = document.getElementById('modal-tasks-list');
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-sm italic p-2">No tasks for this day.</div>`;
    return;
  }

  tasks.forEach(task => {
    const statusColor = {
      'Not Started': 'text-slate-400',
      'Working': 'text-blue-400',
      'Completed': 'text-emerald-400'
    }[task.status] || 'text-slate-400';

    let timeInfo = '';
    if (task.start_datetime || task.end_datetime) {
      const start = task.start_datetime ? task.start_datetime.replace('T', ' ') : '';
      const end = task.end_datetime ? task.end_datetime.replace('T', ' ') : '';
      timeInfo = `<div class="text-xs text-slate-500 mt-1">${start} ${end ? '→ ' + end : ''}</div>`;
    }

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-3 text-sm mb-2';
    item.innerHTML = `
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div class="font-medium">${task.subject}</div>
          <span class="${statusColor} text-xs font-medium px-3 py-0.5 rounded-full bg-slate-700">${task.status}</span>
        </div>
        ${task.description ? `<div class="text-xs text-slate-400 mt-1 line-clamp-1">${task.description}</div>` : ''}
        ${timeInfo}
      </div>
      <button 
        onclick="deleteTask(${task.id}); event.stopImmediatePropagation();"
        class="ml-4 px-3 py-1 text-red-400 hover:bg-red-900/50 rounded-xl text-xl leading-none">×</button>
    `;
    container.appendChild(item);
  });
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  try {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    if (currentDate) await loadModalData(currentDate);
  } catch (e) {
    console.error(e);
    alert('Failed to delete reminder');
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (currentDate) await loadModalData(currentDate);
  } catch (e) {
    console.error(e);
    alert('Failed to delete task');
  }
}

async function openNoteModal(dateStr) {
  currentDate = dateStr;
  document.getElementById('modal-date').textContent = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('note-modal').classList.remove('hidden');

  const container = document.getElementById('editor-container');
  container.innerHTML = '<div id="editor" class="bg-white text-slate-900 rounded-2xl shadow-inner flex-1"></div>';

  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ]
    },
    placeholder: 'Write your notes here...'
  });

  try {
    const res = await fetch(`/api/notes/${dateStr}`);
    const data = await res.json();
    if (data) quill.setContents(data);
  } catch (e) {}

  await loadModalData(dateStr);
}

function closeModal() {
  if (quill && currentDate) {
    const content = quill.getContents();
    fetch(`/api/notes/${currentDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).catch(() => {});
  }
  document.getElementById('note-modal').classList.add('hidden');
  quill = null;
  currentDate = null;
  loadCalendar();
}

// Reminder Form
function showReminderForm() {
  document.getElementById('reminder-subject').value = '';
  document.getElementById('reminder-desc').value = '';
  document.getElementById('reminder-time').value = '';
  document.getElementById('reminder-form').classList.remove('hidden');
}

function hideReminderForm() {
  document.getElementById('reminder-form').classList.add('hidden');
}

async function saveReminder() {
  const subject = document.getElementById('reminder-subject').value.trim();
  const desc = document.getElementById('reminder-desc').value.trim();
  const time = document.getElementById('reminder-time').value;

  if (!subject || !time) {
    alert("Subject and time are required");
    return;
  }

  const message = desc ? `${subject} - ${desc}` : subject;

  await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note_date: currentDate, reminder_time: time, message })
  });

  hideReminderForm();
  if (currentDate) {
    await loadModalData(currentDate);
  }
}

// Task Form
function showTaskForm() {
  document.getElementById('task-subject').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-start').value = '';
  document.getElementById('task-end').value = '';
  document.getElementById('task-status').value = 'Not Started';
  document.getElementById('task-form').classList.remove('hidden');
}

function hideTaskForm() {
  document.getElementById('task-form').classList.add('hidden');
}

async function saveTask() {
  const subject = document.getElementById('task-subject').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const start = document.getElementById('task-start').value;
  const end = document.getElementById('task-end').value;
  const status = document.getElementById('task-status').value;

  if (!subject) {
    alert("Subject is required");
    return;
  }

  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note_date: currentDate,
      subject,
      description: desc,
      start_datetime: start,
      end_datetime: end,
      status
    })
  });

  hideTaskForm();
  if (currentDate) {
    await loadModalData(currentDate);
  }
}

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

window.onload = () => {
  loadCalendar();
};
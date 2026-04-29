let quill = null;
let currentDate = null;
let displayStart = new Date();
let tickerAnimation = null;

displayStart.setDate(displayStart.getDate() - 10);

// Custom Blot for Horizontal Line
const Inline = Quill.import('blots/inline');
const Embed = Quill.import('blots/embed');

class DividerBlot extends Embed {
  static create(value) {
    let node = super.create();
    node.innerHTML = '<hr style="border-top: 1px solid #ccc; margin: 10px 0;">';
    return node;
  }
  
  static value(node) {
    return true;
  }
}

DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'div';
DividerBlot.className = 'ql-divider';

Quill.register(DividerBlot);

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// Get first line of text from Quill content
function getFirstLine(delta) {
  if (!delta?.ops) return '';
  let firstLine = '';
  for (const op of delta.ops) {
    if (typeof op.insert === 'string') {
      const lines = op.insert.split('\n');
      firstLine += lines[0];
      if (lines.length > 1) break; // Stop at first line break
    }
  }
  return firstLine.slice(0, 50) + (firstLine.length > 50 ? '…' : '');
}

// Get status color classes
function getStatusColor(status) {
  switch(status) {
    case 'Completed': return 'text-emerald-400'; // Green
    case 'Working': return 'text-yellow-400';    // Yellow
    case 'Not Started': return 'text-red-400';   // Red
    default: return 'text-slate-400';
  }
}

// Extract images from Quill content for background
function extractImageFromDelta(delta) {
  if (!delta?.ops) return null;
  for (const op of delta.ops) {
    if (op.insert?.image) return op.insert.image;
  }
  return null;
}

// THIS MUST BE DEFINED BEFORE IT'S USED
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

// Ticker functions
function updateTicker(reminders, tasks) {
  const tickerContainer = document.getElementById('ticker-content');
  if (!tickerContainer) return;
  
  // Collect upcoming items
  const upcomingItems = [];
  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(now.getDate() + 7);
  
  // Add reminders for next 7 days
  reminders.forEach(reminder => {
    const reminderDate = new Date(reminder.note_date);
    if (reminderDate >= now && reminderDate <= next7Days) {
      upcomingItems.push({
        type: 'reminder',
        date: reminderDate,
        message: reminder.message,
        time: reminder.reminder_time
      });
    }
  });
  
  // Add tasks for next 7 days
  tasks.forEach(task => {
    const taskDate = new Date(task.note_date);
    if (taskDate >= now && taskDate <= next7Days) {
      upcomingItems.push({
        type: 'task',
        date: taskDate,
        message: task.subject,
        status: task.status
      });
    }
  });
  
  // Sort by date
  upcomingItems.sort((a, b) => a.date - b.date);
  
  // Create ticker content
  if (upcomingItems.length === 0) {
    tickerContainer.innerHTML = '<span class="text-slate-500">No upcoming reminders or tasks in the next 7 days</span>';
    return;
  }
  
  let tickerHTML = '';
  upcomingItems.forEach(item => {
    const dateStr = item.date.toLocaleDateString();
    const timeStr = item.time ? `at ${item.time}` : '';
    const statusStr = item.status ? `[${item.status}]` : '';
    const icon = item.type === 'reminder' ? '🔔' : '📋';
    const color = item.type === 'reminder' ? 'text-amber-400' : 'text-blue-400';
    
    tickerHTML += `
      <span class="${color} mx-2 whitespace-nowrap">
        ${icon} ${dateStr} ${timeStr} - ${item.message} ${statusStr}
      </span>
    `;
  });
  
  tickerContainer.innerHTML = tickerHTML;
}

async function loadCalendar() {
  const end = new Date(displayStart);
  end.setDate(end.getDate() + 20);
  const startStr = formatDate(displayStart);
  const endStr = formatDate(end);

  try {
    const [notesRes, remindersRes, tasksRes] = await Promise.all([
      fetch(`/api/calendar?start=${startStr}&end=${endStr}`),
      fetch('/api/reminders'),
      fetch('/api/tasks')
    ]);

    const notes = await notesRes.json();
    const allReminders = await remindersRes.json();
    const allTasks = await tasksRes.json();

    // Update ticker with current data
    updateTicker(allReminders, allTasks);

    const monthTitle = document.getElementById('month-title');
    if (monthTitle) {
      monthTitle.textContent = new Date(displayStart).toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    const grid = document.getElementById('calendar');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < 21; i++) {
      const date = new Date(displayStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      const isToday = dateStr === formatDate(new Date());
      const note = notes[dateStr];
      
      // Get reminders and tasks for this date
      const dayReminders = allReminders.filter(r => r.note_date === dateStr);
      const dayTasks = allTasks.filter(t => t.note_date === dateStr);
      
      // Extract background image from note content
      let bgImage = null;
      let bgStyle = '';
      if (note) {
        try {
          const noteContent = typeof note === 'string' ? JSON.parse(note) : note;
          bgImage = extractImageFromDelta(noteContent);
          if (bgImage) {
            bgStyle = `background-image: url('${bgImage}'); background-size: cover; background-position: center;`;
          }
        } catch (e) {
          console.log('Could not parse note for background image');
        }
      }

      const cell = document.createElement('div');
      cell.className = `calendar-cell border border-slate-700 rounded-3xl p-0 flex flex-col cursor-pointer hover:ring-2 hover:ring-blue-400 h-full min-h-[220px] relative overflow-hidden ${isToday ? 'ring-2 ring-blue-400' : ''}`;
      
      // Apply background with opacity if image exists
      if (bgImage) {
        cell.style.background = `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), ${bgStyle}`;
      } else {
        cell.classList.add('bg-slate-900');
      }

      // Top half - Note preview (show first line only)
      let topHtml = `<div class="relative z-10 p-4 h-3/4">`;
      topHtml += `<div class="text-4xl font-semibold mb-2 ${isToday ? 'text-blue-400' : 'text-slate-100'}">${date.getDate()}</div>`;
      
      if (note) {
        try {
          const noteContent = typeof note === 'string' ? JSON.parse(note) : note;
          const firstLine = getFirstLine(noteContent);
          if (firstLine) {
            topHtml += `<div class="flex-1 text-sm text-slate-200">${firstLine}</div>`;
          }
        } catch (e) {
          // If parsing fails, try to show raw content
          if (typeof note === 'string') {
            const firstLine = note.split('\n')[0].slice(0, 50) + (note.length > 50 ? '…' : '');
            topHtml += `<div class="flex-1 text-sm text-slate-200">${firstLine}</div>`;
          }
        }
      }
      topHtml += `</div>`;

      // Bottom quarter - Notifications area (25% height)
      let bottomHtml = `<div class="relative z-10 h-1/4 border-t border-slate-700 flex">`;
      
      // Left quarter - Reminders (show icon and count)
      bottomHtml += `<div class="w-1/2 p-2 border-r border-slate-700 flex items-center justify-center">`;
      if (dayReminders.length > 0) {
        bottomHtml += `<div class="flex items-center gap-2 text-amber-400 text-sm">
          <span class="text-lg">🔔</span>
          <span>${dayReminders.length}</span>
        </div>`;
      } else {
        bottomHtml += `<div class="text-slate-500 text-xs">No reminders</div>`;
      }
      bottomHtml += `</div>`;

      // Right quarter - Tasks (show icon and count)
      bottomHtml += `<div class="w-1/2 p-2 flex items-center justify-center">`;
      if (dayTasks.length > 0) {
        bottomHtml += `<div class="flex items-center gap-2 text-blue-400 text-sm">
          <span class="text-lg">📋</span>
          <span>${dayTasks.length}</span>
        </div>`;
      } else {
        bottomHtml += `<div class="text-slate-500 text-xs">No tasks</div>`;
      }
      bottomHtml += `</div>`;
      
      bottomHtml += `</div>`;

      cell.innerHTML = topHtml + bottomHtml;
      cell.onclick = () => openNoteModal(dateStr);
      grid.appendChild(cell);
    }
  } catch (error) {
    console.error('Error loading calendar:', error);
    const grid = document.getElementById('calendar');
    if (grid) {
      grid.innerHTML = '<div class="col-span-7 text-center text-red-400 p-8">Error loading calendar data</div>';
    }
  }
}

function renderReminders(reminders) {
  const container = document.getElementById('modal-reminders-list');
  if (!container) return;
  
  container.innerHTML = '';

  if (reminders.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-sm italic p-2">No reminders for this day.</div>`;
    return;
  }

  reminders.forEach(rem => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-3 text-sm mb-2 cursor-pointer hover:bg-slate-700';
    item.innerHTML = `
      <div class="flex-1">
        <div class="font-medium text-amber-300">${rem.message}</div>
        <div class="text-xs text-slate-500 mt-1">${rem.reminder_time || 'No time set'}</div>
      </div>
      <button 
        onclick="deleteReminder(${rem.id}); event.stopPropagation();"
        class="ml-4 px-3 py-1 text-red-400 hover:bg-red-900/50 rounded-xl text-xl leading-none">×</button>
    `;
    
    // Add click handler for the entire item (except delete button)
    item.querySelector('.flex-1').addEventListener('click', () => {
      editReminder(rem);
    });
    
    container.appendChild(item);
  });
}

function renderTasks(tasks) {
  const container = document.getElementById('modal-tasks-list');
  if (!container) return;
  
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-sm italic p-2">No tasks for this day.</div>`;
    return;
  }

  tasks.forEach(task => {
    const statusColorClass = getStatusColor(task.status);

    let timeInfo = '';
    if (task.start_datetime || task.end_datetime) {
      const start = task.start_datetime ? task.start_datetime.replace('T', ' ') : '';
      const end = task.end_datetime ? task.end_datetime.replace('T', ' ') : '';
      timeInfo = `<div class="text-xs text-slate-500 mt-1">${start} ${end ? '→ ' + end : ''}</div>`;
    }

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-3 text-sm mb-2 cursor-pointer hover:bg-slate-700';
    item.innerHTML = `
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div class="font-medium ${statusColorClass}">${task.subject}</div>
          <span class="${statusColorClass} text-xs font-medium px-3 py-0.5 rounded-full bg-slate-700">${task.status}</span>
        </div>
        ${task.description ? `<div class="text-xs text-slate-400 mt-1 line-clamp-1">${task.description}</div>` : ''}
        ${timeInfo}
      </div>
      <button 
        onclick="deleteTask(${task.id}); event.stopPropagation();"
        class="ml-4 px-3 py-1 text-red-400 hover:bg-red-900/50 rounded-xl text-xl leading-none">×</button>
    `;
    
    // Add click handler for the entire item (except delete button)
    item.querySelector('.flex-1').addEventListener('click', () => {
      editTask(task);
    });
    
    container.appendChild(item);
  });
}

async function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  try {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    if (currentDate) await loadModalData(currentDate);
    loadCalendar(); // Refresh calendar
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
    loadCalendar(); // Refresh calendar
  } catch (e) {
    console.error(e);
    alert('Failed to delete task');
  }
}

// Edit Reminder Functions
function editReminder(reminder) {
  const subjectInput = document.getElementById('reminder-subject-input');
  const descInput = document.getElementById('reminder-desc-input');
  const timeInput = document.getElementById('reminder-time-input');
  
  if (subjectInput && descInput && timeInput) {
    // Extract subject and description from message
    let subject = reminder.message;
    let description = '';
    
    if (reminder.message.includes(' - ')) {
      const parts = reminder.message.split(' - ');
      subject = parts[0];
      description = parts.slice(1).join(' - '); // In case description has dashes
    }
    
    subjectInput.value = subject;
    descInput.value = description;
    timeInput.value = reminder.reminder_time || '';
    
    // Store the ID for updating
    const form = document.getElementById('reminder-form');
    if (form) {
      form.setAttribute('data-id', reminder.id);
      form.setAttribute('data-mode', 'edit');
    }
    
    showReminderForm();
  }
}

function extractSubject(message) {
  if (message.includes(' - ')) {
    return message.split(' - ')[0];
  }
  return message;
}

function extractDescription(message) {
  if (message.includes(' - ')) {
    return message.split(' - ')[1];
  }
  return '';
}

// Edit Task Functions
function editTask(task) {
  const subjectInput = document.getElementById('task-subject-input');
  const descInput = document.getElementById('task-desc-textarea');
  const startInput = document.getElementById('task-start-input');
  const endInput = document.getElementById('task-end-input');
  const statusSelect = document.getElementById('task-status-select');
  
  if (subjectInput && descInput && startInput && endInput && statusSelect) {
    subjectInput.value = task.subject || '';
    descInput.value = task.description || '';
    startInput.value = task.start_datetime || '';
    endInput.value = task.end_datetime || '';
    statusSelect.value = task.status || 'Not Started';
    
    // Store the ID for updating
    const form = document.getElementById('task-form');
    if (form) {
      form.setAttribute('data-id', task.id);
      form.setAttribute('data-mode', 'edit');
    }
    
    showTaskForm();
  }
}

async function openNoteModal(dateStr) {
  currentDate = dateStr;
  const dateObj = parseDate(dateStr);
  
  const dateDisplay = document.getElementById('modal-date-display');
  if (dateDisplay) {
    dateDisplay.textContent = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  const modal = document.getElementById('note-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }

  const container = document.getElementById('editor-container');
  if (container) {
    container.innerHTML = '<div id="editor" class="bg-white text-slate-900 rounded-2xl shadow-inner flex-1"></div>';
  }

  // Extended toolbar with horizontal line tool
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['link', 'image', 'video'],
        ['clean'],
        ['divider'] // Horizontal line tool
      ]
    },
    placeholder: 'Write your notes here...'
  });

  // Add custom handler for divider button
  const toolbar = quill.getModule('toolbar');
  toolbar.addHandler('divider', function() {
    const range = quill.getSelection();
    if (range) {
      quill.insertEmbed(range.index, 'divider', true, 'user');
      quill.setSelection(range.index + 1, 0);
    }
  });

  // Style the divider button
  setTimeout(() => {
    const dividerButton = document.querySelector('.ql-divider');
    if (dividerButton) {
      dividerButton.innerHTML = '<i>―</i>'; // Horizontal line symbol
      dividerButton.title = 'Insert Horizontal Line';
      dividerButton.style.fontWeight = 'bold';
    }
  }, 100);

  try {
    const res = await fetch(`/api/notes/${dateStr}`);
    const data = await res.json();
    if (data) quill.setContents(data);
  } catch (e) {
    console.log('No existing note found for this date');
  }

  await loadModalData(dateStr);
}

function closeModal() {
  const modal = document.getElementById('note-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  
  if (quill && currentDate) {
    const content = quill.getContents();
    fetch(`/api/notes/${currentDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).then(() => {
      loadCalendar(); // Refresh calendar to update backgrounds
    }).catch((error) => {
      console.error('Error saving note:', error);
    });
  }
  
  quill = null;
  currentDate = null;
}

// Reminder Form Functions
function showReminderForm() {
  const subjectInput = document.getElementById('reminder-subject-input');
  const descInput = document.getElementById('reminder-desc-input');
  const timeInput = document.getElementById('reminder-time-input');
  const form = document.getElementById('reminder-form');
  
  if (subjectInput && descInput && timeInput && form) {
    // Only reset form fields if creating new (not editing)
    if (form.getAttribute('data-mode') !== 'edit') {
      subjectInput.value = '';
      descInput.value = '';
      timeInput.value = '';
      form.removeAttribute('data-id');
    }
    
    form.classList.remove('hidden');
  }
}

function hideReminderForm() {
  const form = document.getElementById('reminder-form');
  if (form) {
    form.classList.add('hidden');
    // Reset form mode
    form.removeAttribute('data-id');
    form.removeAttribute('data-mode');
  }
}

async function saveReminder() {
  const subjectInput = document.getElementById('reminder-subject-input');
  const descInput = document.getElementById('reminder-desc-input');
  const timeInput = document.getElementById('reminder-time-input');
  const form = document.getElementById('reminder-form');
  
  if (!subjectInput || !descInput || !timeInput || !form) {
    console.error('Form elements not found');
    return;
  }
  
  const subject = subjectInput.value.trim();
  const desc = descInput.value.trim();
  const time = timeInput.value;
  const mode = form.getAttribute('data-mode');
  const id = form.getAttribute('data-id');

  if (!subject || !time) {
    alert("Subject and time are required");
    return;
  }

  const message = desc ? `${subject} - ${desc}` : subject;
  console.log('Saving reminder:', { mode, id, currentDate, time, message });

  try {
    let response;
    if (mode === 'edit' && id) {
      // Update existing reminder
      console.log('Updating reminder with ID:', id);
      response = await fetch(`/api/reminders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          note_date: currentDate, 
          reminder_time: time, 
          message 
        })
      });
    } else {
      // Create new reminder
      console.log('Creating new reminder');
      response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          note_date: currentDate, 
          reminder_time: time, 
          message 
        })
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    hideReminderForm();
    if (currentDate) {
      await loadModalData(currentDate);
      loadCalendar(); // Refresh calendar to update ticker
    }
  } catch (error) {
    console.error('Error saving reminder:', error);
    alert('Failed to save reminder: ' + error.message);
  }
}

// Task Form Functions
function showTaskForm() {
  const subjectInput = document.getElementById('task-subject-input');
  const descInput = document.getElementById('task-desc-textarea');
  const startInput = document.getElementById('task-start-input');
  const endInput = document.getElementById('task-end-input');
  const statusSelect = document.getElementById('task-status-select');
  const form = document.getElementById('task-form');
  
  if (subjectInput && descInput && startInput && endInput && statusSelect && form) {
    // Only reset form fields if creating new (not editing)
    if (form.getAttribute('data-mode') !== 'edit') {
      subjectInput.value = '';
      descInput.value = '';
      startInput.value = '';
      endInput.value = '';
      statusSelect.value = 'Not Started';
      form.removeAttribute('data-id');
    }
    
    form.classList.remove('hidden');
  }
}

function hideTaskForm() {
  const form = document.getElementById('task-form');
  if (form) {
    form.classList.add('hidden');
    // Reset form mode
    form.removeAttribute('data-id');
    form.removeAttribute('data-mode');
  }
}

async function saveTask() {
  const subjectInput = document.getElementById('task-subject-input');
  const descInput = document.getElementById('task-desc-textarea');
  const startInput = document.getElementById('task-start-input');
  const endInput = document.getElementById('task-end-input');
  const statusSelect = document.getElementById('task-status-select');
  const form = document.getElementById('task-form');
  
  if (!subjectInput || !descInput || !startInput || !endInput || !statusSelect || !form) {
    console.error('Form elements not found');
    return;
  }
  
  const subject = subjectInput.value.trim();
  const desc = descInput.value.trim();
  const start = startInput.value;
  const end = endInput.value;
  const status = statusSelect.value;
  const mode = form.getAttribute('data-mode');
  const id = form.getAttribute('data-id');

  if (!subject) {
    alert("Subject is required");
    return;
  }

  console.log('Saving task:', { mode, id, currentDate, subject, desc, start, end, status });

  try {
    let response;
    if (mode === 'edit' && id) {
      // Update existing task
      console.log('Updating task with ID:', id);
      response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
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
    } else {
      // Create new task
      console.log('Creating new task');
      response = await fetch('/api/tasks', {
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
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    hideTaskForm();
    if (currentDate) {
      await loadModalData(currentDate);
      loadCalendar(); // Refresh calendar to update ticker
    }
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Failed to save task: ' + error.message);
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Add ticker container if it doesn't exist
  const header = document.querySelector('.flex.items-center.justify-between.mb-8');
  if (header && !document.getElementById('ticker-wrapper')) {
    const tickerWrapper = document.createElement('div');
    tickerWrapper.id = 'ticker-wrapper';
    tickerWrapper.className = 'w-full h-8 overflow-hidden relative bg-slate-800 rounded-lg mb-4';
    tickerWrapper.innerHTML = `
      <div id="ticker-content" class="absolute whitespace-nowrap flex items-center h-full px-2"></div>
    `;
    header.parentNode.insertBefore(tickerWrapper, header.nextSibling);
  }
  
  // Load calendar data
  loadCalendar();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (tickerAnimation) {
    cancelAnimationFrame(tickerAnimation);
  }
});


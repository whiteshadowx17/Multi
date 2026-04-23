let quill = null;
let currentDate = null;
let displayStart = new Date();
let tickerAnimation = null;

displayStart.setDate(displayStart.getDate() - 10);

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

// Function to truncate text with ellipsis
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '…';
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
      const preview = getPreview(note);
      
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
      cell.className = `calendar-cell border border-slate-700 rounded-3xl p-0 flex flex-col cursor-pointer hover:ring-2 hover:ring-blue-400 h-full min-h-[200px] relative overflow-hidden ${isToday ? 'ring-2 ring-blue-400' : ''}`;
      
      // Apply background with opacity if image exists
      if (bgImage) {
        cell.style.background = `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), ${bgStyle}`;
      } else {
        cell.classList.add('bg-slate-900');
      }

      // Top half - Note preview
      let topHtml = `<div class="relative z-10 p-6 h-1/2">`;
      topHtml += `<div class="text-4xl font-semibold mb-4 ${isToday ? 'text-blue-400' : 'text-slate-100'}">${date.getDate()}</div>`;
      
      if (preview.text) {
        topHtml += `<div class="flex-1 text-sm text-slate-200 line-clamp-3">${preview.text}</div>`;
      }
      topHtml += `</div>`;

      // Bottom half - Notifications area
      let bottomHtml = `<div class="relative z-10 h-1/2 border-t border-slate-700 flex">`;
      
      // Left quarter - Reminders
      bottomHtml += `<div class="w-1/2 p-3 border-r border-slate-700">`;
      if (dayReminders.length > 0) {
        // Show first reminder normally
        const firstReminder = dayReminders[0];
        bottomHtml += `<div class="flex items-center gap-2 text-amber-400 text-xs mb-1">
          <span class="text-lg">🔔</span>
          <span>${truncateText(firstReminder.message, 15)}</span>
        </div>`;
        
        // Show additional reminders as grouped bubble if needed
        if (dayReminders.length > 1) {
          bottomHtml += `<div class="flex items-center gap-1 text-amber-400 text-xs mt-1">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-900/50 text-xs">+${dayReminders.length - 1}</span>
          </div>`;
        }
      } else {
        bottomHtml += `<div class="text-slate-500 text-xs italic">No reminders</div>`;
      }
      bottomHtml += `</div>`;

      // Right quarter - Tasks
      bottomHtml += `<div class="w-1/2 p-3">`;
      if (dayTasks.length > 0) {
        // Show first task normally with status
        const firstTask = dayTasks[0];
        const statusColorClass = getStatusColor(firstTask.status);
        bottomHtml += `<div class="flex items-center gap-2 ${statusColorClass} text-xs mb-1">
          <span class="text-lg">📋</span>
          <span>${truncateText(firstTask.subject, 12)}</span>
          <span class="text-xs">[${firstTask.status}]</span>
        </div>`;
        
        // Show additional tasks as grouped bubble if needed
        if (dayTasks.length > 1) {
          bottomHtml += `<div class="flex items-center gap-1 ${statusColorClass} text-xs mt-1">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-xs">+${dayTasks.length - 1}</span>
          </div>`;
        }
      } else {
        bottomHtml += `<div class="text-slate-500 text-xs italic">No tasks</div>`;
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
  if (!container) return;
  
  container.innerHTML = '';

  if (reminders.length === 0) {
    container.innerHTML = `<div class="text-slate-400 text-sm italic p-2">No reminders for this day.</div>`;
    return;
  }

  reminders.forEach(rem => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-3 text-sm mb-2 cursor-pointer hover:bg-slate-700';
    item.onclick = () => editReminder(rem);
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
    item.onclick = () => editTask(task);
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
    if (currentDate) loadModalData(currentDate);
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
    if (currentDate) loadModalData(currentDate);
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
    subjectInput.value = extractSubject(reminder.message);
    descInput.value = extractDescription(reminder.message);
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
    subjectInput.value = task.subject;
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
    subjectInput.value = '';
    descInput.value = '';
    timeInput.value = '';
    
    // Reset form mode to create
    form.removeAttribute('data-id');
    form.setAttribute('data-mode', 'create');
    form.classList.remove('hidden');
  }
}

function hideReminderForm() {
  const form = document.getElementById('reminder-form');
  if (form) {
    form.classList.add('hidden');
  }
}

async function saveReminder() {
  const subjectInput = document.getElementById('reminder-subject-input');
  const descInput = document.getElementById('reminder-desc-input');
  const timeInput = document.getElementById('reminder-time-input');
  const form = document.getElementById('reminder-form');
  
  if (!subjectInput || !descInput || !timeInput || !form) return;
  
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

  try {
    if (mode === 'edit' && id) {
      // Update existing reminder
      await fetch(`/api/reminders/${id}`, {
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
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          note_date: currentDate, 
          reminder_time: time, 
          message 
        })
      });
    }

    hideReminderForm();
    if (currentDate) {
      await loadModalData(currentDate);
      loadCalendar(); // Refresh calendar to update ticker
    }
  } catch (error) {
    console.error('Error saving reminder:', error);
    alert('Failed to save reminder');
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
    subjectInput.value = '';
    descInput.value = '';
    startInput.value = '';
    endInput.value = '';
    statusSelect.value = 'Not Started';
    
    // Reset form mode to create
    form.removeAttribute('data-id');
    form.setAttribute('data-mode', 'create');
    form.classList.remove('hidden');
  }
}

function hideTaskForm() {
  const form = document.getElementById('task-form');
  if (form) {
    form.classList.add('hidden');
  }
}

async function saveTask() {
  const subjectInput = document.getElementById('task-subject-input');
  const descInput = document.getElementById('task-desc-textarea');
  const startInput = document.getElementById('task-start-input');
  const endInput = document.getElementById('task-end-input');
  const statusSelect = document.getElementById('task-status-select');
  const form = document.getElementById('task-form');
  
  if (!subjectInput || !descInput || !startInput || !endInput || !statusSelect || !form) return;
  
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

  try {
    if (mode === 'edit' && id) {
      // Update existing task
      await fetch(`/api/tasks/${id}`, {
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
    }

    hideTaskForm();
    if (currentDate) {
      await loadModalData(currentDate);
      loadCalendar(); // Refresh calendar to update ticker
    }
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Failed to save task');
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

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const multer = require('multer');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = 'IMG_' + Date.now() + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Security Middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// Serve static files with caching
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));

// Database setup with error handling
let db;
try {
  // Ensure database directory exists
  const dbDir = path.dirname(process.env.DATABASE_PATH || './data/notes.db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(process.env.DATABASE_PATH || './data/notes.db', {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });
  
  // Initialize database tables
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'blue',
      created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calendar_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT,
      updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(calendar_id, date),
      FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calendar_id INTEGER NOT NULL,
      note_date TEXT,
      reminder_time TEXT,
      message TEXT,
      created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calendar_id INTEGER NOT NULL,
      note_date TEXT,
      subject TEXT,
      description TEXT,
      start_datetime TEXT,
      end_datetime TEXT,
      status TEXT DEFAULT 'Not Started',
      created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
    );
  `);

  // Ensure at least one default calendar exists
  const existingCalendar = db.prepare('SELECT id FROM calendars LIMIT 1').get();
  if (!existingCalendar) {
    db.prepare('INSERT INTO calendars (name, color) VALUES (?, ?)').run('Default', 'blue');
    console.log('✅ Default calendar created');
  }
  
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});


// =========================
// 📌 CALENDARS API
// =========================

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});


// Get all calendars
app.get('/api/calendars', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM calendars ORDER BY id ASC').all();
    res.json(rows);
  } catch (error) {
    console.error('Get calendars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create calendar
app.post('/api/calendars', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare('INSERT INTO calendars (name, color) VALUES (?, ?)').run(name, color || 'blue');
    const calendar = db.prepare('SELECT * FROM calendars WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(calendar);
  } catch (error) {
    console.error('Create calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update calendar
app.put('/api/calendars/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare('UPDATE calendars SET name = ?, color = ? WHERE id = ?')
      .run(name, color || 'blue', id);

    if (result.changes === 0) return res.status(404).json({ error: 'Calendar not found' });

    const calendar = db.prepare('SELECT * FROM calendars WHERE id = ?').get(id);
    res.json(calendar);
  } catch (error) {
    console.error('Update calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete calendar
app.delete('/api/calendars/:id', (req, res) => {
  try {
    const { id } = req.params;

    const count = db.prepare('SELECT COUNT(*) AS c FROM calendars').get().c;
    if (count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining calendar' });
    }

    const result = db.prepare('DELETE FROM calendars WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Calendar not found' });

    res.sendStatus(200);
  } catch (error) {
    console.error('Delete calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =========================
// 📌 NOTES API
// =========================

app.get('/api/calendar', (req, res) => {
  try {
    const { start, end, calendarId } = req.query;

    if (!start || !end) return res.status(400).json({ error: 'Start and end dates required' });
    if (!calendarId) return res.status(400).json({ error: 'calendarId required' });

    const rows = db.prepare(`
      SELECT date, content 
      FROM notes 
      WHERE calendar_id = ? AND date BETWEEN ? AND ?
    `).all(calendarId, start, end);

    const map = {};
    rows.forEach(row => {
      try { map[row.date] = JSON.parse(row.content); }
      catch { map[row.date] = null; }
    });

    res.json(map);
  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    const { calendarId } = req.query;

    if (!calendarId) return res.status(400).json({ error: 'calendarId required' });

    const row = db.prepare(`
      SELECT content FROM notes 
      WHERE date = ? AND calendar_id = ?
    `).get(date, calendarId);

    res.json(row ? JSON.parse(row.content) : null);
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    const { calendarId, content } = req.body;

    if (!calendarId) return res.status(400).json({ error: 'calendarId required' });

    db.prepare(`
      INSERT INTO notes (calendar_id, date, content)
      VALUES (?, ?, ?)
      ON CONFLICT(calendar_id, date) DO UPDATE SET 
        content = excluded.content,
        updated = CURRENT_TIMESTAMP
    `).run(calendarId, date, JSON.stringify(content));

    res.sendStatus(200);
  } catch (error) {
    console.error('Save note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =========================
// 📌 REMINDERS API
// =========================

app.get('/api/reminders', (req, res) => {
  try {
    const { calendarId } = req.query;
    if (!calendarId) return res.status(400).json({ error: 'calendarId required' });

    const rows = db.prepare(`
      SELECT * FROM reminders 
      WHERE calendar_id = ?
      ORDER BY reminder_time ASC
    `).all(calendarId);

    res.json(rows);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/reminders', (req, res) => {
  try {
    const { calendar_id, note_date, reminder_time, message } = req.body;

    if (!calendar_id || !note_date || !reminder_time || !message)
      return res.status(400).json({ error: 'Missing required fields' });

    db.prepare(`
      INSERT INTO reminders (calendar_id, note_date, reminder_time, message)
      VALUES (?, ?, ?, ?)
    `).run(calendar_id, note_date, reminder_time, message);

    res.sendStatus(200);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { calendar_id, note_date, reminder_time, message } = req.body;

    if (!calendar_id || !note_date || !reminder_time || !message)
      return res.status(400).json({ error: 'Missing required fields' });

    const result = db.prepare(`
      UPDATE reminders 
      SET calendar_id = ?, note_date = ?, reminder_time = ?, message = ?
      WHERE id = ?
    `).run(calendar_id, note_date, reminder_time, message, id);

    if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found' });

    res.sendStatus(200);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found' });

    res.sendStatus(200);
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =========================
// 📌 TASKS API
// =========================

app.get('/api/tasks', (req, res) => {
  try {
    const { calendarId } = req.query;
    if (!calendarId) return res.status(400).json({ error: 'calendarId required' });

    const rows = db.prepare(`
      SELECT * FROM tasks 
      WHERE calendar_id = ?
      ORDER BY start_datetime ASC
    `).all(calendarId);

    res.json(rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const { calendar_id, note_date, subject, description, start_datetime, end_datetime, status } = req.body;

    if (!calendar_id || !note_date || !subject)
      return res.status(400).json({ error: 'Missing required fields' });

    db.prepare(`
      INSERT INTO tasks (calendar_id, note_date, subject, description, start_datetime, end_datetime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      calendar_id,
      note_date,
      subject,
      description || '',
      start_datetime || '',
      end_datetime || '',
      status || 'Not Started'
    );

    res.sendStatus(200);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { calendar_id, note_date, subject, description, start_datetime, end_datetime, status } = req.body;

    if (!calendar_id || !note_date || !subject)
      return res.status(400).json({ error: 'Missing required fields' });

    const result = db.prepare(`
      UPDATE tasks 
      SET calendar_id = ?, note_date = ?, subject = ?, description = ?, start_datetime = ?, end_datetime = ?, status = ?
      WHERE id = ?
    `).run(
      calendar_id,
      note_date,
      subject,
      description || '',
      start_datetime || '',
      end_datetime || '',
      status || 'Not Started',
      id
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });

    res.sendStatus(200);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });

    res.sendStatus(200);
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =========================
// SPA FALLBACK
// =========================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// =========================
// Graceful shutdown
// =========================

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (db) {
    db.close();
    console.log('✅ Database closed');
  }
  process.exit(0);
});

// Error handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 MultiFlow Tracker running at http://${HOST}:${PORT}`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

module.exports = app;

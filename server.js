const express = require('express');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

const db = new Database('notes.db');

// Drop and recreate tables to fix schema
db.exec(`DROP TABLE IF EXISTS tasks;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    date TEXT PRIMARY KEY,
    content TEXT,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_date TEXT,
    reminder_time TEXT,
    message TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_date TEXT,
    subject TEXT,
    description TEXT,
    start_datetime TEXT,
    end_datetime TEXT,
    status TEXT DEFAULT 'Not Started',
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

app.get('/api/calendar', (req, res) => {
  const { start, end } = req.query;
  const stmt = db.prepare('SELECT date, content FROM notes WHERE date BETWEEN ? AND ?');
  const rows = stmt.all(start, end);
  const map = {};
  rows.forEach(row => {
    try { map[row.date] = JSON.parse(row.content); } catch(e) { map[row.date] = null; }
  });
  res.json(map);
});

app.get('/api/notes/:date', (req, res) => {
  const row = db.prepare('SELECT content FROM notes WHERE date = ?').get(req.params.date);
  res.json(row ? JSON.parse(row.content) : null);
});

app.post('/api/notes/:date', (req, res) => {
  const content = req.body.content || req.body;
  db.prepare('INSERT OR REPLACE INTO notes (date, content) VALUES (?, ?)').run(
    req.params.date, JSON.stringify(content)
  );
  res.sendStatus(200);
});

// Reminders
app.get('/api/reminders', (req, res) => {
  const rows = db.prepare('SELECT * FROM reminders ORDER BY reminder_time ASC').all();
  res.json(rows);
});

app.post('/api/reminders', (req, res) => {
  const { note_date, reminder_time, message } = req.body;
  db.prepare('INSERT INTO reminders (note_date, reminder_time, message) VALUES (?, ?, ?)').run(
    note_date, reminder_time, message
  );
  res.sendStatus(200);
});

app.delete('/api/reminders/:id', (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.sendStatus(200);
});

// Tasks
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY start_datetime ASC').all();
  res.json(rows);
});

app.post('/api/tasks', (req, res) => {
  const { note_date, subject, description, start_datetime, end_datetime, status } = req.body;
  db.prepare(`
    INSERT INTO tasks (note_date, subject, description, start_datetime, end_datetime, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    note_date, 
    subject, 
    description || '', 
    start_datetime || '', 
    end_datetime || '', 
    status || 'Not Started'
  );
  res.sendStatus(200);
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('✅ MultiFlow Tracker running at http://localhost:3000');
});
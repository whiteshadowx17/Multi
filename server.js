const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// Serve static files with caching
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));

// Rate limiting for API endpoints
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);

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
  
  console.log('✅ Database initialized successfully');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    // Test database connection
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// API Routes with error handling
app.get('/api/calendar', (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }
    
    const stmt = db.prepare('SELECT date, content FROM notes WHERE date BETWEEN ? AND ?');
    const rows = stmt.all(start, end);
    const map = {};
    rows.forEach(row => {
      try { 
        map[row.date] = JSON.parse(row.content); 
      } catch(e) { 
        map[row.date] = null; 
      }
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
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const row = db.prepare('SELECT content FROM notes WHERE date = ?').get(date);
    res.json(row ? JSON.parse(row.content) : null);
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notes/:date', (req, res) => {
  try {
    const { date } = req.params;
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const content = req.body.content || req.body;
    db.prepare('INSERT OR REPLACE INTO notes (date, content) VALUES (?, ?)').run(
      date, JSON.stringify(content)
    );
    res.sendStatus(200);
  } catch (error) {
    console.error('Save note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reminders API
app.get('/api/reminders', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM reminders ORDER BY reminder_time ASC').all();
    res.json(rows);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/reminders', (req, res) => {
  try {
    const { note_date, reminder_time, message } = req.body;
    
    // Validation
    if (!note_date || !reminder_time || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!note_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    db.prepare('INSERT INTO reminders (note_date, reminder_time, message) VALUES (?, ?, ?)').run(
      note_date, reminder_time, message
    );
    res.sendStatus(200);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { note_date, reminder_time, message } = req.body;
    
    // Validation
    if (!note_date || !reminder_time || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!note_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const result = db.prepare('UPDATE reminders SET note_date = ?, reminder_time = ?, message = ? WHERE id = ?').run(
      note_date, reminder_time, message, id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    
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
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tasks API
app.get('/api/tasks', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY start_datetime ASC').all();
    res.json(rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const { note_date, subject, description, start_datetime, end_datetime, status } = req.body;
    
    // Validation
    if (!note_date || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!note_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
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
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { note_date, subject, description, start_datetime, end_datetime, status } = req.body;
    
    // Validation
    if (!note_date || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!note_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const result = db.prepare(`
      UPDATE tasks 
      SET note_date = ?, subject = ?, description = ?, start_datetime = ?, end_datetime = ?, status = ?
      WHERE id = ?
    `).run(
      note_date, 
      subject, 
      description || '', 
      start_datetime || '', 
      end_datetime || '', 
      status || 'Not Started',
      id
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
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
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (db) {
    db.close();
    console.log('✅ Database closed');
  }
  process.exit(0);
});

// Error handling middleware
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

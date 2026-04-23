# MultiFlow Tracker

A comprehensive task management and scheduling application with calendar view, note-taking, reminders, and task tracking capabilities.

## Features

### 📅 Calendar View
- Interactive 3-week calendar display
- Day-by-day organization with visual previews
- Background images from notes displayed at 30% opacity
- Today highlighting for easy navigation

### ✍️ Note Taking
- Rich text editor with Quill.js integration
- Support for text formatting, lists, links, and images
- Automatic saving of notes per calendar day
- Image backgrounds from pasted/uploaded images

### 🔔 Reminders & Alerts
- Create reminders with custom times and messages
- Visual notifications in calendar day boxes
- Bell icon indicators for upcoming alerts
- Edit and delete existing reminders

### 📋 Task Management
- Task orders with status tracking (Not Started, Working, Completed)
- Color-coded status indicators (Red = Not Started, Yellow = Working, Green = Completed)
- Start/end datetime tracking
- Grouped display for multiple tasks per day

### 📰 Information Ticker
- Continuous scrolling ticker showing upcoming reminders and tasks
- Displays next 7 days of scheduled items
- Real-time updates when items are added/removed

### 🖼️ Visual Design
- Dark theme with slate/blue color scheme
- Responsive layout for all device sizes
- Semi-transparent overlays for readability
- Intuitive drag-and-drop interface

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd multiflow-tracker
```

2. Install dependencies:
```bash
npm install express better-sqlite3
```

3. Run the application:
```bash
node server.js
```

4. Access the application at `http://localhost:3000`

## Usage

### Navigating the Calendar
- Use the ← → arrows to navigate weeks
- Click "Today" to return to current week
- Click on any day to open the day details modal

### Creating Notes
- Click on a day to open the note editor
- Use the rich text toolbar to format content
- Paste or upload images directly into notes
- Notes are automatically saved when closing the modal

### Adding Reminders
- In the day modal, click "+" next to "Reminders"
- Enter subject, optional description, and time
- Save to create the reminder
- Click on existing reminders to edit them

### Creating Tasks
- In the day modal, click "+" next to "Task Orders"
- Enter subject, description, start/end times, and status
- Save to create the task
- Click on existing tasks to edit them

### Viewing Notifications
- Calendar day boxes show:
  - Top half: Note preview text
  - Bottom half: Notification area
    - Left quarter: Reminders with bell icons
    - Right quarter: Tasks with clipboard icons
- Multiple items are grouped with "+N" indicators

## Technical Details

### Backend (server.js)
- Node.js with Express framework
- SQLite database for data persistence
- RESTful API endpoints for all operations
- Automatic database initialization

### Frontend (index.html/script.js)
- Tailwind CSS for styling
- Quill.js rich text editor
- Pure JavaScript with modern ES6 features
- Responsive design principles

### Database Schema
```sql
-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  date TEXT PRIMARY KEY,
  content TEXT,
  updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_date TEXT,
  reminder_time TEXT,
  message TEXT,
  created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
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
```

## API Endpoints

### Notes
- `GET /api/calendar?start=:date&end=:date` - Get notes for date range
- `GET /api/notes/:date` - Get note for specific date
- `POST /api/notes/:date` - Save note for specific date

### Reminders
- `GET /api/reminders` - Get all reminders
- `POST /api/reminders` - Create new reminder
- `PUT /api/reminders/:id` - Update existing reminder
- `DELETE /api/reminders/:id` - Delete reminder

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update existing task
- `DELETE /api/tasks/:id` - Delete task

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design works on mobile devices
- JavaScript required for full functionality

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Author
Created as a personal productivity tool with modern web technologies.

## Changelog
### Latest Features
- Image backgrounds with 30% opacity in day boxes
- Continuous scrolling information ticker
- Color-coded task status indicators
- Enhanced notification system with grouped displays
- Full CRUD operations for reminders and tasks
- Improved UI/UX with better visual hierarchy

---

*Built with Node.js, Express, SQLite, Tailwind CSS, and Quill.js*
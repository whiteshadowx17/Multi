# MultiFlow Tracker Version 1

A beautiful, minimal daily tracker and rich note-taking app built with Node.js.

Combine your **calendar**, **rich notes**, **to-do lists**, **project management**, and **reminders** all in one place.

## Features

- Clean 3-row (21-day) calendar view with current day highlighted
- Click any day to open a powerful rich text editor (like Google Docs)
- Full formatting toolbar: headings, fonts, colors, highlights, lists, code blocks, links, etc.
- Paste or insert images directly (images are embedded)
- Auto-save as you type
- Visual preview in calendar cells (text snippet + image thumbnail with transparency support)
- Built-in reminder system with browser notifications
- Persistent storage using SQLite (`notes.db`)
- Modern, minimal dark theme
- Fully local — no account required

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Tailwind CSS + Quill.js (rich text editor)
- **Database**: SQLite (via better-sqlite3)
- **Rich Editor**: Quill 2.0

## How to Run

1. Make sure you have Node.js installed.
2. Install dependencies:
   
   ```bash
   npm install
   ```

* Start the server:
  Bash
  
  ```
  node server.js
  ```
* Open your browser and go to:
  text
  
  ```
  http://localhost:3000
  ```

## Project Structure

MultiFlow-Tracker/
├── server.js
├── notes.db                 ← Your data (do NOT commit this)
├── public/
│   ├── index.html
│   └── script.js
├── package.json
├── .gitignore
└── README.md**

## Git Ignore

Make sure you have a .gitignore file that includes:

node_modules/
notes.db
.env

## Future Improvements (Ideas)

Export notes as PDF or Markdown
Dark/Light mode toggle
Search across all days
Tags and categories
Mobile-responsive improvements
Cloud backup option (optional)

## License

Personal project — feel free to modify and use for yourself.


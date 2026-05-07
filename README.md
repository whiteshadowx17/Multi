# 🌿 LifeFlow — Multi‑Tracker Productivity Calendar

LifeFlow is a modern, theme‑driven productivity calendar that combines **daily notes**, **reminders**, **tasks**, and **image‑enhanced journaling** into one clean interface.
Designed for speed, clarity, and customization, LifeFlow gives you a 21‑day rolling view with rich‑text notes powered by Quill, backend‑stored images, and a polished UI.

---

## ✨ Features

### 🗓️ 21‑Day Rolling Calendar

- Smooth week navigation (Prev / Next / Today)
- Theme‑colored day boxes (Blue, Green, Amber, Purple, Rose, Emerald)
- Automatic “Today” highlighting
- Background image previews with **30% transparency**

### 📝 Rich Notes (Quill Editor)

- Full formatting toolbar
- Custom divider button
- Paste, drag‑drop, or upload images
- Images stored on backend (`/uploads/`)
- Notes saved per‑day, per‑calendar

### 🔔 Reminders

- Time‑based reminders
- Quick add / edit / delete
- Daily summary inside modal
- Upcoming reminders shown in ticker

### 📋 Tasks

- Status tracking (Not Started, Working, Completed)
- Optional start/end timestamps
- Daily task list with color‑coded statuses

### 🎨 Themes

Each calendar has its own theme:

- Blue
- Green
- Amber
- Purple
- Rose
- Emerald

Themes automatically update:

- Buttons
- Day box backgrounds
- Accent text
- Today highlight

### 📤 Export / 📥 Import (JSON)

- Export all calendars, notes, reminders, and tasks
- Import system ready for expansion

---

## 🖼️ Screenshots

### 📅 Calendar View (Blue Theme)


![](assets\20260505_125832_image.png)

![Calendar Blue Theme](screenshots/calendar-blue.png)

### 🌄 Day Box with Image Preview


![](assets\20260505_125853_image.png)

![Day Box Image Preview](screenshots/daybox-image.png)

### 📝 Note Editor with Image Upload


![](assets\20260505_125909_image.png)

![Note Editor](screenshots/editor.png)

### 📅 Calendar View Different Theme


![](assets\20260505_130017_image.png)

![Modal View](screenshots/modal.png)

*(Replace these images with your own screenshots in `/screenshots/`.)*

---

## 🚀 Installation

### 1. Install dependencies

```bash
npm install
2. Install Multer (for image uploads)
bash
npm install multer
3. Start the server
bash
node server.js
4. Open the app
Visit:

Code
http://localhost:3000
📁 Project Structure
Code
/public
  index.html
  script.js
  style.css
  /uploads        ← image uploads stored here
/server.js        ← Express backend
/database.db      ← SQLite database
🧩 Tech Stack
Frontend: HTML, TailwindCSS, JavaScript, Quill.js

Backend: Node.js, Express

Database: SQLite

Uploads: Multer (local file storage)

🛠️ Development Notes
Image uploads are stored in /public/uploads/

Day box backgrounds are theme‑controlled (theme.dayBg)

Background image previews use a pseudo‑layer at 30% opacity

Calendar data is scoped per‑calendar ID

📄 License
MIT License — free to use, modify, and build on.

💬 Author
Built with care by Jay.
```

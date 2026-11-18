# Work & Learn — Task Manager + Learning Tracker

React (Vite) app that uses your Google Sheet **"Sonali Work and Learning"** as its database through a Google Apps Script Web App.

- **Task** tab → tasks (calendar scheduling, daily status, priorities, notes, multi-day tasks)
- **Learning** tab → learning logs (category, hours, progress %, skill level, notes)

Everything you see — counts, today's list, both bar charts — is calculated from the rows in those two tabs. There is no sample data.

---

## 1. Set up the Google Apps Script (backend) — about 5 minutes

1. Open your Google Sheet (kept private — the link is not stored in this repo).
2. Menu **Extensions → Apps Script**.
3. Delete everything in `Code.gs`, paste your backend script (kept outside this repo), press **Save** (💾).
4. In the toolbar function dropdown choose **`setup`** → click **Run**.
   - Google asks for permission → *Review permissions* → choose your account → *Advanced* → *Go to project (unsafe)* → *Allow*. (This warning is normal for your own scripts.)
   - Go back to the sheet: both tabs now have a coral header row.
5. Click **Deploy → New deployment**.
   - Gear icon → **Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - **Deploy** → copy the **Web app URL** (it ends in `/exec`).

> **Changed Code.gs later?** Use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same. A brand-new deployment gives a new URL.

### Columns created automatically

| Task tab | Learning tab |
|---|---|
| ID, Title, Description, Start Date, End Date, Status, Priority, Notes, Daily Log, Created At, Updated At, Completed At | ID, Date, Category, Topic, Hours, Progress (%), Skill Level, Notes, Created At, Updated At |

- Dates are stored as `yyyy-MM-dd` text so they never shift between timezones.
- **Daily Log** stores each day's status/note for multi-day tasks, e.g. `{"2026-10-21":{"status":"Completed","note":"UI done"}}`.
- You can also type rows straight into the sheet — the app gives them an ID on the next sync and picks them up within a minute (or press the refresh icon in the sidebar).

### Secret key login (required)
The app opens with a login page. Apps Script checks the secret key on **every** request, so nobody can read or write the sheet without it.

- Set the key once in Apps Script: **Project Settings (⚙️) → Script Properties → Add property** → `SECRET_KEY` = your key (e.g. `Sonali`).
  Script Properties stay when you paste a new `Code.gs`, so you never set it again. (If it's not set, `SECRET_KEY_FALLBACK` in `Code.gs` is used.)
- 10 wrong keys in 10 minutes locks the API for 10 minutes. Run `clearLoginLock` in the editor to unlock early.
- Changing `SECRET_KEY` logs everyone out on their next sync.

---

## 2. Run the React app

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Open http://localhost:5173 → enter your secret key → **Log in**.

The `/exec` URL is set in **`src/lib/config.js`** (`EXEC_URL`). Redeploy with *Manage deployments → Edit → New version* and it never changes.
If you ever make a brand-new deployment, paste the new URL there — or set `VITE_GAS_URL` (in `.env` locally, or Netlify → Environment variables) to override it without touching code.

### Build / deploy

```bash
npm run build      # outputs to dist/
npm run preview    # test the production build locally
```

URLs are clean (`/tasks`, `/learning`, `/rough-notes`, `/settings`) — no `#`. On refresh the host must serve `index.html` for every path: `public/_redirects` does this on Netlify automatically. (Old `/#/tasks` links are redirected to `/tasks`.)

---

## 3. How it works

| Feature | Details |
|---|---|
| **Dashboard** | Appraisal countdown (calendar days left until **1 April 2027**, counted from 21 Oct 2026 = 162 days, live timer to the next drop), today's tasks with one-tap daily status, completed / pending / blocked / overdue counts, learning hours this week, upcoming tasks, recent learning. |
| **Task Progress chart** | Week view (completed vs pending per day, navigate weeks, click a day → calendar), Priority view, Status view. Click a legend item to hide a series. |
| **Learning Progress chart** | Hours, latest progress % or sessions per category (Frontend, Backend, Git, Server, Database, Shopify + any custom category). Ranges: this week / this month / all time. Click a bar → that category. |
| **Tasks** | Month calendar (Mon-first), multi-day tasks span across days, double-click or **+** to add on a date, day panel with daily status + day notes, list view grouped into Overdue / In progress / Upcoming / Completed, search and filters. |
| **Daily status rules** | One-day task: its status is the **Status** column, everywhere. Multi-day task: each day's status is kept in **Daily Log**; marking a day *Completed* logs that day, and the task becomes *Completed* only when you complete its last day (or set it in the edit form). Once a task is *Completed*, every day shows Completed. Changing the status in the edit form also updates today's entry, so the Dashboard, calendar, list and charts always agree. *Blocked* blocks the whole task. |
| **Learning** | Category cards (total hours, sessions, latest progress, skill-level meter), 14-day daily hours bars, streak, totals, searchable log grouped by date. New logs pre-fill the category's last skill level & progress. |
| **Sync** | Google Sheets is the only data source: every page reads one shared copy loaded from the sheet. Changes show instantly and are saved one at a time, in the order you made them (with an error message and a re-sync if Google rejects one). The app re-reads the sheet every 60 s, when you switch pages, when you return to the tab, and when you press the refresh icon. |

---

## Troubleshooting

| Message | Fix |
|---|---|
| *Apps Script returned a web page instead of data* | Deployment access isn't **Anyone**, or you used the `/dev` URL. Redeploy and use the `/exec` URL. |
| *Could not reach Google Apps Script* | Check the URL; make sure you're online; some ad-blockers block `script.google.com`. |
| *Wrong secret key* | The key must equal `SECRET_KEY` in Script Properties (or `SECRET_KEY_FALLBACK` in Code.gs). |
| *Too many wrong keys* | Wait 10 minutes, or run `clearLoginLock` in the Apps Script editor. |
| 404 on refresh (`/tasks`) | Your host must serve `index.html` for every path (`public/_redirects` handles Netlify). |
| Changes to Code.gs have no effect | Deploy a **new version** of the existing deployment (see above). |
| Wrong dates | Set the sheet's timezone in **File → Settings** to your local timezone (Asia/Kolkata). |

## Project structure

```
src/lib/config.js            EXEC_URL (Apps Script /exec URL)
src/lib/api.js               Web App client (sends the secret key)
src/context/AuthContext.jsx  Secret-key login / logout
src/lib/model.js             Task/learning normalisation + daily-status logic
src/lib/dates.js             Timezone-safe date helpers
src/context/DataContext.jsx  Global data store, optimistic CRUD, auto-sync
src/components/              Sidebar, Countdown, TaskChart, LearningChart, forms, UI kit
src/pages/                   Dashboard, Tasks, Learning, Settings
src/styles.css               Claymorphism design system
```

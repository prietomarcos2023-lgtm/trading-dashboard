# Mareblu Trading Journal

Personal trading journal SaaS — CRT / SMC framework  
Deployed on GitHub Pages · 100% client-side · Zero backend

---

## File structure

```
mareblu-journal/
├── index.html    ← Main app shell + all HTML
├── styles.css    ← All CSS / design system
├── script.js     ← All JS logic + Export/Import
└── README.md
```

---

## How to deploy on GitHub Pages

### Step 1 — Create the repo

1. Go to [github.com](https://github.com) → **New repository**
2. Name it: `mareblu-journal` (or anything you want)
3. Set to **Public** (required for free GitHub Pages)
4. Click **Create repository**

### Step 2 — Upload the files

**Option A — Browser upload (easiest):**
1. Open your repo on GitHub
2. Click **Add file → Upload files**
3. Drag and drop all 3 files: `index.html`, `styles.css`, `script.js`
4. Click **Commit changes**

**Option B — Git CLI:**
```bash
git init
git add index.html styles.css script.js
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/mareblu-journal.git
git push -u origin main
```

### Step 3 — Activate GitHub Pages

1. In your repo → **Settings** tab
2. Scroll to **Pages** (left sidebar)
3. Under **Source** → select branch: `main` / folder: `/ (root)`
4. Click **Save**
5. Wait ~60 seconds

### Step 4 — Access your journal

Your URL will be:
```
https://YOUR_USERNAME.github.io/mareblu-journal/
```

---

## Data & localStorage

All data is stored in your browser's `localStorage`.  
**It never leaves your device.** No server, no cloud, no account needed.

localStorage keys used:
- `mtj_accounts_v1` — account list
- `mtj_data_[id]` — trade data per account
- `mtj_cfg_[id]` — config per account
- `mtj_data` — legacy key (migrated automatically)
- `mtj_config` — legacy key (migrated automatically)

---

## Backup system (IMPORTANT)

### Export backup
Click **⬇ Backup** in the header.  
Downloads a `.json` file with ALL your data.  
Save this file somewhere safe (Google Drive, Dropbox, etc.)

### Import / Restore
Click **⬆ Restaurar** in the header.  
Select the `.json` backup file.  
All data will be restored and the app will reload.

**Recommended:** Export a backup at least once a week.  
localStorage can be cleared if you clear browser data.

---

## Updating the app

When you receive an updated version:

1. Upload the new files to GitHub (same repo)
2. GitHub Pages auto-deploys in ~60 seconds
3. Your data is safe — localStorage is not affected by app updates

---

## Mobile

Works on mobile browsers. On small screens (< 768px):
- Sidebar stacks vertically above the calendar
- Trade modal slides up from bottom
- Backup buttons hidden (use desktop for backups)

# KWE Recruit Machine — Frontend

A lightweight, static frontend for your Apps Script backend.

## Configure
- Backend URL is set in **index.html** (window.DEFAULT_API).

## Run locally
Just open `index.html` in a modern browser.

## Deploy to GitHub Pages
1. Create a repo and push these files.
2. Enable GitHub Pages (Settings → Pages → Source = main / root).
3. Visit the published URL.

## Features
- KPI tiles (calls `getStats`, falls back to client counts).
- Filters (search, status, listing type).
- Inline status update + notes save.
- Bulk update status.
- Import controls (process import, setup import).
- Re-run automations & fix dropdowns.
- CSV export of current view.

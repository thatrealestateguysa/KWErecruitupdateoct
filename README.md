# KWE Recruit Machine (Frontend)

Single-file frontend for Netlify/GitHub Pages. Dark **gray** background, KW red accents, and Apps Script backend writes via POST with GET fallback.

## Deploy
1. Unzip files.
2. Commit to a GitHub repo (root can be just these files).
3. Deploy with Netlify (drag-drop) or GitHub Pages.
4. If your Apps Script URL changes, edit `API` in `index.html`:
   ```js
   const API = "https://script.google.com/macros/s/AKfycbxpIrds0rcQ_FEKswi4ECdIEJshD_DHTay5ORVVbilu7SKXxbUe1yR42TjoVKspzDuHlg/exec";
   ```

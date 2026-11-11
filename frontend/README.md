# Platyform frontend

The supplied Platyform Archil HTML, runtime, images and workshop animation are the active frontend. Its design is preserved; company screens use the live backend through the Vite proxy.

From the repository root, with the backend running:

```powershell
npm.cmd ci --prefix frontend
npm.cmd run dev --prefix frontend
```

Open http://127.0.0.1:5173 on a PC. Every normal page load or refresh starts a fresh synthetic rehearsal. Click **Discover and build** to run discovery and automatically build three workflows concurrently in Archil. Refresh during active work resumes that work; refresh once it finishes to start over.

Previous rehearsal state is archived in SQLite and immutable Archil artifacts remain. Nothing is deployed to real business systems. Use `/?resume=1` to inspect the current rehearsal without clearing it. `/?mock=1` explicitly selects UI-only mock mode; the default uses the backend.

For unchanged company files, discovery reuses a previous validated result and says so in the UI. The build still generates and tests new software. Workshop testing and repair animations track each fork's stage, including testing before results arrive; loading animations never manufacture successful results.

`index.html` owns the supplied styles, templates and `text/x-dc` component. `public/support.js` is its supplied runtime and must remain a classic script; Vite's warning that it is not bundled is expected. Vite copies it and the image assets into `dist/`.

```powershell
npm.cmd run build --prefix frontend
npm.cmd run preview --prefix frontend
```

The backend must remain running for the built preview. Desktop verification against a completed live three-workflow rehearsal: `node backend/scripts/verify-product.mjs`. This check executes synthetic samples in Archil and records simulated releases.

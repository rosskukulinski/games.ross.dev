Create a new game called "$ARGUMENTS" in this monorepo. Follow these steps:

1. Create the directory `games/$ARGUMENTS/` with a Vite + React scaffold:
   - `package.json` with name, scripts (dev, build, preview), and dependencies (react, react-dom, vite, @vitejs/plugin-react)
   - `vite.config.js` with `base: './'` (REQUIRED for subdirectory serving)
   - `index.html` with root div and script module entry
   - `src/main.jsx` with React root render
   - `src/App.jsx` with a placeholder component showing the game name
   - `src/App.css` with basic styles
   - `CLAUDE.md` documenting the new game

2. Add the game to the `games` array in `scripts/build-all.js`

3. Add a new game card to `landing/index.html` inside the `.game-grid` div, following the existing card format

4. Create a placeholder SVG icon at `landing/icons/$ARGUMENTS.svg` using a gamepad icon with a unique background color

5. Run `cd games/$ARGUMENTS && npm install` to generate the lock file

After completing all steps, tell the user to run `npm run build` to verify the new game builds correctly.

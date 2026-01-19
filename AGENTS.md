# AGENTS

## Project summary
- Vue 3 + Vite single-page app for task management.
- JSON persistence via Vite middleware at `/api/storage` (see `vite.config.js`).

## Key files
- `src/stores/useTaskStore.js`: task state, recurrence, persistence.
- `src/services/jsonStorage.js`: client storage API.
- `src/views/`: task list views and Standup report.
- `data/`: local JSON storage (ignored by git).

## Common commands
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run stylelint`

## Local data notes
- Persistence uses JSON files in `data/` written by the Vite middleware.
- Backups are created automatically under `data/backups/` (see `vite.config.js`).

## Contribution reminders
- Avoid `git reset --hard` or reverting unrelated work.
- Keep edits ASCII unless the file already uses Unicode.
- Do not make git commits; the user will handle commits.

# Todo List App

A polished Vue 3 + Vite task manager focused on capturing, scheduling, and completing work without friction. Beyond everyday CRUD, it layers on recurring schedules, standup-ready summaries, real-time notifications, and JSON-backed persistence that survives browser refreshes.

## Highlights

- **Streamlined capture**: Add tasks from the sidebar with descriptions, list targets, due date & time, and recurrence (`daily`, `weekdays`, `weekly`, `monthly`, `quarterly`, `yearly`). The Today/Tomorrow views auto-select sensible defaults so you can add tasks in seconds.
- **Flexible organisation**: Reorder active tasks with HTML5 drag-and-drop, duplicate or edit in-place, and manage unlimited custom lists with live counters.
- **Standup-ready reporting**: `src/views/StandupView.vue` builds a daily snapshot that groups yesterday's completions, today's wins, and upcoming schedule. You can hide or reorder individual cards to tailor what you share with your team.
- **Timely nudges**: `useTaskNotifications` watches due dates, surfaces in-app banners, desktop notifications, and a subtle audio cue, and self-cleans once alerts are dismissed.
- **History made clear**: Completed items are archived with their completion timestamp, due metadata, and recurrence context so you can trace when and why something shipped.
- **Durable storage**: Tasks, completions, and lists are persisted as JSON files inside `/data` through a small Vite middleware, so reloads or browser restarts do not lose your work.

## Requirements

- Node.js 18.0+ (Vite 7 minimum)
- npm 9+

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Run the development server on <http://localhost:4173>

   ```bash
   npm run dev
   ```

3. (Optional) Build and preview the production bundle

   ```bash
   npm run build
   npm run preview
   ```

4. (Recommended) Lint before committing

   ```bash
   npm run lint
   npm run stylelint
   ```

## Available Scripts

- `npm run dev` - start Vite with the JSON storage middleware.
- `npm run build` - produce the optimized production bundle.
- `npm run preview` - serve the build locally (also mounts the storage middleware).
- `npm run lint` / `npm run lint:fix` - run ESLint (optionally with `--fix`).
- `npm run stylelint` / `npm run lint:style` - enforce the SCSS + `<style>` conventions.

## Data & Persistence

- Runtime storage lives under `/data`. Files are created on demand, prettified for manual inspection, and ignored by git so local experiments stay local.
- `src/services/jsonStorage.js` reads/writes JSON by calling `/api/storage/:file` in the browser.
- `vite.config.js` registers a middleware that implements the `/api/storage` endpoint and stores JSON safely (name validation, error handling, and CORS headers for previews).

## Project Structure

- `src/main.js` - mounts the app, router, and global styles.
- `src/App.vue` - shell with the capture form, sidebar list manager, and routed content.
- `src/components/` - shared UI (task cards, dialogs, notifications, icons).
- `src/views/` - Today, Tomorrow, Overdue, All, Completed, List-specific, and Standup views.
- `src/stores/useTaskStore.js` - single source of truth for tasks, recurrence logic, notifications, drag ordering, and persistence.
- `src/services/jsonStorage.js` - browser-side helper that bridges to the middleware-backed JSON files.
- `src/styles/_theme.scss` - theme tokens referenced across scoped styles.

## Contributing

Issues and pull requests are welcome! Please describe new features in this README, verify `npm run build`, `npm run lint`, and `npm run stylelint`, and keep persistence changes compatible with existing JSON data.

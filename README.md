# Todo List App

A polished task manager built with Vue 3 and Vite. Beyond the basics, it includes recurring schedules, desktop alerts, drag‑and‑drop ordering, and a focused editing workflow to help you move tasks from “idea” to “done”.

## Highlights

- **Streamlined capture**: Add tasks from the sidebar with optional description, due date/time, and recurrence rules (`daily`, `weekdays`, `weekly`, `monthly`). The form auto-selects today’s date when you are on the “Today” view.
- **Flexible organisation**: Reorder incomplete tasks with drag-and-drop, duplicate any task, or edit active tasks in-place. Recurring tasks regenerate automatically when completed and can be identified via badges.
- **Custom lists**: Spin up new task lists from the sidebar, jump between them instantly, and see live counts for each list.
- **Timely nudges**: Due tasks trigger in-app banners, desktop notifications, and a subtle tone. Notifications dismiss automatically after a short while.
- **History made clear**: Completed items are grouped by completion day (Today, Yesterday, or full date) with quick access to original due information.

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Run the development server  

   ```bash
   npm run dev
   ```

3. Lint the project (optional, recommended before committing)  

   ```bash
   npm run lint
   ```

## Project Structure

- `src/App.vue` – top-level layout with sidebar form and routed views.
- `src/components` – task card, editor dialog, notifications, and supporting UI pieces.
- `src/views` – Today, Tomorrow, Overdue, List, All, and Completed task screens.
- `src/stores/useTaskStore.js` – pinia-like composable store handling persistence, recurrence, notifications, and ordering logic.

## Tech Stack

- Vue 3 with `<script setup>`
- Vite tooling
- ESLint for linting
- HTML5 drag-and-drop for ordering interactions

## Contributing

Issues and pull requests are welcome! If you add features, please include a quick note in this README and ensure linting passes with `npm run lint`.

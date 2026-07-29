# Workspace Feature Roadmap

This document plans the top TODO item:

- Add Workspaces to create separate collections of tasks/lists.

## Goal

Introduce a Workspace layer above Lists so users can switch between independent contexts (example: Work, Home) with isolated data and settings.

## Prerequisite

- Remove API call functionality before starting Workspace implementation.
- Workspace implementation assumes data access is fully local with no network API dependency.

## Scope

In scope:
- Workspace entity and active workspace selection.
- Lists and tasks partitioned by workspace.
- Workspace-level import/export/backup/restore.
- Standup settings scoped to current workspace.
- Settings UI area for Workspace Settings.

Out of scope (for this item):
- Calendar View.
- Priority Helper.
- AI task management.

## Proposed Data Model

### New storage shape (logical)

- workspaces.json
  - id
  - name
  - slug
  - createdAt
  - updatedAt
  - isArchived (optional)

- workspace-meta.json (optional alternative to extending meta.json)
  - activeWorkspaceId
  - lastViewedAtByWorkspace (optional)

- workspace-specific data directory layout
  - data/workspaces/<workspaceSlug>/tasks.json
  - data/workspaces/<workspaceSlug>/lists.json
  - data/workspaces/<workspaceSlug>/completed.json
  - data/workspaces/<workspaceSlug>/summaries.json
  - data/workspaces/<workspaceSlug>/settings.json
  - data/workspaces/<workspaceSlug>/standup.json
  - data/workspaces/<workspaceSlug>/goals.json
  - data/workspaces/<workspaceSlug>/goal-outcomes.json

Notes:
- Keep shared global files minimal (only workspace registry + active workspace pointer).
- Existing per-app files migrate into a default workspace (for example: "Personal" or "Default").

## Architecture Changes

### Backend / persistence layer

- Update Vite middleware in vite.config.js (or backend/api.js if active path) to:
  - Resolve active workspace path safely.
  - Guard against path traversal (workspace IDs/slugs only).
  - Route read/write operations to the selected workspace folder.
  - Create workspace folders and default JSON files on workspace creation.

- Add workspace-level backup strategy:
  - backup root: data/backups/<timestamp>/<workspaceSlug>/...
  - restore operation restores only the selected workspace unless user chooses full restore.

- Add import/export endpoints:
  - Export current workspace as one bundle.
  - Import into a new or existing workspace with conflict handling.

### Frontend stores

- Create a new store: src/stores/useWorkspaceStore.js
  - workspace list state.
  - active workspace state.
  - actions: create, rename, archive/delete (if allowed), switch, load.

- Update existing stores to be workspace-aware:
  - src/stores/useTaskStore.js
  - src/stores/useGoalStore.js
  - src/stores/useUiSettings.js

Store expectations:
- On workspace switch, reload workspace-scoped data atomically.
- Avoid cross-workspace cache bleed.
- Keep in-memory state keyed by active workspace.

### UI/UX

- Add workspace switcher in app shell (header/top nav).
- Add workspace management modal/page:
  - Create workspace.
  - Rename workspace.
  - Select active workspace.
  - Archive/delete rules and warnings.

- Settings view updates:
  - Add "Workspace Settings" section.
  - Move Standup setting(s) to this section.
  - Clarify which settings are global vs workspace-specific.

## Migration Plan

### Phase 1: Introduce workspace primitives

- Add workspace registry and active workspace pointer.
- Auto-create default workspace on first run.
- No UI yet; keep behavior backward compatible.

### Phase 2: Data migration

- On startup, detect legacy flat data files.
- Copy/move legacy data into default workspace folder.
- Mark migration complete in meta file.
- Keep one-time backup before migration.

### Phase 3: Store integration

- Implement useWorkspaceStore.
- Make task/goal/settings stores load via active workspace path.
- Validate all views with switched workspaces.

### Phase 4: UI rollout

- Add workspace switcher and management controls.
- Add Workspace Settings section and move Standup settings.

### Phase 5: Import/export/backup/restore per workspace

- Update backup and restore flows + modal text.
- Add workspace export/import support.

## Edge Cases and Rules

- First workspace cannot be deleted while it is the only workspace.
- If active workspace is archived/deleted, pick fallback workspace deterministically.
- Workspace rename should update slug/path safely (migrate directory or keep immutable slug).
- Prevent duplicate workspace names (case-insensitive).
- If workspace data file is missing/corrupt, recreate from defaults and notify user.

## Testing Checklist

Functional:
- Create, rename, switch workspace.
- Lists/tasks are isolated across workspaces.
- Completed tasks and summaries are isolated.
- Standup settings differ per workspace.
- Backup/restore affects only selected workspace when chosen.
- Export/import roundtrip for one workspace.

Migration:
- Existing installs migrate into default workspace without data loss.
- Migration is idempotent (safe if app restarts mid-migration).

Regression:
- Existing task CRUD behavior unchanged inside a workspace.
- Goal and summary features continue to work.

## Suggested Implementation Order

1. Remove API call functionality and migrate storage operations to local-only access.
2. Add workspace registry + active workspace persistence.
3. Add path resolver in persistence/API layer.
4. Migrate legacy data into default workspace.
5. Wire workspace-aware loads into stores.
6. Add workspace switcher and management UI.
7. Move Standup settings to Workspace Settings.
8. Update backup/import/export flows.
9. Run regression and migration tests.

## Definition of Done

- User can maintain multiple independent workspaces.
- Each workspace has isolated tasks/lists/completed/summaries/goals/settings data.
- Standup settings are scoped by workspace.
- Backup/import/export/restore support workspace-level operations.
- Legacy users are migrated automatically without data loss.

# API Functionality Removal Plan

This document outlines how to remove API call functionality and transition the app to local-only data access.

## Objective

Replace network-based storage interactions with direct local data access patterns suitable for the existing app runtime so no frontend fetch dependency on local API routes remains.

Note:
- The Copilot project implementation must be updated to stop calling API endpoints and use the local-only persistence path.

## Scope

In scope:
- Remove frontend calls to local API endpoints.
- Remove or disable local API route middleware and standalone API server usage for app features.
- Preserve all existing app features using local persistence.

Out of scope:
- Workspace implementation details.
- Non-storage product changes.

## Known API Surface

Primary call sites to remove/refactor:
- src/services/jsonStorage.js
  - API base constants and fetch calls to /api/storage and /api/v1
- src/stores/useTaskStore.js
  - submitTask usage path
- Vite middleware storage API
  - vite.config.js json storage middleware
- Standalone backend server
  - backend/api.js v1 task endpoints

## Target Architecture

Local-only persistence should:
- Use one internal persistence adapter with no HTTP fetch requirement.
- Support read/write/backup/restore/import/export operations through direct file access strategy already available to the app runtime.
- Keep method signatures stable where practical to reduce store churn.

## Removal Strategy

### Phase 1: Inventory and compatibility design

- Enumerate all API methods used by stores/views.
- Define replacement function signatures for:
  - readJsonFile
  - writeJsonFile
  - listBackupSnapshots
  - restoreBackupSnapshot
  - exportDataBundle
  - importDataBundle
  - getStorageSettings
  - updateStorageSettings
  - submitTask
- Decide whether submitTask remains as a local helper or is inlined into store logic.

Deliverable:
- Mapping table from old API-backed function to new local implementation.

### Phase 2: Frontend persistence refactor

- Replace fetch-based implementations in src/services/jsonStorage.js.
- Keep return contracts compatible where possible.
- Update store/view call sites only where contract changes are unavoidable.

Expected outcome:
- App reads/writes data without HTTP requests.

### Phase 3: Remove API middleware/server dependencies

- Remove or disable json storage middleware from vite.config.js.
- Remove usage requirements for backend/api.js for normal app operation.
- Keep optional archival docs if backend is retained for future unrelated use.

Expected outcome:
- App can run without local API server or storage middleware route handlers.

### Phase 4: Backup/import/export parity

- Ensure local implementation preserves behavior and data shape.
- Validate that backup naming, retention, and restore logic still work.
- Confirm import/export contracts remain stable for user files.

Expected outcome:
- No feature regressions in data maintenance workflows.

### Phase 5: Cleanup and documentation

- Remove obsolete API docs and endpoint references.
- Update run instructions if API process is no longer needed.
- Update test-api.rest or remove if no longer relevant.

Expected outcome:
- Docs and repo scripts reflect local-only architecture.

## Acceptance Criteria

- No frontend fetch requests to /api/storage or /api/v1 remain.
- No feature requires backend/api.js to be running.
- All core user workflows remain functional.
- Build/lint pass.

## Verification Checklist

- Search for:
  - /api/storage
  - /api/v1
  - fetch(
- Execute smoke tests for:
  - Task CRUD
  - Completion and recurrence behavior
  - List management
  - Goal/outcome flows
  - Summary/standup history
  - Backup/restore/import/export
- Confirm no runtime errors related to missing API routes.

## Risks and Mitigations

- Risk: coupling to HTTP status/error semantics in stores.
  - Mitigation: preserve result object shape in local adapter.
- Risk: accidental behavior change in submitTask flow.
  - Mitigation: add focused regression tests around task creation defaults.
- Risk: backup/restore regression due to moved logic.
  - Mitigation: test with real data snapshots before finalizing.

## Done Definition

API functionality is considered removed when app persistence and task operations run fully local with no required HTTP storage or task endpoints.

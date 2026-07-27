# Goals System Plan

## Purpose

Add a Goals system alongside tasks. Goals represent outcomes to attempt over a defined period. Unlike tasks, Goals are not completed; each goal attempt is resolved as either `succeeded` or `failed`.

The feature should include a dedicated Goals page that helps the user create goals, resolve active goals, review goal history, and understand how often goals succeed.

## Product Model

### Goals vs Tasks

Tasks are units of work that can be completed, recur, and move into the completed task archive.

Goals are outcome commitments. A goal may be supported by tasks, but the goal itself has an outcome state:

- `active`: The goal is currently in progress.
- `succeeded`: The goal attempt achieved its intended outcome.
- `failed`: The goal attempt did not achieve its intended outcome.
- `archived`: Optional future state for hiding old goal definitions without deleting history.

This distinction should stay visible in labels, storage names, and code. Avoid reusing task completion terminology for goal outcomes except when describing UI affordances like buttons.

### Example Goals

- "Exercise 4 times this week"
- "Finish the monthly budget by Friday"
- "No takeout this week"
- "Publish one project update every weekday"

## Recommended Data Model

Store goals separately from tasks so goal outcome logic does not add more complexity to `useTaskStore.js`.

Recommended files:

- `data/goals.json`: Goal definitions and active goal attempts.
- `data/goal-outcomes.json`: Historical success/failure records.
- `data/meta.json`: Continue using existing schema metadata, or add a goals-specific metadata file if migrations diverge.

### Goal

```json
{
  "id": "goal-uuid",
  "title": "Exercise 4 times this week",
  "description": "",
  "status": "active",
  "period": "weekly",
  "targetCount": 4,
  "currentCount": 0,
  "startDate": "2026-07-06",
  "targetDate": "2026-07-12",
  "listId": "default",
  "createdAt": "2026-07-02T22:00:00.000Z",
  "updatedAt": "2026-07-02T22:00:00.000Z"
}
```

### Goal Outcome

```json
{
  "id": "goal-outcome-uuid",
  "goalId": "goal-uuid",
  "title": "Exercise 4 times this week",
  "outcome": "succeeded",
  "period": "weekly",
  "targetCount": 4,
  "actualCount": 4,
  "startedAt": "2026-07-06",
  "resolvedAt": "2026-07-12T20:30:00.000Z",
  "notes": "Hit the target before Sunday."
}
```

Snapshot the goal title and key target fields into the outcome record. This keeps historical reporting stable even if the goal title or target changes later.

## Store Design

Create a new `src/stores/useGoalStore.js` instead of expanding `useTaskStore.js`.

Responsibilities:

- Load and normalize `goals.json` and `goal-outcomes.json`.
- Create, edit, delete, and archive goals.
- Resolve active goals as `succeeded` or `failed`.
- Track progress for count-based goals.
- Calculate success metrics.
- Persist changes through `readJsonFile` and `writeJsonFile`.
- Broadcast updates across tabs, matching the task store pattern.

Possible computed values:

- `activeGoals`
- `resolvedGoals`
- `goalOutcomes`
- `overallSuccessRate`
- `successRateByPeriod`
- `successRateByGoal`
- `recentOutcomes`
- `goalsDueSoon`
- `overdueActiveGoals`

## UI Plan

### Route

Add a route for the Goals page:

- Path: `/goals`
- View: `src/views/GoalsView.vue`

Add a sidebar entry near Summary, Standup, or Completed depending on the current navigation grouping. Goals should be a first-class destination, not hidden inside Settings.

### Goals Page Layout

The Goals page should be operational rather than marketing-style. It should prioritize scanning and resolving goals.

Recommended sections:

1. Metrics strip
   - Overall success rate.
   - Succeeded count.
   - Failed count.
   - Active goals count.
   - Current period success rate if enough data exists.

2. Active goals
   - Title, target date, progress, and status.
   - Quick actions: increment progress, edit, mark succeeded, mark failed.
   - Goals nearing or past target date should be visually distinct.

3. Success tracking
   - Success rate by week, month, or goal type.
   - Simple trend display first; defer complex charts unless there is a charting dependency already in the project.

4. Goal history
   - Resolved outcomes with filters for all, succeeded, and failed.
   - Show target count vs actual count where applicable.
   - Include notes when present.

### Goal Form

Create a goal modal or inline panel that mirrors the task creation patterns where reasonable, but keeps goal-specific terms.

Fields:

- Title
- Description
- Period: none, daily, weekly, monthly, quarterly, yearly
- Target date
- Target count
- Optional current count
- Optional list/category association
- Notes

For the first version, avoid automatic habit-style recurrence unless explicitly needed. A goal can be resolved, then duplicated or recreated for the next period.

## Success Metrics

The Goals page should track how often goals succeed.

Core formula:

```text
successRate = succeededOutcomes / totalResolvedOutcomes
```

Rules:

- Only resolved outcomes count in success rates.
- Active goals should not lower the success rate.
- Deleted goal definitions should not remove historical outcomes unless the user explicitly deletes the history.
- If there are no resolved outcomes, show an empty state instead of `0%`.

Suggested metrics:

- Overall success rate.
- Success rate for the last 30 days.
- Success rate by period type.
- Per-goal success rate for repeated or duplicated goals with matching stable `goalSeriesId` in a later version.

## Recurrence and Repeated Goals

Avoid making recurrence part of the first implementation unless it is needed immediately. Recurring tasks already carry substantial logic in `useTaskStore.js`; duplicating that complexity for goals would raise the risk of confusing task recurrence with goal outcome history.

Recommended phased approach:

1. Manual one-off goals.
2. Duplicate goal action for repeating a previous goal.
3. Optional recurring goal templates with generated goal attempts.
4. Goal series analytics across repeated attempts.

If recurring goals are added, separate the template from attempts:

- Goal template: "Exercise 4 times per week"
- Goal attempt: "Exercise 4 times during 2026-07-06 through 2026-07-12"
- Goal outcome: success/failure record for that attempt

## Persistence and Migration

Add new JSON files rather than changing existing task files:

- `goals.json`
- `goal-outcomes.json`

Initial read should tolerate missing files by falling back to empty arrays. This matches the current storage helper behavior and avoids a migration for existing users.

If schema validation is added, normalize:

- Unknown status values to `active`.
- Unknown outcome values by dropping invalid outcome records.
- Invalid dates to `null`.
- Missing IDs to generated IDs.
- Numeric counts to non-negative integers.

## Integration Points

### Navigation

Update `src/App.vue` to include the Goals navigation item and active state.

### Router

Update `src/router/index.js` with the `/goals` route.

### Services

Reuse `src/services/jsonStorage.js`. No new endpoint should be necessary because the Vite middleware accepts arbitrary safe JSON file names.

### Store

Add `src/stores/useGoalStore.js`. Keep goal business logic out of `useTaskStore.js` unless a specific integration is implemented later.

### Components

Likely new components:

- `src/views/GoalsView.vue`
- `src/components/AddEditGoalModal.vue`
- `src/components/GoalCard.vue`
- `src/components/GoalOutcomeModal.vue`

## Testing and Verification

Manual checks:

- Create a goal.
- Edit a goal.
- Increment progress.
- Mark a goal succeeded.
- Mark a goal failed.
- Confirm the success rate updates correctly.
- Refresh the browser and confirm goals persist.
- Open a second tab and confirm updates sync if BroadcastChannel support is implemented.
- Delete or archive a goal and confirm historical outcomes remain intact.

Command checks:

```bash
npm run lint
npm run stylelint
npm run build
```

## Implementation Phases

### Phase 1: Data and Store

- Add `useGoalStore.js`.
- Add normalization and persistence for `goals.json` and `goal-outcomes.json`.
- Add core actions for create, update, delete/archive, resolve succeeded, and resolve failed.
- Add computed success metrics.

### Phase 2: Goals Page

- Add `/goals` route.
- Add sidebar navigation.
- Build `GoalsView.vue` with active goals, metrics, and history.
- Add goal creation and edit UI.

### Phase 3: Outcome Workflow

- Add a resolve modal for success/failure notes and actual counts.
- Add validation around resolving already resolved goals.
- Add empty states and error states.

### Phase 4: Analytics

- Add period filters.
- Add last 30 days and current period success rates.
- Add per-goal or per-series metrics if repeated goals are introduced.

### Phase 5: Repeated Goals

- Add duplicate goal.
- Add optional goal templates and generated attempts.
- Add series-level success tracking.

## Open Questions

- Should goals be associated with existing task lists, or should they have their own categories?
- Should a goal be allowed to link to supporting tasks?
- Should overdue active goals automatically fail, or should the user always resolve them manually?
- Should a failed goal require notes?
- Should goals appear in Standup or Summary views?
- Should goals support reminders, or should reminders stay task-only?

## Recommended First Version

Build the smallest useful version:

- Separate goal store.
- Separate JSON persistence.
- `/goals` page.
- Manual create/edit/delete.
- Manual `Succeeded` and `Failed` resolution.
- Overall success rate and history.

This gives the application a clear Goals concept without tying it too tightly to the existing task recurrence and completion archive.

import { computed, ref, watch } from 'vue';
import { readJsonFile, writeJsonFile } from '../services/jsonStorage';

const GOALS_FILE_NAME = 'goals.json';
const GOAL_OUTCOMES_FILE_NAME = 'goal-outcomes.json';
const STORAGE_CHANNEL_NAME = 'todo-goals-storage-sync';
const OVERDUE_CHECK_INTERVAL_MS = 60000;

const VALID_STATUS = new Set(['active', 'succeeded', 'failed', 'archived']);
const VALID_OUTCOME = new Set(['succeeded', 'failed']);
const VALID_TRACKING_TYPE = new Set(['count', 'binary']);
const VALID_PERIOD = new Set(['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']);

const goals = ref([]);
const outcomes = ref([]);
const lastSavedAt = ref(null);
const storageStatus = ref({ ok: true, message: '' });

let isInitialized = false;
let watchersReady = false;
let broadcastChannel = null;
let isApplyingRemoteUpdate = false;
let overdueCheckTimer = null;

const createId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createInstanceId = () => createId('goal-instance');
const instanceId = createInstanceId();

const parseDateInput = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.valueOf())
    || date.getFullYear() !== year
    || date.getMonth() + 1 !== month
    || date.getDate() !== day
  ) {
    return null;
  }
  const normalizedMonth = String(month).padStart(2, '0');
  const normalizedDay = String(day).padStart(2, '0');
  return `${year}-${normalizedMonth}-${normalizedDay}`;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeStatus = (value) => {
  if (typeof value !== 'string') {
    return 'active';
  }
  const normalized = value.trim().toLowerCase();
  return VALID_STATUS.has(normalized) ? normalized : 'active';
};

const normalizeOutcome = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_OUTCOME.has(normalized) ? normalized : null;
};

const normalizeTrackingType = (value) => {
  if (typeof value !== 'string') {
    return 'binary';
  }
  const normalized = value.trim().toLowerCase();
  return VALID_TRACKING_TYPE.has(normalized) ? normalized : 'binary';
};

const normalizePeriod = (value) => {
  if (typeof value !== 'string') {
    return 'none';
  }
  const normalized = value.trim().toLowerCase();
  return VALID_PERIOD.has(normalized) ? normalized : 'none';
};

const normalizeCount = (value, { allowNull = true } = {}) => {
  if (value === null || value === undefined || value === '') {
    return allowNull ? null : 0;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return allowNull ? null : 0;
  }
  const rounded = Math.max(0, Math.floor(numeric));
  return rounded;
};

const normalizeGoal = (goal, index) => {
  const trackingType = normalizeTrackingType(goal?.trackingType);
  const targetCount = trackingType === 'count'
    ? Math.max(1, normalizeCount(goal?.targetCount, { allowNull: false }))
    : null;
  const currentCount = trackingType === 'count'
    ? normalizeCount(goal?.currentCount, { allowNull: false })
    : null;

  return {
    id:
      typeof goal?.id === 'string' && goal.id.trim().length > 0
        ? goal.id.trim()
        : `goal-${index + 1}`,
    title:
      typeof goal?.title === 'string' && goal.title.trim().length > 0
        ? goal.title.trim()
        : 'Untitled goal',
    description: typeof goal?.description === 'string' ? goal.description.trim() : '',
    status: normalizeStatus(goal?.status),
    trackingType,
    period: normalizePeriod(goal?.period),
    targetCount,
    currentCount,
    startDate: parseDateInput(goal?.startDate) ?? null,
    targetDate: parseDateInput(goal?.targetDate) ?? null,
    createdAt:
      typeof goal?.createdAt === 'string' && !Number.isNaN(Date.parse(goal.createdAt))
        ? new Date(goal.createdAt).toISOString()
        : new Date().toISOString(),
    updatedAt:
      typeof goal?.updatedAt === 'string' && !Number.isNaN(Date.parse(goal.updatedAt))
        ? new Date(goal.updatedAt).toISOString()
        : new Date().toISOString(),
  };
};

const normalizeOutcomeRecord = (record, index) => {
  const outcome = normalizeOutcome(record?.outcome);
  if (!outcome) {
    return null;
  }

  const trackingType = normalizeTrackingType(record?.trackingType);

  return {
    id:
      typeof record?.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : `goal-outcome-${index + 1}`,
    goalId:
      typeof record?.goalId === 'string' && record.goalId.trim().length > 0
        ? record.goalId.trim()
        : null,
    title:
      typeof record?.title === 'string' && record.title.trim().length > 0
        ? record.title.trim()
        : 'Untitled goal',
    outcome,
    trackingType,
    period: normalizePeriod(record?.period),
    targetCount: trackingType === 'count' ? normalizeCount(record?.targetCount) : null,
    actualCount: trackingType === 'count' ? normalizeCount(record?.actualCount) : null,
    startedAt: parseDateInput(record?.startedAt) ?? null,
    resolvedAt:
      typeof record?.resolvedAt === 'string' && !Number.isNaN(Date.parse(record.resolvedAt))
        ? new Date(record.resolvedAt).toISOString()
        : new Date().toISOString(),
    notes: typeof record?.notes === 'string' ? record.notes.trim() : '',
  };
};

const isGoalOverdue = (goal, today = getTodayDateString()) => {
  if (!goal || goal.status !== 'active') {
    return false;
  }
  if (!goal.targetDate) {
    return false;
  }
  return goal.targetDate < today;
};

const buildOutcomeFromGoal = (goal, outcome, { notes = '', actualCount = null } = {}) => {
  const normalizedOutcome = normalizeOutcome(outcome);
  if (!normalizedOutcome) {
    return null;
  }

  const trackingType = normalizeTrackingType(goal?.trackingType);
  const fallbackActualCount = trackingType === 'count'
    ? normalizeCount(goal?.currentCount, { allowNull: false })
    : null;

  return {
    id: createId('goal-outcome'),
    goalId: goal.id,
    title: goal.title,
    outcome: normalizedOutcome,
    trackingType,
    period: normalizePeriod(goal.period),
    targetCount: trackingType === 'count' ? normalizeCount(goal.targetCount) : null,
    actualCount: trackingType === 'count'
      ? (normalizeCount(actualCount) ?? fallbackActualCount)
      : null,
    startedAt: parseDateInput(goal.startDate) ?? null,
    resolvedAt: new Date().toISOString(),
    notes: typeof notes === 'string' ? notes.trim() : '',
  };
};

const postStorageUpdate = () => {
  if (!broadcastChannel || isApplyingRemoteUpdate) {
    return;
  }
  try {
    broadcastChannel.postMessage({
      source: instanceId,
      type: 'goals-storage-updated',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to broadcast goals storage update', error);
  }
};

const persistGoals = async () => {
  const result = await writeJsonFile(GOALS_FILE_NAME, goals.value);
  if (result?.ok === false) {
    storageStatus.value = { ok: false, message: result.message ?? 'Failed to save goals.' };
    return false;
  }
  storageStatus.value = { ok: true, message: '' };
  lastSavedAt.value = new Date().toISOString();
  if (watchersReady && !isApplyingRemoteUpdate) {
    postStorageUpdate();
  }
  return true;
};

const persistOutcomes = async () => {
  const result = await writeJsonFile(GOAL_OUTCOMES_FILE_NAME, outcomes.value);
  if (result?.ok === false) {
    storageStatus.value = {
      ok: false,
      message: result.message ?? 'Failed to save goal outcomes.',
    };
    return false;
  }
  storageStatus.value = { ok: true, message: '' };
  lastSavedAt.value = new Date().toISOString();
  if (watchersReady && !isApplyingRemoteUpdate) {
    postStorageUpdate();
  }
  return true;
};

const failOverdueActiveGoals = () => {
  const today = getTodayDateString();
  let changed = false;

  const nextGoals = goals.value.map((goal) => {
    if (!isGoalOverdue(goal, today)) {
      return goal;
    }

    changed = true;
    const failedOutcome = buildOutcomeFromGoal(goal, 'failed', {
      notes: '',
      actualCount: goal.trackingType === 'count' ? goal.currentCount : null,
    });

    if (failedOutcome) {
      outcomes.value = [...outcomes.value, failedOutcome];
    }

    return {
      ...goal,
      status: 'failed',
      updatedAt: new Date().toISOString(),
    };
  });

  if (changed) {
    goals.value = nextGoals;
  }

  return changed;
};

const loadFromStorage = async () => {
  const [goalsResult, outcomesResult] = await Promise.all([
    readJsonFile(GOALS_FILE_NAME, []),
    readJsonFile(GOAL_OUTCOMES_FILE_NAME, []),
  ]);

  if (goalsResult?.ok === false || outcomesResult?.ok === false) {
    storageStatus.value = { ok: false, message: 'Failed to read goals data.' };
  } else {
    storageStatus.value = { ok: true, message: '' };
  }

  goals.value = Array.isArray(goalsResult?.data)
    ? goalsResult.data.map(normalizeGoal)
    : [];

  outcomes.value = Array.isArray(outcomesResult?.data)
    ? outcomesResult.data.map(normalizeOutcomeRecord).filter(Boolean)
    : [];

  const changed = failOverdueActiveGoals();

  if (changed) {
    await persistGoals();
    await persistOutcomes();
  }
};

const setupBroadcastChannel = () => {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined' || broadcastChannel) {
    return;
  }

  broadcastChannel = new window.BroadcastChannel(STORAGE_CHANNEL_NAME);
  broadcastChannel.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || data.source === instanceId) {
      return;
    }
    if (data.type === 'goals-storage-updated') {
      refreshFromStorage().catch((error) => {
        console.error('Failed to apply goals broadcast update', error);
      });
    }
  });
};

const teardownBroadcastChannel = () => {
  if (!broadcastChannel) {
    return;
  }
  broadcastChannel.close();
  broadcastChannel = null;
};

const startOverdueChecker = () => {
  if (typeof window === 'undefined' || overdueCheckTimer !== null) {
    return;
  }
  overdueCheckTimer = window.setInterval(() => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    failOverdueActiveGoals();
  }, OVERDUE_CHECK_INTERVAL_MS);
};

const stopOverdueChecker = () => {
  if (typeof window === 'undefined' || overdueCheckTimer === null) {
    return;
  }
  window.clearInterval(overdueCheckTimer);
  overdueCheckTimer = null;
};

const createGoal = (payload) => {
  const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    return null;
  }

  const trackingType = normalizeTrackingType(payload?.trackingType);
  const targetCount = trackingType === 'count'
    ? Math.max(1, normalizeCount(payload?.targetCount, { allowNull: false }))
    : null;
  const currentCount = trackingType === 'count'
    ? normalizeCount(payload?.currentCount, { allowNull: false })
    : null;

  const today = getTodayDateString();
  const nowIso = new Date().toISOString();
  const nextGoal = {
    id: createId('goal'),
    title,
    description: typeof payload?.description === 'string' ? payload.description.trim() : '',
    status: 'active',
    trackingType,
    period: normalizePeriod(payload?.period),
    targetCount,
    currentCount,
    startDate: parseDateInput(payload?.startDate) ?? today,
    targetDate: parseDateInput(payload?.targetDate) ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  goals.value = [...goals.value, nextGoal];
  failOverdueActiveGoals();
  return nextGoal;
};

const updateGoal = (payload) => {
  const goalId = payload?.id;
  if (!goalId) {
    return false;
  }

  const index = goals.value.findIndex((goal) => goal.id === goalId);
  if (index < 0) {
    return false;
  }

  const existing = goals.value[index];
  const title = typeof payload?.title === 'string' ? payload.title.trim() : existing.title;
  if (!title) {
    return false;
  }

  const trackingType = normalizeTrackingType(payload?.trackingType ?? existing.trackingType);
  const targetCount = trackingType === 'count'
    ? Math.max(1, normalizeCount(payload?.targetCount ?? existing.targetCount, { allowNull: false }))
    : null;
  const currentCount = trackingType === 'count'
    ? normalizeCount(payload?.currentCount ?? existing.currentCount, { allowNull: false })
    : null;

  const updated = {
    ...existing,
    title,
    description:
      typeof payload?.description === 'string' ? payload.description.trim() : existing.description,
    trackingType,
    period: normalizePeriod(payload?.period ?? existing.period),
    targetCount,
    currentCount,
    startDate: parseDateInput(payload?.startDate ?? existing.startDate) ?? null,
    targetDate: parseDateInput(payload?.targetDate ?? existing.targetDate) ?? null,
    updatedAt: new Date().toISOString(),
  };

  const nextGoals = [...goals.value];
  nextGoals[index] = updated;
  goals.value = nextGoals;
  failOverdueActiveGoals();
  return true;
};

const deleteGoal = (goalId) => {
  const before = goals.value.length;
  goals.value = goals.value.filter((goal) => goal.id !== goalId);
  return goals.value.length !== before;
};

const changeGoalProgress = (goalId, delta) => {
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    return false;
  }

  const index = goals.value.findIndex((goal) => goal.id === goalId);
  if (index < 0) {
    return false;
  }

  const goal = goals.value[index];
  if (goal.status !== 'active' || goal.trackingType !== 'count') {
    return false;
  }

  const current = normalizeCount(goal.currentCount, { allowNull: false });
  const next = Math.max(0, current + Math.trunc(numericDelta));

  const updated = {
    ...goal,
    currentCount: next,
    updatedAt: new Date().toISOString(),
  };

  const nextGoals = [...goals.value];
  nextGoals[index] = updated;
  goals.value = nextGoals;
  return true;
};

const resolveGoal = (goalId, outcome, { notes = '', actualCount = null } = {}) => {
  const normalizedOutcome = normalizeOutcome(outcome);
  if (!normalizedOutcome) {
    return false;
  }

  const index = goals.value.findIndex((goal) => goal.id === goalId);
  if (index < 0) {
    return false;
  }

  const goal = goals.value[index];
  if (goal.status !== 'active') {
    return false;
  }

  const outcomeRecord = buildOutcomeFromGoal(goal, normalizedOutcome, {
    notes,
    actualCount,
  });
  if (!outcomeRecord) {
    return false;
  }

  const nextGoals = [...goals.value];
  nextGoals[index] = {
    ...goal,
    status: normalizedOutcome,
    updatedAt: new Date().toISOString(),
  };

  goals.value = nextGoals;
  outcomes.value = [...outcomes.value, outcomeRecord];
  return true;
};

const markGoalSucceeded = (goalId, payload = {}) =>
  resolveGoal(goalId, 'succeeded', payload);

const markGoalFailed = (goalId, payload = {}) =>
  resolveGoal(goalId, 'failed', payload);

const refreshFromStorage = async () => {
  if (isApplyingRemoteUpdate) {
    return;
  }
  isApplyingRemoteUpdate = true;
  try {
    await loadFromStorage();
  } finally {
    isApplyingRemoteUpdate = false;
  }
};

const sortedGoals = computed(() =>
  [...goals.value].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') {
      return -1;
    }
    if (a.status !== 'active' && b.status === 'active') {
      return 1;
    }

    const aDate = a.targetDate ?? '9999-12-31';
    const bDate = b.targetDate ?? '9999-12-31';
    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }

    return a.title.localeCompare(b.title);
  })
);

const activeGoals = computed(() =>
  sortedGoals.value.filter((goal) => goal.status === 'active')
);

const resolvedGoals = computed(() =>
  sortedGoals.value.filter((goal) => goal.status === 'succeeded' || goal.status === 'failed')
);

const goalOutcomes = computed(() =>
  [...outcomes.value].sort((a, b) => {
    const aTime = Date.parse(a.resolvedAt ?? '') || 0;
    const bTime = Date.parse(b.resolvedAt ?? '') || 0;
    return bTime - aTime;
  })
);

const overdueActiveGoals = computed(() => {
  const today = getTodayDateString();
  return activeGoals.value.filter((goal) => isGoalOverdue(goal, today));
});

const goalsDueSoon = computed(() => {
  const today = new Date(`${getTodayDateString()}T00:00:00`);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 2);

  return activeGoals.value.filter((goal) => {
    if (!goal.targetDate) {
      return false;
    }
    const target = new Date(`${goal.targetDate}T00:00:00`);
    if (Number.isNaN(target.valueOf())) {
      return false;
    }
    return target >= today && target <= soon;
  });
});

const succeededOutcomesCount = computed(() =>
  goalOutcomes.value.filter((entry) => entry.outcome === 'succeeded').length
);

const failedOutcomesCount = computed(() =>
  goalOutcomes.value.filter((entry) => entry.outcome === 'failed').length
);

const totalResolvedCount = computed(() =>
  succeededOutcomesCount.value + failedOutcomesCount.value
);

const overallSuccessRate = computed(() => {
  if (totalResolvedCount.value === 0) {
    return null;
  }
  return succeededOutcomesCount.value / totalResolvedCount.value;
});

const initialize = async () => {
  if (isInitialized) {
    return;
  }

  await loadFromStorage();
  setupBroadcastChannel();
  watchersReady = true;
  startOverdueChecker();
  isInitialized = true;
};

const teardown = () => {
  teardownBroadcastChannel();
  stopOverdueChecker();
};

watch(
  goals,
  () => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistGoals().catch((error) => {
      console.error('Failed to persist goals', error);
      storageStatus.value = { ok: false, message: 'Failed to save goals.' };
    });
  },
  { deep: true }
);

watch(
  outcomes,
  () => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistOutcomes().catch((error) => {
      console.error('Failed to persist goal outcomes', error);
      storageStatus.value = { ok: false, message: 'Failed to save goal outcomes.' };
    });
  },
  { deep: true }
);

export const useGoalStore = () => {
  initialize().catch((error) => {
    console.error('Failed to initialize goal store', error);
    storageStatus.value = { ok: false, message: 'Failed to initialize goals.' };
  });

  return {
    goals,
    outcomes,
    activeGoals,
    resolvedGoals,
    goalOutcomes,
    overdueActiveGoals,
    goalsDueSoon,
    succeededOutcomesCount,
    failedOutcomesCount,
    totalResolvedCount,
    overallSuccessRate,
    lastSavedAt,
    storageStatus,
    createGoal,
    updateGoal,
    deleteGoal,
    changeGoalProgress,
    resolveGoal,
    markGoalSucceeded,
    markGoalFailed,
    refreshFromStorage,
    teardown,
  };
};

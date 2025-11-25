import { ref, computed, watch } from 'vue';
import { useTaskNotifications } from '../composables/useTaskNotifications';
import { readJsonFile, writeJsonFile } from '../services/jsonStorage';

const TASKS_FILE_NAME = 'tasks.json';
const COMPLETED_TASKS_FILE_NAME = 'completed-tasks.json';
const LISTS_FILE_NAME = 'lists.json';
const DEFAULT_LIST_ID = 'default';
const DEFAULT_LIST_NAME = 'My Tasks';
const DEFAULT_LIST = Object.freeze({
  id: DEFAULT_LIST_ID,
  name: DEFAULT_LIST_NAME,
});

const tasks = ref([]);
const completedTasks = ref([]);
const lists = ref([DEFAULT_LIST]);
const currentTime = ref(Date.now());

const FALLBACK_DUE_TIME = '23:59';
const STORAGE_CHANNEL_NAME = 'todo-storage-sync';
const createInstanceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `instance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const instanceId = createInstanceId();
const {
  notifications,
  dismissNotification,
  pushNotification,
  startDueWatcher,
  stopDueWatcher,
  checkDueTasks,
} = useTaskNotifications(tasks);

let initialId = 1;
let isInitialized = false;
let watchersReady = false;
let currentTimeTimer = null;
let listInitialId = 1;
const completionNotificationIds = new Map();
const spawnedRecurringTaskIds = new Map();
let broadcastChannel = null;
let isApplyingRemoteUpdate = false;

const VALID_RECURRENCE = new Set(['daily', 'weekdays', 'weekly', 'monthly', 'quarterly', 'yearly']);

const createListId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  listInitialId += 1;
  return `list-${Date.now()}-${listInitialId}`;
};

const ensureDefaultList = () => {
  const hasDefault = lists.value.some((list) => list.id === DEFAULT_LIST_ID);
  if (!hasDefault) {
    lists.value = [DEFAULT_LIST, ...lists.value];
  }
};

const normalizeListId = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0 && lists.value.some((list) => list.id === trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_LIST_ID;
};

const startCurrentTimeTicker = () => {
  if (typeof window === 'undefined') {
    currentTime.value = Date.now();
    return;
  }

  currentTime.value = Date.now();

  if (currentTimeTimer !== null) {
    return;
  }

  currentTimeTimer = window.setInterval(() => {
    currentTime.value = Date.now();
  }, 60000);
};

const stopCurrentTimeTicker = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (currentTimeTimer !== null) {
    window.clearInterval(currentTimeTimer);
    currentTimeTimer = null;
  }
};

const normalizeRecurrence = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_RECURRENCE.has(normalized) ? normalized : null;
};

const postStorageUpdate = () => {
  if (!broadcastChannel || isApplyingRemoteUpdate) {
    return;
  }

  try {
    broadcastChannel.postMessage({
      source: instanceId,
      type: 'storage-updated',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to broadcast storage update', error);
  }
};

const persistTasks = async (value) => {
  try {
    await writeJsonFile(TASKS_FILE_NAME, value);
    if (watchersReady && !isApplyingRemoteUpdate) {
      postStorageUpdate();
    }
  } catch (error) {
    console.error('Failed to persist tasks to JSON file', error);
  }
};

const persistCompletedTasks = async (value) => {
  try {
    await writeJsonFile(COMPLETED_TASKS_FILE_NAME, value);
    if (watchersReady && !isApplyingRemoteUpdate) {
      postStorageUpdate();
    }
  } catch (error) {
    console.error('Failed to persist completed tasks to JSON file', error);
  }
};

const persistLists = async (value) => {
  try {
    await writeJsonFile(LISTS_FILE_NAME, value);
    if (watchersReady && !isApplyingRemoteUpdate) {
      postStorageUpdate();
    }
  } catch (error) {
    console.error('Failed to persist lists to JSON file', error);
  }
};

const handleBroadcastMessage = (event) => {
  const data = event?.data;
  if (!data || data.source === instanceId) {
    return;
  }

  if (data.type === 'storage-updated') {
    applyRemoteUpdateFromBroadcast().catch((error) => {
      console.error('Failed to apply broadcast storage update', error);
    });
  }
};

const setupBroadcastChannel = () => {
  if (
    typeof window === 'undefined'
    || typeof window.BroadcastChannel === 'undefined'
    || broadcastChannel
  ) {
    return;
  }

  broadcastChannel = new window.BroadcastChannel(STORAGE_CHANNEL_NAME);
  broadcastChannel.addEventListener('message', handleBroadcastMessage);
};

const teardownBroadcastChannel = () => {
  if (!broadcastChannel) {
    return;
  }

  broadcastChannel.removeEventListener('message', handleBroadcastMessage);
  broadcastChannel.close();
  broadcastChannel = null;
};

const applyRemoteUpdateFromBroadcast = async () => {
  if (isApplyingRemoteUpdate) {
    return;
  }

  isApplyingRemoteUpdate = true;
  try {
    await loadFromStorage();
    checkDueTasks();
  } finally {
    isApplyingRemoteUpdate = false;
  }
};

const syncInitialId = () => {
  const maxId = tasks.value.reduce((acc, task) => Math.max(acc, Number(task.id) || 0), 0);
  initialId = maxId + 1;
};

const buildDueDate = (date, time) => {
  if (!date) {
    return null;
  }

  const normalizedTime = time && time.trim().length > 0 ? time : FALLBACK_DUE_TIME;
  const timestamp = new Date(`${date}T${normalizedTime}`);

  if (Number.isNaN(timestamp.valueOf())) {
    return null;
  }

  return timestamp.toISOString();
};

const advanceDateByRecurrence = (date, recurrence) => {
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekdays': {
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;
    }
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      break;
  }
};

const computeNextDueDate = (currentDue, recurrence) => {
  const normalized = normalizeRecurrence(recurrence);

  if (!normalized || !currentDue) {
    return null;
  }

  const base = new Date(currentDue);
  if (Number.isNaN(base.valueOf())) {
    return null;
  }

  const next = new Date(base);
  const now = Date.now();
  advanceDateByRecurrence(next, normalized);

  while (next.valueOf() <= now) {
    advanceDateByRecurrence(next, normalized);
  }

  return next.toISOString();
};

const createRecurringTask = (task) => {
  const recurrence = normalizeRecurrence(task.recurrence);
  if (!recurrence) {
    return null;
  }

  const nextDue = computeNextDueDate(task.due, recurrence);

  return {
    id: initialId++,
    title: task.title,
    description: task.description ?? '',
    completed: false,
    due: nextDue ?? task.due ?? null,
    recurrence,
    listId: normalizeListId(task.listId),
  };
};

const recordCompletion = (task) => {
  if (!task) {
    return;
  }

  const entry = {
    taskId: task.id,
    title: task.title,
    description: task.description ?? '',
    due: task.due ?? null,
    completedAt: new Date().toISOString(),
    recurrence: normalizeRecurrence(task.recurrence),
    listId: normalizeListId(task.listId),
  };

  const existingIndex = completedTasks.value.findIndex((item) => item.taskId === task.id);

  if (existingIndex >= 0) {
    const updated = [...completedTasks.value];
    updated[existingIndex] = entry;
    completedTasks.value = updated;
  } else {
    completedTasks.value = [...completedTasks.value, entry];
  }
};

const removeCompletion = (taskId) => {
  completedTasks.value = completedTasks.value.filter((entry) => entry.taskId !== taskId);
};

const updateCompletedTaskTimestamp = (taskId, completedAt) => {
  const entryIndex = completedTasks.value.findIndex((entry) => entry.taskId === taskId);
  if (entryIndex < 0) {
    return false;
  }

  let resolvedDate = null;

  if (completedAt instanceof Date) {
    resolvedDate = completedAt;
  } else if (typeof completedAt === 'number') {
    resolvedDate = new Date(completedAt);
  } else if (typeof completedAt === 'string') {
    resolvedDate = new Date(completedAt);
  }

  if (!(resolvedDate instanceof Date) || Number.isNaN(resolvedDate.valueOf())) {
    return false;
  }

  const updatedEntries = [...completedTasks.value];
  updatedEntries[entryIndex] = {
    ...updatedEntries[entryIndex],
    completedAt: resolvedDate.toISOString(),
  };
  completedTasks.value = updatedEntries;

  return true;
};

const getStartOfDay = (timestamp) => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const buildDueIsoForTargetDate = (task, targetDate, ensureFuture = false) => {
  const base = targetDate instanceof Date ? new Date(targetDate) : new Date(targetDate);

  if (Number.isNaN(base.valueOf())) {
    return null;
  }

  let hours = 23;
  let minutes = 59;

  if (task.due) {
    const existing = new Date(task.due);
    if (!Number.isNaN(existing.valueOf())) {
      hours = existing.getHours();
      minutes = existing.getMinutes();
    }
  }

  base.setHours(hours, minutes, 0, 0);

  if (ensureFuture && base.valueOf() <= currentTime.value) {
    base.setHours(23, 59, 0, 0);
  }

  return base.toISOString();
};

const moveTaskToDate = (taskId, targetDate, ensureFuture = false) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === taskId);
  if (targetIndex < 0) {
    return false;
  }

  const targetTask = tasks.value[targetIndex];
  if (!targetTask || targetTask.completed) {
    return false;
  }

  const nextDue = buildDueIsoForTargetDate(targetTask, targetDate, ensureFuture);
  if (!nextDue) {
    return false;
  }

  const updated = [...tasks.value];
  updated[targetIndex] = {
    ...targetTask,
    due: nextDue,
  };
  tasks.value = updated;
  return true;
};

const moveTaskToToday = (taskId) => {
  const todayStart = getStartOfDay(currentTime.value);
  return moveTaskToDate(taskId, todayStart, true);
};

const moveTaskToTomorrow = (taskId) => {
  const tomorrowStart = getStartOfDay(currentTime.value);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return moveTaskToDate(taskId, tomorrowStart);
};

const moveOverdueTasksToToday = () => {
  const overdueList = Array.isArray(tasksOverdue.value) ? [...tasksOverdue.value] : [];
  let updatedCount = 0;

  overdueList.forEach((task) => {
    if (!task?.id) {
      return;
    }
    if (moveTaskToToday(task.id)) {
      updatedCount += 1;
    }
  });

  return { updatedCount };
};

const postponeTasksUntil = (dateValue) => {
  const targetDate = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue ?? '');
  if (Number.isNaN(targetDate.valueOf())) {
    return { updatedCount: 0 };
  }

  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const updatedTasks = Array.isArray(tasks.value) ? [...tasks.value] : [];
  let updatedCount = 0;

  updatedTasks.forEach((task, index) => {
    if (!task || task.completed || !task.due) {
      return;
    }

    const currentDue = new Date(task.due);
    if (Number.isNaN(currentDue.valueOf()) || currentDue >= targetStart) {
      return;
    }

    const newDue = new Date(targetStart);
    newDue.setHours(currentDue.getHours(), currentDue.getMinutes(), currentDue.getSeconds(), 0);

    updatedTasks[index] = {
      ...task,
      due: newDue.toISOString(),
    };
    updatedCount += 1;
  });

  if (updatedCount > 0) {
    tasks.value = updatedTasks;
  }

  return { updatedCount };
};

const skipTaskRecurrence = (taskId) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === taskId);
  if (targetIndex < 0) {
    return false;
  }

  const targetTask = tasks.value[targetIndex];
  if (!targetTask || targetTask.completed) {
    return false;
  }

  const recurrence = normalizeRecurrence(targetTask.recurrence);
  if (!recurrence || !targetTask.due) {
    return false;
  }

  const nextDue = computeNextDueDate(targetTask.due, recurrence);
  if (!nextDue) {
    return false;
  }

  const updated = [...tasks.value];
  updated[targetIndex] = {
    ...targetTask,
    due: nextDue,
  };
  tasks.value = updated;
  return true;
};

const addTask = ({ title, description, dueDate, dueTime, recurrence, listId }) => {
  const due = buildDueDate(dueDate, dueTime);
  const recurrenceValue = normalizeRecurrence(recurrence);
  const newTask = {
    id: initialId++,
    title,
    description,
    completed: false,
    due,
    recurrence: recurrenceValue,
    listId: normalizeListId(listId),
  };

  tasks.value = [...tasks.value, newTask];
};

const updateTask = ({ id, title, description, dueDate, dueTime, recurrence, listId }) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === id);
  if (targetIndex < 0) {
    return false;
  }

  const target = tasks.value[targetIndex];
  if (target.completed) {
    return false;
  }

  const nextTasks = [...tasks.value];
  const updatedTask = {
    ...target,
    title: typeof title === 'string' && title.trim().length > 0 ? title : target.title,
    description: typeof description === 'string' ? description : target.description,
    due: buildDueDate(dueDate, dueTime),
    recurrence: normalizeRecurrence(recurrence),
    listId: normalizeListId(listId ?? target.listId),
  };

  if (!dueDate) {
    updatedTask.due = null;
  }

  nextTasks[targetIndex] = updatedTask;
  tasks.value = nextTasks;
  return true;
};

const reorderTask = ({ id, beforeId = null }) => {
  const updated = [...tasks.value];
  const currentIndex = updated.findIndex((item) => item.id === id);

  if (currentIndex < 0) {
    return false;
  }

  if (beforeId === id) {
    return false;
  }

  const [task] = updated.splice(currentIndex, 1);

  let targetIndex;
  if (!beforeId) {
    targetIndex = updated.length;
  } else {
    targetIndex = updated.findIndex((item) => item.id === beforeId);
    if (targetIndex < 0) {
      targetIndex = updated.length;
    }
  }

  updated.splice(targetIndex, 0, task);
  tasks.value = updated;
  return true;
};

const toggleTaskCompletion = (taskId, options = {}) => {
  const { suppressNotification = false } = options;
  const targetIndex = tasks.value.findIndex((item) => item?.id === taskId);
  if (targetIndex < 0) {
    return;
  }

  const originalTask = tasks.value[targetIndex];
  if (!originalTask) {
    return;
  }

  const updatedTask = {
    ...originalTask,
    completed: !originalTask.completed,
  };

  const updatedTasks = [...tasks.value];
  updatedTasks[targetIndex] = updatedTask;

  if (updatedTask.completed) {
    recordCompletion(updatedTask);
    const nextTask = createRecurringTask(updatedTask);

    if (nextTask) {
      spawnedRecurringTaskIds.set(updatedTask.id, nextTask.id);
      updatedTasks.push(nextTask);
    } else {
      spawnedRecurringTaskIds.delete(updatedTask.id);
    }

    tasks.value = updatedTasks;

    if (!suppressNotification) {
      const existingNotificationId = completionNotificationIds.get(updatedTask.id);
      if (existingNotificationId) {
        dismissNotification(existingNotificationId);
      }

      const notificationId = pushNotification(
        `Task "${updatedTask.title || 'Untitled task'}" completed.`,
        {
          action: {
            label: 'Undo',
            type: 'undo-completed-task',
            payload: { taskId: updatedTask.id },
          },
          duration: 10000,
        }
      );
      completionNotificationIds.set(updatedTask.id, notificationId);
    }
  } else {
    removeCompletion(updatedTask.id);

    const spawnedId = spawnedRecurringTaskIds.get(updatedTask.id);
    if (spawnedId !== undefined) {
      const removalIndex = updatedTasks.findIndex((item) => item?.id === spawnedId);
      if (removalIndex >= 0) {
        updatedTasks.splice(removalIndex, 1);
      }
      spawnedRecurringTaskIds.delete(updatedTask.id);
    }

    tasks.value = updatedTasks;

    const notificationId = completionNotificationIds.get(updatedTask.id);
    if (notificationId) {
      dismissNotification(notificationId);
      completionNotificationIds.delete(updatedTask.id);
    }
  }
};

const removeTask = (taskId) => {
  tasks.value = tasks.value.filter((item) => item.id !== taskId);
  removeCompletion(taskId);
  completionNotificationIds.delete(taskId);
  spawnedRecurringTaskIds.delete(taskId);

  Array.from(spawnedRecurringTaskIds.entries()).forEach(([originId, spawnedId]) => {
    if (spawnedId === taskId) {
      spawnedRecurringTaskIds.delete(originId);
    }
  });
};

const reviveCompletedTask = (taskId) => {
  const entryIndex = completedTasks.value.findIndex((entry) => entry.taskId === taskId);
  if (entryIndex < 0) {
    return false;
  }

  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const targetIndex = currentTasks.findIndex((task) => task?.id === taskId);

  if (targetIndex >= 0) {
    const targetTask = currentTasks[targetIndex];

    if (targetTask.completed) {
      toggleTaskCompletion(taskId, { suppressNotification: true });
    } else {
      completedTasks.value = completedTasks.value.filter((entry) => entry.taskId !== taskId);
    }
  } else {
    const entry = completedTasks.value[entryIndex];
    const revivedTask = {
      id: taskId,
      title: entry.title ?? 'Untitled task',
      description: entry.description ?? '',
      completed: false,
      due: entry.due ?? null,
      recurrence: entry.recurrence ?? null,
      listId: normalizeListId(entry.listId),
    };

    tasks.value = [...currentTasks, revivedTask];
    completedTasks.value = completedTasks.value.filter((item) => item.taskId !== taskId);
  }

  completionNotificationIds.delete(taskId);
  spawnedRecurringTaskIds.delete(taskId);

  Array.from(spawnedRecurringTaskIds.entries()).forEach(([originId, spawnedId]) => {
    if (spawnedId === taskId) {
      spawnedRecurringTaskIds.delete(originId);
    }
  });

  return true;
};

const deleteCompletedTask = (taskId) => {
  const hasEntry = completedTasks.value.some((entry) => entry.taskId === taskId);
  if (!hasEntry) {
    return false;
  }

  removeTask(taskId);
  return true;
};

const addList = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length === 0) {
    return null;
  }

  const existing = lists.value.find(
    (list) => list.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  const newList = {
    id: createListId(),
    name: trimmed,
  };

  lists.value = [...lists.value, newList];
  return newList;
};

const removeList = (listId) => {
  const targetId = typeof listId === 'string' ? listId.trim() : '';
  if (targetId.length === 0 || targetId === DEFAULT_LIST_ID) {
    return false;
  }

  const existingIndex = lists.value.findIndex((list) => list.id === targetId);
  if (existingIndex < 0) {
    return false;
  }

  lists.value = lists.value.filter((list) => list.id !== targetId);

  const reassignTasks = (collection) =>
    collection.map((entry) =>
      entry.listId === targetId ? { ...entry, listId: DEFAULT_LIST_ID } : entry
    );

  tasks.value = reassignTasks(Array.isArray(tasks.value) ? tasks.value : []);
  completedTasks.value = reassignTasks(
    Array.isArray(completedTasks.value) ? completedTasks.value : []
  );

  return true;
};

const duplicateTask = (taskId) => {
  const originalIndex = tasks.value.findIndex((item) => item.id === taskId);
  if (originalIndex < 0) {
    return null;
  }

  const original = tasks.value[originalIndex];
  const duplicatedTask = {
    id: initialId++,
    title: original.title,
    description: original.description ?? '',
    completed: false,
    due: original.due ?? null,
    recurrence: original.recurrence ?? null,
    listId: normalizeListId(original.listId),
  };

  const updatedTasks = [...tasks.value];
  updatedTasks.splice(originalIndex + 1, 0, duplicatedTask);
  tasks.value = updatedTasks;
  return duplicatedTask;
};

const tasksOverdue = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const todayStart = getStartOfDay(currentTime.value);

  if (!(todayStart instanceof Date) || Number.isNaN(todayStart.valueOf())) {
    return [];
  }

  const todayStartTimestamp = todayStart.getTime();

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueTime = Date.parse(task.due);

    if (Number.isNaN(dueTime)) {
      return false;
    }

    return dueTime < todayStartTimestamp;
  });
});

const tasksDueToday = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const todayStart = getStartOfDay(currentTime.value);

  if (!(todayStart instanceof Date) || Number.isNaN(todayStart.valueOf())) {
    return [];
  }

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const todayStartTimestamp = todayStart.getTime();
  const tomorrowStartTimestamp = tomorrowStart.getTime();

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueTimestamp = Date.parse(task.due);

    if (Number.isNaN(dueTimestamp)) {
      return false;
    }

    return dueTimestamp >= todayStartTimestamp && dueTimestamp < tomorrowStartTimestamp;
  });
});

const tasksDueTodayPastDue = computed(() => {
  const now = currentTime.value;
  const todayTasks = Array.isArray(tasksDueToday.value) ? tasksDueToday.value : [];
  return todayTasks.filter((task) => {
    const dueTimestamp = Date.parse(task?.due ?? '');
    return !Number.isNaN(dueTimestamp) && dueTimestamp < now;
  });
});

const tasksDueTodayUpcoming = computed(() => {
  const now = currentTime.value;
  const todayTasks = Array.isArray(tasksDueToday.value) ? tasksDueToday.value : [];
  return todayTasks.filter((task) => {
    const dueTimestamp = Date.parse(task?.due ?? '');
    return !Number.isNaN(dueTimestamp) && dueTimestamp >= now;
  });
});

const activeTasks = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  return currentTasks.filter((task) => task && !task.completed);
});

const activeCountsByList = computed(() => {
  const counts = {};
  lists.value.forEach((list) => {
    counts[list.id] = 0;
  });

  (Array.isArray(tasks.value) ? tasks.value : []).forEach((task) => {
    if (!task || task.completed) {
      return;
    }
    const targetListId = normalizeListId(task.listId);
    counts[targetListId] = (counts[targetListId] ?? 0) + 1;
  });

  return counts;
});

const tasksDueTomorrow = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const now = currentTime.value;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueDate = new Date(task.due);
    const dueTimestamp = dueDate.getTime();

    if (Number.isNaN(dueTimestamp) || dueTimestamp < now) {
      return false;
    }

    return dueDate.getFullYear() === tomorrow.getFullYear()
      && dueDate.getMonth() === tomorrow.getMonth()
      && dueDate.getDate() === tomorrow.getDate();
  });
});

const tasksCompletedYesterday = computed(() => {
  const entries = Array.isArray(completedTasks.value) ? completedTasks.value : [];
  const todayStartDate = getStartOfDay(currentTime.value);

  if (!(todayStartDate instanceof Date) || Number.isNaN(todayStartDate.valueOf())) {
    return [];
  }

  const yesterdayStartDate = new Date(todayStartDate);
  yesterdayStartDate.setDate(todayStartDate.getDate() - 1);

  const startTimestamp = yesterdayStartDate.getTime();
  const endTimestamp = todayStartDate.getTime();

  return entries
    .filter((entry) => {
      const completedTimestamp = Date.parse(entry?.completedAt ?? '');
      if (Number.isNaN(completedTimestamp)) {
        return false;
      }
      return completedTimestamp >= startTimestamp && completedTimestamp < endTimestamp;
    })
    .sort((a, b) => {
      const aTime = Date.parse(a?.completedAt ?? '');
      const bTime = Date.parse(b?.completedAt ?? '');

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return 0;
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
      return -1;
    }
    return bTime - aTime;
  });
});

const tasksCompletedToday = computed(() => {
  const entries = Array.isArray(completedTasks.value) ? completedTasks.value : [];
  const todayStartDate = getStartOfDay(currentTime.value);

  if (!(todayStartDate instanceof Date) || Number.isNaN(todayStartDate.valueOf())) {
    return [];
  }

  const tomorrowStartDate = new Date(todayStartDate);
  tomorrowStartDate.setDate(todayStartDate.getDate() + 1);

  const startTimestamp = todayStartDate.getTime();
  const endTimestamp = tomorrowStartDate.getTime();

  return entries
    .filter((entry) => {
      const completedTimestamp = Date.parse(entry?.completedAt ?? '');
      if (Number.isNaN(completedTimestamp)) {
        return false;
      }
      return completedTimestamp >= startTimestamp && completedTimestamp < endTimestamp;
    })
    .sort((a, b) => {
      const aTime = Date.parse(a?.completedAt ?? '');
      const bTime = Date.parse(b?.completedAt ?? '');

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return 0;
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }
      return bTime - aTime;
    });
});

const sortedCompletedTasks = computed(() => {
  return [...completedTasks.value].sort((a, b) => {
    const aTime = Date.parse(a.completedAt ?? '');
    const bTime = Date.parse(b.completedAt ?? '');

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }

    return bTime - aTime;
  });
});

const loadFromStorage = async () => {
  try {
    const parsedLists = await readJsonFile(LISTS_FILE_NAME, null);
    if (Array.isArray(parsedLists)) {
      const sanitized = parsedLists
        .map((entry, index) => {
          const id =
            typeof entry?.id === 'string' && entry.id.trim().length > 0
              ? entry.id.trim()
              : `list-${index + 1}`;
          const name =
            typeof entry?.name === 'string' && entry.name.trim().length > 0
              ? entry.name.trim()
              : `List ${index + 1}`;
          return { id, name };
        })
        .filter(
          (item, index, array) => array.findIndex((other) => other.id === item.id) === index
        );
      lists.value = sanitized.length > 0 ? sanitized : [DEFAULT_LIST];
    } else {
      lists.value = [DEFAULT_LIST];
    }
  } catch (error) {
    console.error('Failed to load lists from JSON storage', error);
    lists.value = [DEFAULT_LIST];
  }

  ensureDefaultList();

  try {
    const parsed = await readJsonFile(TASKS_FILE_NAME, []);

    if (Array.isArray(parsed)) {
      tasks.value = parsed.map((task, index) => ({
        id: task.id ?? index + 1,
        title: typeof task.title === 'string' ? task.title : 'Untitled task',
        description: typeof task.description === 'string' ? task.description : '',
        completed: Boolean(task.completed),
        due: task.due ?? null,
        recurrence: normalizeRecurrence(task.recurrence),
        listId: normalizeListId(task.listId),
      }));
    } else {
      tasks.value = [];
    }
  } catch (error) {
    console.error('Failed to load tasks from JSON storage', error);
    tasks.value = [];
  }

  try {
    const parsedCompleted = await readJsonFile(COMPLETED_TASKS_FILE_NAME, []);

    if (Array.isArray(parsedCompleted)) {
      completedTasks.value = parsedCompleted.map((entry) => ({
        taskId: entry.taskId,
        title: entry.title ?? 'Untitled task',
        description: entry.description ?? '',
        due: entry.due ?? null,
        completedAt: entry.completedAt ?? new Date().toISOString(),
        recurrence: normalizeRecurrence(entry.recurrence),
        listId: normalizeListId(entry.listId),
      }));
    } else {
      completedTasks.value = [];
    }
  } catch (error) {
    console.error('Failed to load completed tasks from JSON storage', error);
    completedTasks.value = [];
  }

  ensureDefaultList();
  syncInitialId();

  tasks.value.forEach((task) => {
    if (task.completed && !completedTasks.value.some((entry) => entry.taskId === task.id)) {
      recordCompletion(task);
    }
  });
};

watch(
  tasks,
  () => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistTasks(tasks.value);
    checkDueTasks();
  },
  { deep: true }
);

watch(
  completedTasks,
  () => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistCompletedTasks(completedTasks.value);
  },
  { deep: true }
);

watch(
  lists,
  () => {
    ensureDefaultList();
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistLists(lists.value);
  },
  { deep: true }
);

watch(
  notifications,
  (current) => {
    const activeIds = new Set(
      (Array.isArray(current) ? current : []).map((notification) => notification?.id)
    );

    Array.from(completionNotificationIds.entries()).forEach(([taskId, noteId]) => {
      if (!activeIds.has(noteId)) {
        completionNotificationIds.delete(taskId);
      }
    });
  },
  { deep: false }
);

const initialize = async () => {
  if (isInitialized) {
    return;
  }

  startCurrentTimeTicker();
  await loadFromStorage();
  await Promise.all([
    persistTasks(tasks.value),
    persistCompletedTasks(completedTasks.value),
    persistLists(lists.value),
  ]);
  checkDueTasks();
  startDueWatcher();
  setupBroadcastChannel();
  watchersReady = true;
  isInitialized = true;
};

const teardown = () => {
  stopDueWatcher();
  stopCurrentTimeTicker();
  teardownBroadcastChannel();
};

export const useTaskStore = () => {
  initialize().catch((error) => {
    console.error('Failed to initialize task store', error);
  });

  return {
    tasks,
    completedTasks,
    lists,
    tasksOverdue,
    tasksDueToday,
    tasksDueTodayPastDue,
    tasksDueTodayUpcoming,
    tasksDueTomorrow,
    tasksCompletedYesterday,
    tasksCompletedToday,
    activeTasks,
    activeCountsByList,
    sortedCompletedTasks,
    notifications,
    dismissNotification,
    addList,
    removeList,
    addTask,
    reviveCompletedTask,
    deleteCompletedTask,
    updateCompletedTaskTimestamp,
    duplicateTask,
    updateTask,
    reorderTask,
    toggleTaskCompletion,
    removeTask,
    moveTaskToToday,
    moveTaskToTomorrow,
    moveOverdueTasksToToday,
    postponeTasksUntil,
    skipTaskRecurrence,
    initialize,
    teardown,
    buildDueDate,
  };
};

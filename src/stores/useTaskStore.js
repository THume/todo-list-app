import { ref, computed, watch } from 'vue';
import { useTaskNotifications } from '../composables/useTaskNotifications';
import { readJsonFile, writeJsonFile } from '../services/jsonStorage';

const TASKS_FILE_NAME = 'tasks.json';
const LISTS_FILE_NAME = 'lists.json';
const COMPLETED_FILE_NAME = 'completed.json';
const DEFAULT_LIST_ID = 'default';
const DEFAULT_LIST_NAME = 'My Tasks';
const DEFAULT_LIST = Object.freeze({
  id: DEFAULT_LIST_ID,
  name: DEFAULT_LIST_NAME,
});

const tasks = ref([]);
const lists = ref([DEFAULT_LIST]);
const completedTasks = ref([]);
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
  dismissNotification: baseDismissNotification,
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
let completedInitialId = 1;
let subtaskInitialId = 1;
let storageReadFailed = false;
const completionNotificationIds = new Map();
const reviveNotificationIds = new Map();
const spawnedRecurringTaskIds = new Map();
let broadcastChannel = null;
let isApplyingRemoteUpdate = false;
const dismissNotification = (id) => {
  baseDismissNotification(id);
  completionNotificationIds.forEach((notificationId, completedId) => {
    if (notificationId === id) {
      completionNotificationIds.delete(completedId);
    }
  });
};

const VALID_RECURRENCE = new Set(['daily', 'weekdays', 'weekly', 'monthly', 'quarterly', 'yearly']);
const VALID_REMINDER_MINUTES = new Set([5, 10, 15, 30, 60, 120, 240, 1440]);

const createListId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  listInitialId += 1;
  return `list-${Date.now()}-${listInitialId}`;
};

const createSubtaskId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  subtaskInitialId += 1;
  return `subtask-${Date.now()}-${subtaskInitialId}`;
};

const createCompletedId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  completedInitialId += 1;
  return `completed-${Date.now()}-${completedInitialId}`;
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

const sanitizeSubtasks = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();

  return value
    .map((entry, index) => {
      const title =
        typeof entry?.title === 'string' && entry.title.trim().length > 0
          ? entry.title.trim()
          : '';

      if (!title) {
        return null;
      }

      let id =
        typeof entry?.id === 'string' && entry.id.trim().length > 0
          ? entry.id.trim()
          : `subtask-${index + 1}`;

      if (seen.has(id)) {
        id = `${id}-${index + 1}`;
        if (seen.has(id)) {
          return null;
        }
      }

      seen.add(id);

      return {
        id,
        title,
        completed: Boolean(entry?.completed),
      };
    })
    .filter(Boolean);
};

const areAllSubtasksCompleted = (subtasks) =>
  Array.isArray(subtasks) && subtasks.length > 0 && subtasks.every((item) => item?.completed);

const sanitizeCompletedEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  const seen = new Set();

  return entries
    .map((entry, index) => {
      const id =
        typeof entry?.id === 'string' && entry.id.trim().length > 0
          ? entry.id.trim()
          : `completed-${index + 1}`;
      if (seen.has(id)) {
        return null;
      }
      seen.add(id);

      const taskId =
        typeof entry?.taskId === 'number' || typeof entry?.taskId === 'string'
          ? entry.taskId
          : null;

      const completedAtValue = entry?.completedAt ?? entry?.completed_at ?? null;
      const completedAtDate = completedAtValue ? new Date(completedAtValue) : null;
      const completedAt = completedAtDate && !Number.isNaN(completedAtDate.valueOf())
        ? completedAtDate.toISOString()
        : null;

      return {
        id,
        taskId,
        title: typeof entry?.title === 'string' ? entry.title : 'Untitled task',
        description: typeof entry?.description === 'string' ? entry.description : '',
        completed: true,
        workedOn: Boolean(entry?.workedOn ?? entry?.worked_on),
        completedAt,
        due: entry?.due ?? null,
        recurrence: normalizeRecurrence(entry?.recurrence),
        listId: normalizeListId(entry?.listId),
        reminderOffsetMinutes: entry?.reminderOffsetMinutes ?? null,
        completionNotes: typeof entry?.completionNotes === 'string' ? entry.completionNotes : '',
        subtasks: sanitizeSubtasks(entry?.subtasks).map((subtask) => ({
          ...subtask,
          completed: Boolean(subtask.completed),
        })),
      };
    })
    .filter(Boolean);
};

const applyCompletionState = (task, completed) => {
  const updatedTask = { ...task, completed };

  if (completed) {
    updatedTask.completedAt = new Date().toISOString();
  } else {
    delete updatedTask.completedAt;
  }

  return updatedTask;
};

const removeSpawnedRecurringTask = (taskId, updatedTasks) => {
  const spawnedId = spawnedRecurringTaskIds.get(taskId);
  if (spawnedId === undefined) {
    return;
  }
  const removalIndex = updatedTasks.findIndex((item) => item?.id === spawnedId);
  if (removalIndex >= 0) {
    updatedTasks.splice(removalIndex, 1);
  }
  spawnedRecurringTaskIds.delete(taskId);
};

const applyRecurringTransition = (updatedTasks, updatedTask) => {
  if (updatedTask.completed) {
    const nextTask = createRecurringTask(updatedTask);

    if (nextTask) {
      spawnedRecurringTaskIds.set(updatedTask.id, nextTask.id);
      updatedTasks.push(nextTask);
    } else {
      spawnedRecurringTaskIds.delete(updatedTask.id);
    }
    return;
  }

  removeSpawnedRecurringTask(updatedTask.id, updatedTasks);
};

const buildCompletedEntry = (task, completedAt = null, { workedOn = false } = {}) => {
  const resolvedCompletedAt = completedAt
    ? new Date(completedAt)
    : new Date(task.completedAt ?? Date.now());

  return {
    id: createCompletedId(),
    taskId: task.id,
    title: task.title,
    description: task.description ?? '',
    completed: true,
    workedOn: Boolean(workedOn),
    completedAt: Number.isNaN(resolvedCompletedAt.valueOf())
      ? new Date().toISOString()
      : resolvedCompletedAt.toISOString(),
    due: task.due ?? null,
    recurrence: normalizeRecurrence(task.recurrence),
    listId: normalizeListId(task.listId),
    reminderOffsetMinutes: normalizeReminderOffsetMinutes(task.reminderOffsetMinutes),
    completionNotes: typeof task?.completionNotes === 'string' ? task.completionNotes : '',
    subtasks: sanitizeSubtasks(task.subtasks).map((subtask) => ({ ...subtask, completed: true })),
  };
};

const dismissCompletionNotification = (completedId) => {
  const existingNotificationId = completionNotificationIds.get(completedId);
  if (existingNotificationId) {
    dismissNotification(existingNotificationId);
    completionNotificationIds.delete(completedId);
  }
};

const notifyCompletedTask = (entry) => {
  if (!entry?.id) {
    return;
  }

  const message = `Task "${entry.title}" completed`;
  const notificationId = pushNotification(message, {
    actions: [
      {
        type: 'undo-completed-task',
        label: 'Undo',
        payload: { completedId: entry.id, taskId: entry.taskId },
      },
      {
        type: 'add-completion-notes',
        label: 'Add Notes',
        payload: { completedId: entry.id },
      },
    ],
  });
  completionNotificationIds.set(entry.id, notificationId);
};

const addCompletedEntry = (entry, { notify = true } = {}) => {
  completedTasks.value = [...completedTasks.value, entry];
  if (notify) {
    notifyCompletedTask(entry);
  }
};

const updateCompletedTaskNotes = (completedId, notes) => {
  const targetIndex = completedTasks.value.findIndex((entry) => entry.id === completedId);
  if (targetIndex < 0) {
    return false;
  }
  const normalizedNotes = typeof notes === 'string' ? notes.trim() : '';
  const updated = [...completedTasks.value];
  updated[targetIndex] = { ...updated[targetIndex], completionNotes: normalizedNotes };
  completedTasks.value = updated;
  return true;
};

const startCurrentTimeTicker = () => {
  currentTime.value = Date.now();

  if (currentTimeTimer !== null) {
    return;
  }

  currentTimeTimer = window.setInterval(() => {
    currentTime.value = Date.now();
  }, 60000);
};

const stopCurrentTimeTicker = () => {
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

const normalizeReminderOffsetMinutes = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.round(numeric);
  if (rounded <= 0) {
    return null;
  }
  if (VALID_REMINDER_MINUTES.has(rounded)) {
    return rounded;
  }
  return null;
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

const persistCompleted = async (value) => {
  try {
    await writeJsonFile(COMPLETED_FILE_NAME, value);
    if (watchersReady && !isApplyingRemoteUpdate) {
      postStorageUpdate();
    }
  } catch (error) {
    console.error('Failed to persist completed tasks to JSON file', error);
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
  if (typeof window.BroadcastChannel === 'undefined' || broadcastChannel) {
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
  const taskMax = tasks.value.reduce((acc, task) => Math.max(acc, Number(task.id) || 0), 0);
  const completedMax = completedTasks.value.reduce(
    (acc, entry) => Math.max(acc, Number(entry.taskId) || 0),
    0
  );
  const maxId = Math.max(taskMax, completedMax);
  initialId = maxId + 1;
};

const syncCompletedInitialId = () => {
  const maxId = completedTasks.value.reduce(
    (acc, entry) => Math.max(acc, Number(entry.id) || 0),
    0
  );
  completedInitialId = maxId + 1;
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
    reminderOffsetMinutes: normalizeReminderOffsetMinutes(task.reminderOffsetMinutes),
    subtasks: [],
  };
};

const updateCompletedTaskTimestamp = (taskId, completedAt) => {
  const entryIndex = completedTasks.value.findIndex((task) => task.id === taskId);
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

  const updated = [...completedTasks.value];
  updated[entryIndex] = {
    ...updated[entryIndex],
    completedAt: resolvedDate.toISOString(),
  };
  completedTasks.value = updated;

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

const markTaskWorkedOn = (taskId, { dayOffset = 1 } = {}) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === taskId);
  if (targetIndex < 0) {
    return null;
  }

  const targetTask = tasks.value[targetIndex];
  if (!targetTask || targetTask.completed) {
    return null;
  }

  const recurrence = normalizeRecurrence(targetTask.recurrence);
  const completedEntry = buildCompletedEntry(targetTask, null, { workedOn: true });
  addCompletedEntry(completedEntry);

  if (recurrence) {
    const updatedTasks = [...tasks.value];
    updatedTasks.splice(targetIndex, 1);

    const nextTask = createRecurringTask(targetTask);
    if (nextTask) {
      spawnedRecurringTaskIds.set(targetTask.id, nextTask.id);
      updatedTasks.push(nextTask);
    } else {
      spawnedRecurringTaskIds.delete(targetTask.id);
    }

    tasks.value = updatedTasks;
    syncInitialId();
    syncCompletedInitialId();
    return nextTask;
  }

  const hasDue = Boolean(targetTask.due);
  let nextDue = null;

  if (hasDue) {
    const nextStart = getStartOfDay(currentTime.value);
    nextStart.setDate(nextStart.getDate() + Math.max(0, Number(dayOffset) || 0));
    nextDue = buildDueIsoForTargetDate(targetTask, nextStart);
  }

  const duplicate = {
    id: initialId++,
    title: targetTask.title,
    description: targetTask.description ?? '',
    completed: false,
    due: nextDue,
    recurrence: normalizeRecurrence(targetTask.recurrence),
    listId: normalizeListId(targetTask.listId),
    reminderOffsetMinutes: nextDue
      ? normalizeReminderOffsetMinutes(targetTask.reminderOffsetMinutes)
      : null,
    subtasks: sanitizeSubtasks(targetTask.subtasks).map((subtask) => ({
      ...subtask,
      completed: false,
    })),
  };

  const updatedTasks = [...tasks.value];
  updatedTasks.splice(targetIndex, 1, duplicate);
  tasks.value = updatedTasks;

  syncInitialId();
  syncCompletedInitialId();

  return duplicate;
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

const addTask = ({
  title,
  description,
  dueDate,
  dueTime,
  recurrence,
  listId,
  reminderOffsetMinutes,
  completed = false,
  subtasks = [],
}) => {
  const due = buildDueDate(dueDate, dueTime);
  const recurrenceValue = normalizeRecurrence(recurrence);
  const normalizedSubtasks = sanitizeSubtasks(subtasks);
  const resolvedSubtasks =
    Boolean(completed) && normalizedSubtasks.length > 0
      ? normalizedSubtasks.map((subtask) => ({ ...subtask, completed: true }))
      : normalizedSubtasks;
  const hasIncompleteSubtasks =
    resolvedSubtasks.length > 0 && !areAllSubtasksCompleted(resolvedSubtasks);
  const isCompleted = Boolean(completed) && !hasIncompleteSubtasks;
  const reminderValue = due ? normalizeReminderOffsetMinutes(reminderOffsetMinutes) : null;
  const newTask = {
    id: initialId++,
    title,
    description,
    completed: isCompleted,
    due,
    recurrence: recurrenceValue,
    listId: normalizeListId(listId),
    reminderOffsetMinutes: reminderValue,
    subtasks: resolvedSubtasks,
  };

  if (isCompleted) {
    newTask.completedAt = new Date().toISOString();
    const completedEntry = buildCompletedEntry(newTask);
    addCompletedEntry(completedEntry);
    const nextTask = createRecurringTask(newTask);
    if (nextTask) {
      spawnedRecurringTaskIds.set(newTask.id, nextTask.id);
      tasks.value = [...tasks.value, nextTask];
    }
    syncInitialId();
    syncCompletedInitialId();
    return;
  }

  tasks.value = [...tasks.value, newTask];
};

const updateTask = ({
  id,
  title,
  description,
  dueDate,
  dueTime,
  recurrence,
  listId,
  reminderOffsetMinutes,
  subtasks,
}) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === id);
  if (targetIndex < 0) {
    return false;
  }

  const target = tasks.value[targetIndex];
  if (target.completed) {
    return false;
  }

  const resolvedReminder =
    reminderOffsetMinutes === undefined
      ? target.reminderOffsetMinutes
      : normalizeReminderOffsetMinutes(reminderOffsetMinutes);
  const resolvedSubtasks =
    subtasks === undefined ? sanitizeSubtasks(target.subtasks) : sanitizeSubtasks(subtasks);

  const nextTasks = [...tasks.value];
  const updatedTask = {
    ...target,
    title: typeof title === 'string' && title.trim().length > 0 ? title : target.title,
    description: typeof description === 'string' ? description : target.description,
    due: buildDueDate(dueDate, dueTime),
    recurrence: normalizeRecurrence(recurrence),
    listId: normalizeListId(listId ?? target.listId),
    reminderOffsetMinutes: resolvedReminder,
    subtasks: resolvedSubtasks,
  };

  if (!dueDate) {
    updatedTask.due = null;
    updatedTask.reminderOffsetMinutes = null;
  }

  const resolvedCompleted = updatedTask.subtasks.length > 0
    ? areAllSubtasksCompleted(updatedTask.subtasks)
    : updatedTask.completed;

  const completionAdjusted = applyCompletionState(updatedTask, resolvedCompleted);

  if (resolvedCompleted) {
    nextTasks.splice(targetIndex, 1);
    const completedEntry = buildCompletedEntry(completionAdjusted);
    const nextTask = createRecurringTask(completionAdjusted);
    if (nextTask) {
      spawnedRecurringTaskIds.set(completionAdjusted.id, nextTask.id);
      nextTasks.push(nextTask);
    } else {
      spawnedRecurringTaskIds.delete(completionAdjusted.id);
    }
    tasks.value = nextTasks;
    addCompletedEntry(completedEntry);
    syncInitialId();
    syncCompletedInitialId();
    return true;
  }

  nextTasks[targetIndex] = completionAdjusted;
  removeSpawnedRecurringTask(completionAdjusted.id, nextTasks);
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

const toggleTaskCompletion = (taskId, { suppressNotification = false } = {}) => {
  const targetIndex = tasks.value.findIndex((item) => item?.id === taskId);
  if (targetIndex < 0) {
    return;
  }

  const originalTask = tasks.value[targetIndex];
  if (!originalTask) {
    return;
  }

  const updatedTasks = [...tasks.value];
  updatedTasks.splice(targetIndex, 1);

  const completedEntry = buildCompletedEntry(
    applyCompletionState(
      { ...originalTask, subtasks: sanitizeSubtasks(originalTask.subtasks) },
      true
    )
  );

  const nextTasks = [...updatedTasks];
  const nextTask = createRecurringTask(originalTask);
  if (nextTask) {
    spawnedRecurringTaskIds.set(originalTask.id, nextTask.id);
    nextTasks.push(nextTask);
  } else {
    spawnedRecurringTaskIds.delete(originalTask.id);
  }

  tasks.value = nextTasks;
  addCompletedEntry(completedEntry, { notify: !suppressNotification });
  syncInitialId();
  syncCompletedInitialId();
};

const addSubtask = (taskId, title) => {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (trimmed.length === 0) {
    return null;
  }

  const taskIndex = tasks.value.findIndex((task) => task?.id === taskId);
  if (taskIndex < 0) {
    return null;
  }

  const targetTask = tasks.value[taskIndex];
  const existingSubtasks = sanitizeSubtasks(targetTask.subtasks);
  const newSubtask = {
    id: createSubtaskId(),
    title: trimmed,
    completed: false,
  };

  const updatedTasks = [...tasks.value];
  const updatedTask = applyCompletionState(
    {
      ...targetTask,
      subtasks: [...existingSubtasks, newSubtask],
    },
    false
  );
  updatedTasks[taskIndex] = updatedTask;
  removeSpawnedRecurringTask(updatedTask.id, updatedTasks);
  tasks.value = updatedTasks;
  return newSubtask;
};

const toggleSubtaskCompletion = (taskId, subtaskId) => {
  const taskIndex = tasks.value.findIndex((task) => task?.id === taskId);
  if (taskIndex < 0) {
    return false;
  }

  const targetTask = tasks.value[taskIndex];
  const normalizedSubtasks = sanitizeSubtasks(targetTask.subtasks);
  const subtaskIndex = normalizedSubtasks.findIndex((entry) => entry.id === subtaskId);

  if (subtaskIndex < 0) {
    return false;
  }

  const nextSubtasks = [...normalizedSubtasks];
  nextSubtasks[subtaskIndex] = {
    ...nextSubtasks[subtaskIndex],
    completed: !nextSubtasks[subtaskIndex].completed,
  };

  const updatedTasks = [...tasks.value];
  let updatedTask = { ...targetTask, subtasks: nextSubtasks };

  if (areAllSubtasksCompleted(nextSubtasks)) {
    updatedTask = applyCompletionState(updatedTask, true);
    updatedTasks.splice(taskIndex, 1);
    const completedEntry = buildCompletedEntry(updatedTask);
    const nextTask = createRecurringTask(updatedTask);
    if (nextTask) {
      spawnedRecurringTaskIds.set(updatedTask.id, nextTask.id);
      updatedTasks.push(nextTask);
    } else {
      spawnedRecurringTaskIds.delete(updatedTask.id);
    }
    tasks.value = updatedTasks;
    addCompletedEntry(completedEntry);
    syncInitialId();
    syncCompletedInitialId();
  } else {
    updatedTask = applyCompletionState(updatedTask, false);
    updatedTasks[taskIndex] = updatedTask;
    removeSpawnedRecurringTask(updatedTask.id, updatedTasks);
    tasks.value = updatedTasks;
  }

  return true;
};

const removeTask = (taskId) => {
  tasks.value = tasks.value.filter((item) => item.id !== taskId);
  spawnedRecurringTaskIds.delete(taskId);

  Array.from(spawnedRecurringTaskIds.entries()).forEach(([originId, spawnedId]) => {
    if (spawnedId === taskId) {
      spawnedRecurringTaskIds.delete(originId);
    }
  });
};

const reviveCompletedTask = (taskId, { suppressNotification = false } = {}) => {
  const completedIndex = completedTasks.value.findIndex((task) => task.id === taskId);
  if (completedIndex < 0) {
    return false;
  }

  const entry = completedTasks.value[completedIndex];
  dismissCompletionNotification(entry.id);
  const candidateId = entry.taskId ?? null;
  const idInUse = tasks.value.some((task) => task.id === candidateId);
  const restoredId =
    candidateId && !idInUse && (typeof candidateId === 'number' || typeof candidateId === 'string')
      ? candidateId
      : initialId++;

  const restoredTask = {
    id: restoredId,
    title: entry.title ?? 'Untitled task',
    description: entry.description ?? '',
    completed: false,
    due: entry.due ?? null,
    recurrence: normalizeRecurrence(entry.recurrence),
    listId: normalizeListId(entry.listId),
    reminderOffsetMinutes: normalizeReminderOffsetMinutes(entry.reminderOffsetMinutes),
    subtasks: sanitizeSubtasks(entry.subtasks).map((subtask) => ({
      ...subtask,
      completed: false,
    })),
  };

  const nextCompleted = [...completedTasks.value];
  nextCompleted.splice(completedIndex, 1);
  completedTasks.value = nextCompleted;

  const nextTasks = [...tasks.value, restoredTask];
  removeSpawnedRecurringTask(restoredTask.id, nextTasks);
  tasks.value = nextTasks;

  if (!suppressNotification) {
    const message = `Task "${restoredTask.title}" was revived`;
    const notificationId = pushNotification(message, {
      action: {
        type: 'undo-revive-task',
        label: 'Undo',
        payload: { taskId: restoredTask.id },
      },
    });
    reviveNotificationIds.set(restoredTask.id, notificationId);
  } else {
    const existingNotificationId = reviveNotificationIds.get(restoredTask.id);
    if (existingNotificationId) {
      dismissNotification(existingNotificationId);
      reviveNotificationIds.delete(restoredTask.id);
    }
  }

  syncInitialId();
  return true;
};

const deleteCompletedTask = (taskId) => {
  const nextCompleted = completedTasks.value.filter((entry) => entry.id !== taskId);
  if (nextCompleted.length === completedTasks.value.length) {
    return false;
  }

  dismissCompletionNotification(taskId);
  completedTasks.value = nextCompleted;
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

const reorderList = ({ id, beforeId = null }) => {
  const current = Array.isArray(lists.value) ? [...lists.value] : [];
  const currentIndex = current.findIndex((list) => list.id === id);

  if (currentIndex < 0) {
    return false;
  }

  const [moving] = current.splice(currentIndex, 1);

  let targetIndex;
  if (!beforeId) {
    targetIndex = current.length;
  } else {
    targetIndex = current.findIndex((list) => list.id === beforeId);
    if (targetIndex < 0) {
      targetIndex = current.length;
    }
  }

  current.splice(targetIndex, 0, moving);
  lists.value = current;
  return true;
};

const renameList = (listId, name) => {
  const targetId = typeof listId === 'string' ? listId.trim() : '';
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (!targetId || trimmed.length === 0) {
    return false;
  }

  const existingIndex = lists.value.findIndex((list) => list.id === targetId);
  if (existingIndex < 0) {
    return false;
  }

  const duplicate = lists.value.some(
    (list, index) =>
      index !== existingIndex && list.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    return false;
  }

  const updated = [...lists.value];
  updated[existingIndex] = { ...updated[existingIndex], name: trimmed };
  lists.value = updated;
  return true;
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
    reminderOffsetMinutes: normalizeReminderOffsetMinutes(original.reminderOffsetMinutes),
    subtasks: sanitizeSubtasks(original.subtasks).map((subtask) => ({
      ...subtask,
      completed: false,
    })),
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
  const completedTasksList = Array.isArray(completedTasks.value) ? completedTasks.value : [];
  const todayStartDate = getStartOfDay(currentTime.value);

  if (!(todayStartDate instanceof Date) || Number.isNaN(todayStartDate.valueOf())) {
    return [];
  }

  const yesterdayStartDate = new Date(todayStartDate);
  yesterdayStartDate.setDate(todayStartDate.getDate() - 1);

  const startTimestamp = yesterdayStartDate.getTime();
  const endTimestamp = todayStartDate.getTime();

  return completedTasksList
    .filter((task) => {
      const completedTimestamp = Date.parse(task?.completedAt ?? '');
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
  const completedTasksList = Array.isArray(completedTasks.value) ? completedTasks.value : [];
  const todayStartDate = getStartOfDay(currentTime.value);

  if (!(todayStartDate instanceof Date) || Number.isNaN(todayStartDate.valueOf())) {
    return [];
  }

  const tomorrowStartDate = new Date(todayStartDate);
  tomorrowStartDate.setDate(todayStartDate.getDate() + 1);

  const startTimestamp = todayStartDate.getTime();
  const endTimestamp = tomorrowStartDate.getTime();

  return completedTasksList
    .filter((task) => {
      const completedTimestamp = Date.parse(task?.completedAt ?? '');
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

const loadFromStorage = async () => {
  try {
    const listsResult = await readJsonFile(LISTS_FILE_NAME, null);
    if (!listsResult.ok) {
      storageReadFailed = true;
    }
    const parsedLists = listsResult.data;
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
    storageReadFailed = true;
    lists.value = [DEFAULT_LIST];
  }

  ensureDefaultList();

  try {
    const completedResult = await readJsonFile(COMPLETED_FILE_NAME, []);
    if (!completedResult.ok) {
      storageReadFailed = true;
    }
    completedTasks.value = sanitizeCompletedEntries(completedResult.data);
  } catch (error) {
    console.error('Failed to load completed tasks from JSON storage', error);
    storageReadFailed = true;
    completedTasks.value = [];
  }

  try {
    const tasksResult = await readJsonFile(TASKS_FILE_NAME, []);
    if (!tasksResult.ok) {
      storageReadFailed = true;
    }
    const parsed = tasksResult.data;

    if (Array.isArray(parsed)) {
      const active = [];
      const migratedCompleted = [];

      parsed.forEach((task, index) => {
        const base = {
          id: task.id ?? index + 1,
          title: typeof task.title === 'string' ? task.title : 'Untitled task',
          description: typeof task.description === 'string' ? task.description : '',
          completed: Boolean(task.completed),
          completedAt: task.completedAt ?? task.completed_at ?? null,
          due: task.due ?? null,
          recurrence: normalizeRecurrence(task.recurrence),
          listId: normalizeListId(task.listId),
          reminderOffsetMinutes:
            task.due !== null ? normalizeReminderOffsetMinutes(task.reminderOffsetMinutes) : null,
          subtasks: sanitizeSubtasks(task.subtasks),
        };

        if (base.completed) {
          migratedCompleted.push(buildCompletedEntry(base, base.completedAt));
        } else {
          active.push(base);
        }
      });

      tasks.value = active;
      if (migratedCompleted.length > 0) {
        completedTasks.value = [...completedTasks.value, ...migratedCompleted];
      }
    } else {
      tasks.value = [];
    }
  } catch (error) {
    console.error('Failed to load tasks from JSON storage', error);
    storageReadFailed = true;
    tasks.value = [];
  }

  ensureDefaultList();
  syncInitialId();
  syncCompletedInitialId();
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
  completedTasks,
  () => {
    if (!watchersReady || isApplyingRemoteUpdate) {
      return;
    }
    persistCompleted(completedTasks.value);
  },
  { deep: true }
);

const initialize = async () => {
  if (isInitialized) {
    return;
  }

  startCurrentTimeTicker();
  storageReadFailed = false;
  await loadFromStorage();
  if (storageReadFailed) {
    console.warn('Skipping initial storage persist because reads failed.');
  }
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
    reorderList,
    removeList,
    renameList,
    addTask,
    reviveCompletedTask,
    deleteCompletedTask,
    updateCompletedTaskNotes,
    updateCompletedTaskTimestamp,
    duplicateTask,
    updateTask,
    reorderTask,
    toggleTaskCompletion,
    addSubtask,
    toggleSubtaskCompletion,
    removeTask,
    moveTaskToToday,
    moveTaskToTomorrow,
    markTaskWorkedOn,
    moveOverdueTasksToToday,
    postponeTasksUntil,
    skipTaskRecurrence,
    initialize,
    teardown,
    buildDueDate,
  };
};

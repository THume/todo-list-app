import { ref, computed, watch } from 'vue';
import { useTaskNotifications } from '../composables/useTaskNotifications';

const STORAGE_KEY = 'todo-list-app/tasks';
const COMPLETED_STORAGE_KEY = 'todo-list-app/completed-tasks';
const LISTS_STORAGE_KEY = 'todo-list-app/lists';
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
const {
  notifications,
  dismissNotification,
  startDueWatcher,
  stopDueWatcher,
  checkDueTasks,
} = useTaskNotifications(tasks);

let initialId = 1;
let isInitialized = false;
let watchersReady = false;
let currentTimeTimer = null;
let listInitialId = 1;

const VALID_RECURRENCE = new Set(['daily', 'weekdays', 'weekly', 'monthly']);

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

const persistTasks = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist tasks to localStorage', error);
  }
};

const persistCompletedTasks = (value) => {
  try {
    window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist completed tasks', error);
  }
};

const persistLists = (value) => {
  try {
    window.localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist lists', error);
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

const toggleTaskCompletion = (taskId) => {
  const targetIndex = tasks.value.findIndex((item) => item.id === taskId);
  if (targetIndex < 0) {
    return;
  }

  const target = tasks.value[targetIndex];
  target.completed = !target.completed;

  if (target.completed) {
    recordCompletion(target);
    const nextTask = createRecurringTask(target);
    const updatedTasks = [...tasks.value];

    if (nextTask) {
      updatedTasks.push(nextTask);
    }

    tasks.value = updatedTasks;
  } else {
    removeCompletion(target.id);
    tasks.value = [...tasks.value];
  }
};

const removeTask = (taskId) => {
  tasks.value = tasks.value.filter((item) => item.id !== taskId);
  removeCompletion(taskId);
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
  const now = currentTime.value;

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueTime = Date.parse(task.due);

    if (Number.isNaN(dueTime)) {
      return false;
    }

    return dueTime < now;
  });
});

const tasksDueToday = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const now = currentTime.value;
  const today = new Date(now);

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueDate = new Date(task.due);
    const dueTimestamp = dueDate.getTime();

    if (Number.isNaN(dueTimestamp)) {
      return false;
    }

    if (dueTimestamp < now) {
      return false;
    }

    return dueDate.getFullYear() === today.getFullYear()
      && dueDate.getMonth() === today.getMonth()
      && dueDate.getDate() === today.getDate();
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

const loadFromStorage = () => {
  try {
    const rawLists = window.localStorage.getItem(LISTS_STORAGE_KEY);
    if (rawLists) {
      const parsedLists = JSON.parse(rawLists);
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
        if (sanitized.length > 0) {
          lists.value = sanitized;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load lists from localStorage', error);
    lists.value = [DEFAULT_LIST];
  }

  ensureDefaultList();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);

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
      }
    }
  } catch (error) {
    console.error('Failed to load tasks from localStorage', error);
    tasks.value = [];
  }

  try {
    const completedRaw = window.localStorage.getItem(COMPLETED_STORAGE_KEY);
    if (completedRaw) {
      const parsedCompleted = JSON.parse(completedRaw);

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
      }
    }
  } catch (error) {
    console.error('Failed to load completed tasks', error);
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
    if (!watchersReady) {
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
    if (!watchersReady) {
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
    if (!watchersReady) {
      return;
    }
    persistLists(lists.value);
  },
  { deep: true }
);

const initialize = () => {
  if (isInitialized) {
    return;
  }

  startCurrentTimeTicker();
  loadFromStorage();
  persistTasks(tasks.value);
  persistCompletedTasks(completedTasks.value);
  persistLists(lists.value);
  checkDueTasks();
  startDueWatcher();
  watchersReady = true;
  isInitialized = true;
};

const teardown = () => {
  stopDueWatcher();
  stopCurrentTimeTicker();
};

export const useTaskStore = () => {
  initialize();

  return {
    tasks,
    completedTasks,
    lists,
    tasksOverdue,
    tasksDueToday,
    tasksDueTomorrow,
    activeTasks,
    activeCountsByList,
    sortedCompletedTasks,
    notifications,
    dismissNotification,
    addList,
    addTask,
    duplicateTask,
    updateTask,
    reorderTask,
    toggleTaskCompletion,
    removeTask,
    initialize,
    teardown,
    buildDueDate,
  };
};

import { ref, computed, watch } from 'vue';
import { useTaskNotifications } from '../composables/useTaskNotifications';

const STORAGE_KEY = 'todo-list-app/tasks';
const COMPLETED_STORAGE_KEY = 'todo-list-app/completed-tasks';

const tasks = ref([]);
const completedTasks = ref([]);

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

const VALID_RECURRENCE = new Set(['daily', 'weekdays', 'weekly', 'monthly']);

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

const addTask = ({ title, description, dueDate, dueTime, recurrence }) => {
  const due = buildDueDate(dueDate, dueTime);
  const recurrenceValue = normalizeRecurrence(recurrence);
  const newTask = {
    id: initialId++,
    title,
    description,
    completed: false,
    due,
    recurrence: recurrenceValue,
  };

  tasks.value = [...tasks.value, newTask];
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

const tasksDueToday = computed(() => {
  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const today = new Date();

  return currentTasks.filter((task) => {
    if (!task || task.completed || !task.due) {
      return false;
    }

    const dueDate = new Date(task.due);

    if (Number.isNaN(dueDate.getTime())) {
      return false;
    }

    return dueDate.getFullYear() === today.getFullYear()
      && dueDate.getMonth() === today.getMonth()
      && dueDate.getDate() === today.getDate();
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
        }));
      }
    }
  } catch (error) {
    console.error('Failed to load completed tasks', error);
    completedTasks.value = [];
  }

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

const initialize = () => {
  if (isInitialized) {
    return;
  }

  loadFromStorage();
  persistTasks(tasks.value);
  persistCompletedTasks(completedTasks.value);
  checkDueTasks();
  startDueWatcher();
  watchersReady = true;
  isInitialized = true;
};

const teardown = () => {
  stopDueWatcher();
};

export const useTaskStore = () => {
  initialize();

  return {
    tasks,
    completedTasks,
    tasksDueToday,
    sortedCompletedTasks,
    notifications,
    dismissNotification,
    addTask,
    toggleTaskCompletion,
    removeTask,
    initialize,
    teardown,
    buildDueDate,
  };
};

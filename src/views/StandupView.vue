<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import IconGlyph from '../components/IconGlyph.vue';
import { useTaskStore } from '../stores/useTaskStore';
import {
  getStorageSettings,
  updateStorageSettings,
  getStandupData,
  updateStandupData,
} from '../services/jsonStorage';

const STANDUP_HIDDEN_STORAGE_KEY = 'todo-list.standup-hidden';
const STANDUP_SHOW_ALL_STORAGE_KEY = 'todo-list.standup-show-all';

const {
  tasksDueToday,
  tasksCompletedToday,
  sortedCompletedTasks,
  lists,
} = useTaskStore();

const loadHiddenSet = () => {
  try {
    const raw = window.localStorage.getItem(STANDUP_HIDDEN_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((value) => typeof value === 'string'));
  } catch (error) {
    return new Set();
  }
};

const loadShowAll = () => {
  return window.localStorage.getItem(STANDUP_SHOW_ALL_STORAGE_KEY) === 'true';
};

const listNameById = computed(() => {
  const result = {};
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  availableLists.forEach((list) => {
    if (list && typeof list.id === 'string') {
      const name =
        typeof list.name === 'string' && list.name.trim().length > 0
          ? list.name.trim()
          : 'My Tasks';
      result[list.id] = name;
    }
  });
  if (!result.default) {
    result.default = 'My Tasks';
  }
  return result;
});

const resolveListName = (listId) => {
  if (typeof listId === 'string' && listId in listNameById.value) {
    return listNameById.value[listId];
  }
  return listNameById.value.default ?? 'My Tasks';
};

const standupDateLabel = computed(() => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
  }).format(new Date());
});

const toDateInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (
    Number.isNaN(year)
    || Number.isNaN(month)
    || Number.isNaN(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDefaultCompletedDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    // Skip weekends so we land on the previous workday (Mon-Fri)
    date.setDate(date.getDate() - 1);
  }
  return date;
};

const selectedCompletedStartDate = ref(toDateInputValue(getDefaultCompletedDate()));
const selectedCompletedEndDate = ref(toDateInputValue(getDefaultCompletedDate()));

const completedDateBounds = computed(() => {
  const startValue = parseDateInputValue(selectedCompletedStartDate.value);
  const endValue = parseDateInputValue(selectedCompletedEndDate.value);
  if (!startValue || !endValue) {
    return { start: null, end: null, startDate: null, endDate: null };
  }
  const [rangeStart, rangeEnd] =
    startValue.getTime() <= endValue.getTime()
      ? [startValue, endValue]
      : [endValue, startValue];
  const exclusiveEnd = new Date(rangeEnd);
  exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
  return {
    start: rangeStart.getTime(),
    end: exclusiveEnd.getTime(),
    startDate: rangeStart,
    endDate: rangeEnd,
  };
});

const selectedCompletedDateDisplay = computed(() => {
  const { startDate, endDate } = completedDateBounds.value;
  if (
    !(startDate instanceof Date)
    || !(endDate instanceof Date)
    || Number.isNaN(startDate.valueOf())
    || Number.isNaN(endDate.valueOf())
  ) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
  const startLabel = formatter.format(startDate);
  const endLabel = formatter.format(endDate);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
});

const selectedCompletedDateMessageLabel = computed(
  () => selectedCompletedDateDisplay.value || 'the selected date range'
);

const completedDateMax = computed(() => toDateInputValue(new Date()));

const showCompletedDateHint = computed(() => {
  const startSet = Boolean(parseDateInputValue(selectedCompletedStartDate.value));
  const endSet = Boolean(parseDateInputValue(selectedCompletedEndDate.value));
  return startSet === endSet;
});

const rawCompletedYesterday = computed(() => {
  const completedTasksList = Array.isArray(sortedCompletedTasks.value)
    ? sortedCompletedTasks.value
    : [];
  const { start, end } = completedDateBounds.value;
  if (typeof start !== 'number' || typeof end !== 'number') {
    return [];
  }
  return completedTasksList
    .filter((task) => {
      const completedTimestamp = Date.parse(task?.completedAt ?? '');
      if (Number.isNaN(completedTimestamp)) {
        return false;
      }
      return completedTimestamp >= start && completedTimestamp < end;
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

const rawCompletedToday = computed(() => {
  return Array.isArray(tasksCompletedToday.value)
    ? tasksCompletedToday.value
    : [];
});

const rawTodayTasks = computed(() => {
  const tasks = Array.isArray(tasksDueToday.value) ? [...tasksDueToday.value] : [];
  return tasks.sort((a, b) => {
    const aTime = Date.parse(a?.due ?? '');
    const bTime = Date.parse(b?.due ?? '');

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
      return String(a?.title ?? '').localeCompare(String(b?.title ?? ''));
    }
    if (Number.isNaN(aTime)) {
      return 1;
    }
    if (Number.isNaN(bTime)) {
      return -1;
    }
    return aTime - bTime;
  });
});

const hiddenTaskIds = ref(loadHiddenSet());
const showAll = ref(loadShowAll());

const hiddenCount = computed(() => hiddenTaskIds.value.size);

const buildYesterdayKey = (entry) => `yesterday:${entry?.taskId ?? entry?.id ?? ''}`;
const buildCompletedTodayKey = (entry) => `completed-today:${entry?.taskId ?? entry?.id ?? ''}`;
const buildScheduledKey = (task) => `scheduled:${task?.id ?? ''}`;

const orderCompletedYesterday = ref([]);
const orderCompletedToday = ref([]);
const orderScheduledToday = ref([]);

const isHidden = (key) => hiddenTaskIds.value.has(key);

const syncOrder = (source, orderRef, keyFn) => {
  watch(
    source,
    (items) => {
      const keys = (Array.isArray(items) ? items : []).map(keyFn);
      const existing = orderRef.value.filter((key) => keys.includes(key));
      keys.forEach((key) => {
        if (key && !existing.includes(key)) {
          existing.push(key);
        }
      });
      orderRef.value = existing;
    },
    { immediate: true, deep: false }
  );
};

syncOrder(rawCompletedYesterday, orderCompletedYesterday, buildYesterdayKey);
syncOrder(rawCompletedToday, orderCompletedToday, buildCompletedTodayKey);
syncOrder(rawTodayTasks, orderScheduledToday, buildScheduledKey);

const orderItems = (items, orderRef, keyFn) => {
  const orderMap = new Map(orderRef.value.map((key, index) => [key, index]));
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const aKey = keyFn(a);
    const bKey = keyFn(b);
    const aIndex = orderMap.has(aKey) ? orderMap.get(aKey) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(bKey) ? orderMap.get(bKey) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    // fallback to stable ordering
    return 0;
  });
};

const orderedCompletedYesterday = computed(() =>
  orderItems(rawCompletedYesterday.value, orderCompletedYesterday, buildYesterdayKey)
);
const orderedCompletedToday = computed(() =>
  orderItems(rawCompletedToday.value, orderCompletedToday, buildCompletedTodayKey)
);
const orderedScheduledToday = computed(() =>
  orderItems(rawTodayTasks.value, orderScheduledToday, buildScheduledKey)
);

const updateHiddenSet = (updater) => {
  const next = new Set(hiddenTaskIds.value);
  updater(next);
  hiddenTaskIds.value = next;
};

const hideTask = (key) => {
  if (!key) {
    return;
  }
  updateHiddenSet((set) => set.add(key));
};

const showTask = (key) => {
  if (!key) {
    return;
  }
  updateHiddenSet((set) => {
    set.delete(key);
  });
};

const normalizeCompletedDateKey = (value) => {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const displayedCompletedYesterday = computed(() => {
  const entries = orderedCompletedYesterday.value;
  if (showAll.value) {
    return entries;
  }
  return entries.filter((entry) => !isHidden(buildYesterdayKey(entry)));
});

const completedYesterdayGroups = computed(() => {
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
  const groups = new Map();
  displayedCompletedYesterday.value.forEach((entry) => {
    const key = normalizeCompletedDateKey(entry?.completedAt) ?? 'undated';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  });

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const timestamp = key === 'undated' ? null : Number(key);
      const dateLabel =
        typeof timestamp === 'number'
          ? formatter.format(new Date(timestamp))
          : 'Date unavailable';
      const sortValue =
        typeof timestamp === 'number' ? timestamp : Number.MAX_SAFE_INTEGER;
      return {
        key: typeof timestamp === 'number' ? `date:${timestamp}` : 'date:undated',
        label: dateLabel,
        items,
        sortValue,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue);
});

const displayedCompletedToday = computed(() => {
  const entries = orderedCompletedToday.value;
  if (showAll.value) {
    return entries;
  }
  return entries.filter((entry) => !isHidden(buildCompletedTodayKey(entry)));
});

const displayedScheduledToday = computed(() => {
  const tasks = orderedScheduledToday.value;
  if (showAll.value) {
    return tasks;
  }
  return tasks.filter((task) => !isHidden(buildScheduledKey(task)));
});

const completedYesterdayCount = computed(() => displayedCompletedYesterday.value.length);
const completedTodayCount = computed(() => displayedCompletedToday.value.length);
const scheduledTodayCount = computed(() => displayedScheduledToday.value.length);
const todayVisibleCount = computed(
  () => completedTodayCount.value + scheduledTodayCount.value
);

const totalCompletedYesterday = computed(() => rawCompletedYesterday.value.length);
const totalCompletedToday = computed(() => rawCompletedToday.value.length);
const totalScheduledToday = computed(() => rawTodayTasks.value.length);
const showCompletedTodaySection = computed(() => completedTodayCount.value > 0);
const hasScheduledToday = computed(() => totalScheduledToday.value > 0);

const getOrderRef = (section) => {
  switch (section) {
    case 'yesterday':
      return orderCompletedYesterday;
    case 'completedToday':
      return orderCompletedToday;
    case 'scheduled':
      return orderScheduledToday;
    default:
      return null;
  }
};

const reorderWithinSection = (section, sourceKey, targetKey) => {
  const orderRef = getOrderRef(section);
  if (!orderRef) {
    return;
  }
  const current = [...orderRef.value];
  const sourceIndex = current.indexOf(sourceKey);
  if (sourceIndex < 0) {
    return;
  }
  current.splice(sourceIndex, 1);
  if (targetKey === null) {
    current.push(sourceKey);
  } else {
    const targetIndex = current.indexOf(targetKey);
    if (targetIndex < 0) {
      current.push(sourceKey);
    } else {
      current.splice(targetIndex, 0, sourceKey);
    }
  }
  orderRef.value = current;
};

const draggingSection = ref(null);
const draggingKey = ref(null);
const dragOverKey = ref(null);
const dragOverIsEnd = ref(false);

const handleDragStart = (section, key, event) => {
  if (!key) {
    return;
  }
  draggingSection.value = section;
  draggingKey.value = key;
  dragOverKey.value = null;
  dragOverIsEnd.value = false;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', key);
    } catch (error) {
      // ignore – some browsers disallow setting data
    }
  }
};

const handleDragEnter = (section, key) => {
  if (
    !draggingKey.value
    || draggingSection.value !== section
    || draggingKey.value === key
  ) {
    return;
  }
  dragOverKey.value = key;
  dragOverIsEnd.value = false;
};

const handleDragLeave = (section, key) => {
  if (draggingSection.value !== section) {
    return;
  }
  if (dragOverKey.value === key) {
    dragOverKey.value = null;
  }
};

const handleDropOnItem = (section, key) => {
  if (
    !draggingKey.value
    || draggingSection.value !== section
    || draggingKey.value === key
  ) {
    handleDragEnd();
    return;
  }
  reorderWithinSection(section, draggingKey.value, key);
  handleDragEnd();
};

const handleDropZoneEnter = (section) => {
  if (draggingSection.value !== section) {
    return;
  }
  dragOverKey.value = null;
  dragOverIsEnd.value = true;
};

const handleDropZoneLeave = (section) => {
  if (draggingSection.value !== section) {
    return;
  }
  dragOverIsEnd.value = false;
};

const handleDropOnEnd = (section) => {
  if (!draggingKey.value || draggingSection.value !== section) {
    handleDragEnd();
    return;
  }
  reorderWithinSection(section, draggingKey.value, null);
  handleDragEnd();
};

const handleDragEnd = () => {
  draggingSection.value = null;
  draggingKey.value = null;
  dragOverKey.value = null;
  dragOverIsEnd.value = false;
};

const isDragOverItem = (section, key) =>
  draggingSection.value === section && dragOverKey.value === key;

const isDraggingItem = (section, key) =>
  draggingSection.value === section && draggingKey.value === key;

const isDropZoneActive = (section) =>
  draggingSection.value === section && dragOverIsEnd.value;

const formatTimestamp = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const isEndOfDayTime = (date) => date.getHours() === 23 && date.getMinutes() === 59;

const formatDueDateTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const options = isEndOfDayTime(date)
    ? { dateStyle: 'medium' }
    : { dateStyle: 'medium', timeStyle: 'short' };
  return new Intl.DateTimeFormat(undefined, options).format(date);
};

const formatDueTimeOnly = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const options = isEndOfDayTime(date)
    ? { dateStyle: 'medium' }
    : { timeStyle: 'short' };
  return new Intl.DateTimeFormat(undefined, options).format(date);
};

const formatTimeOnly = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(date);
};

const showDateAdjustments = ref(false);

const toggleDateAdjustments = () => {
  showDateAdjustments.value = !showDateAdjustments.value;
};

watch(hiddenTaskIds, (set) => {
  const values = Array.from(set);
  try {
    window.localStorage.setItem(STANDUP_HIDDEN_STORAGE_KEY, JSON.stringify(values));
  } catch (error) {
    // ignore storage errors
  }
});

watch(showAll, (value) => {
  try {
    window.localStorage.setItem(STANDUP_SHOW_ALL_STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    // ignore storage errors
  }
}, { immediate: true });

// Standup notes
const standupNotes = ref('');
const standupNotesSaving = ref(false);
const standupHistory = ref([]);
const standupHistorySaving = ref(false);
const standupCopyStatus = ref('');
const expandedStandupHistoryIds = ref(new Set());
let saveNotesTimeout = null;
let standupStatusTimeout = null;

// Notes section resizing
const NOTES_HEIGHT_STORAGE_KEY = 'todo-list.standup-notes-height';
const DEFAULT_NOTES_HEIGHT = 400; // 25rem in pixels (400px)
const MIN_NOTES_HEIGHT = 320; // 20rem (~320px)
const MAX_NOTES_HEIGHT = 640; // 40rem (~640px)

const notesHeight = ref(DEFAULT_NOTES_HEIGHT);
const isResizing = ref(false);
const notesContainerRef = ref(null);
let initialResizeY = 0;
let initialResizeHeight = 0;

const loadNotesHeight = () => {
  try {
    const stored = window.localStorage.getItem(NOTES_HEIGHT_STORAGE_KEY);
    if (stored) {
      const height = parseInt(stored, 10);
      if (!Number.isNaN(height) && height >= MIN_NOTES_HEIGHT && height <= MAX_NOTES_HEIGHT) {
        return height;
      }
    }
  } catch (error) {
    // ignore storage errors
  }
  return DEFAULT_NOTES_HEIGHT;
};

const saveNotesHeight = (height) => {
  try {
    window.localStorage.setItem(NOTES_HEIGHT_STORAGE_KEY, String(height));
  } catch (error) {
    // ignore storage errors
  }
};

const handleResizeStart = (event) => {
  isResizing.value = true;
  initialResizeY = event.clientY;
  initialResizeHeight = notesHeight.value;
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
  document.addEventListener('selectstart', handleSelectStart);
};

const handleSelectStart = (event) => {
  if (isResizing.value) {
    event.preventDefault();
  }
};

const handleResizeMove = (event) => {
  if (!isResizing.value) {
    return;
  }
  event.preventDefault();
  const delta = event.clientY - initialResizeY;
  const newHeight = initialResizeHeight - delta;

  if (newHeight >= MIN_NOTES_HEIGHT && newHeight <= MAX_NOTES_HEIGHT) {
    notesHeight.value = newHeight;
  }
};

const handleResizeEnd = () => {
  if (isResizing.value) {
    saveNotesHeight(notesHeight.value);
    isResizing.value = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('selectstart', handleSelectStart);
  }
};

// Mobile tabs
const activeTab = ref('today'); // 'yesterday', 'today', 'notes'
const notesTab = ref('notes'); // 'notes', 'saved'

const saveStandupNotes = async () => {
  standupNotesSaving.value = true;
  await updateStandupData({ notes: standupNotes.value, history: standupHistory.value });
  standupNotesSaving.value = false;
};

const saveStandupHistory = async () => {
  standupHistorySaving.value = true;
  await updateStandupData({ notes: standupNotes.value, history: standupHistory.value });
  standupHistorySaving.value = false;
};

const setStandupStatus = (message) => {
  standupCopyStatus.value = message;
  if (standupStatusTimeout) {
    window.clearTimeout(standupStatusTimeout);
  }
  standupStatusTimeout = window.setTimeout(() => {
    standupCopyStatus.value = '';
    standupStatusTimeout = null;
  }, 2000);
};

const copyTextFallback = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
};

const buildStandupHistoryId = () => {
  try {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (error) {
    // ignore
  }
  return `standup:${Date.now()}:${Math.random().toString(16).slice(2)}`;
};

const normalizeHistoryEntries = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .filter((entry) => entry && typeof entry.text === 'string')
    .map((entry) => ({
      id: typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : buildStandupHistoryId(),
      title: typeof entry.title === 'string' ? entry.title : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      text: String(entry.text ?? ''),
    }))
    .slice(0, 200);
};

const sortedStandupHistory = computed(() => {
  const entries = Array.isArray(standupHistory.value) ? standupHistory.value : [];
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt ?? '');
    const bTime = Date.parse(b?.createdAt ?? '');
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

const formatHistoryTimestamp = (value) => {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
};

const isHistoryExpanded = (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return false;
  }
  return expandedStandupHistoryIds.value.has(id);
};

const toggleHistoryExpanded = (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return;
  }
  const next = new Set(expandedStandupHistoryIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedStandupHistoryIds.value = next;
};

const handleCopyCurrentNotes = async () => {
  const text = String(standupNotes.value ?? '').trim();
  if (!text) {
    setStandupStatus('Nothing to copy');
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setStandupStatus('Copied');
      return;
    }
  } catch (error) {
    // fall back
  }

  try {
    const ok = copyTextFallback(text);
    setStandupStatus(ok ? 'Copied' : 'Copy failed');
  } catch (error) {
    setStandupStatus('Copy failed');
  }
};

const handleSaveStandupSnapshot = async () => {
  const text = String(standupNotes.value ?? '').trim();
  if (!text) {
    setStandupStatus('Nothing to save');
    return;
  }

  const title = `Standup - ${standupDateLabel.value}`;
  const entry = {
    id: buildStandupHistoryId(),
    title,
    createdAt: new Date().toISOString(),
    text,
  };

  const existing = Array.isArray(standupHistory.value) ? standupHistory.value : [];
  standupHistory.value = [entry, ...existing].slice(0, 200);
  await saveStandupHistory();
  setStandupStatus('Saved');
};

const handleLoadStandupSnapshot = async (entry) => {
  const text = String(entry?.text ?? '').trim();
  if (!text) {
    setStandupStatus('Nothing to load');
    return;
  }
  standupNotes.value = text;
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  await saveStandupNotes();
  setStandupStatus('Loaded');
};

const handleCopySnapshot = async (entry) => {
  const text = String(entry?.text ?? '').trim();
  if (!text) {
    setStandupStatus('Nothing to copy');
    return;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setStandupStatus('Copied');
      return;
    }
  } catch (error) {
    // fall back
  }
  try {
    const ok = copyTextFallback(text);
    setStandupStatus(ok ? 'Copied' : 'Copy failed');
  } catch (error) {
    setStandupStatus('Copy failed');
  }
};

const handleDeleteSnapshot = async (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return;
  }
  const ok = window.confirm('Delete this saved standup note?');
  if (!ok) {
    return;
  }
  const existing = Array.isArray(standupHistory.value) ? standupHistory.value : [];
  standupHistory.value = existing.filter((item) => String(item?.id ?? '') !== id);
  expandedStandupHistoryIds.value = new Set(
    Array.from(expandedStandupHistoryIds.value).filter((value) => value !== id)
  );
  await saveStandupHistory();
  setStandupStatus('Deleted');
};

const handleNotesInput = () => {
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  saveNotesTimeout = setTimeout(() => {
    saveStandupNotes();
  }, 500);
};

const clearNotes = async () => {
  standupNotes.value = '';
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  await saveStandupNotes();
  setStandupStatus('Cleared');
};

const loadStandupNotes = async () => {
  const result = await getStandupData();
  if (result.ok) {
    standupNotes.value = String(result.standup?.notes ?? '');
    standupHistory.value = normalizeHistoryEntries(result.standup?.history);

    const hasStandupData = standupNotes.value.trim().length > 0 || standupHistory.value.length > 0;
    if (hasStandupData) {
      return;
    }
  }

  const legacy = await getStorageSettings();
  if (legacy.ok && typeof legacy.settings?.standupNotes === 'string') {
    standupNotes.value = legacy.settings.standupNotes;
    await updateStandupData({ notes: standupNotes.value, history: standupHistory.value });
    await updateStorageSettings({ standupNotes: '' });
  }
};

onMounted(() => {
  notesHeight.value = loadNotesHeight();
  loadStandupNotes();
});

onUnmounted(() => {
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  if (standupStatusTimeout) {
    window.clearTimeout(standupStatusTimeout);
  }
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
  document.removeEventListener('selectstart', handleSelectStart);
});
</script>

<template>
  <section class="standup">
    <header class="standup__header">
      <div>
        <h1 class="standup__title">Standup Overview</h1>
        <p class="standup__subtitle">
          Snapshot for {{ standupDateLabel }}
        </p>
      </div>
    </header>
    <div class="standup__toolbar">
      <label class="standup__toggle">
        <input v-model="showAll" type="checkbox" class="standup__toggle-input" />
        <span>Show all tasks</span>
      </label>
      <span v-if="showAll && hiddenCount > 0" class="standup__hint">
        Hidden tasks are highlighted. Use Show to unhide them.
      </span>
    </div>
    
    <!-- Mobile tabs navigation -->
    <nav class="standup__tabs" role="tablist">
      <button
        role="tab"
        type="button"
        class="standup__tab"
        :class="{ 'standup__tab--active': activeTab === 'yesterday' }"
        :aria-selected="activeTab === 'yesterday'"
        @click="activeTab = 'yesterday'"
      >
        Yesterday
      </button>
      <button
        role="tab"
        type="button"
        class="standup__tab"
        :class="{ 'standup__tab--active': activeTab === 'today' }"
        :aria-selected="activeTab === 'today'"
        @click="activeTab = 'today'"
      >
        Today
      </button>
      <button
        role="tab"
        type="button"
        class="standup__tab"
        :class="{ 'standup__tab--active': activeTab === 'notes' }"
        :aria-selected="activeTab === 'notes'"
        @click="activeTab = 'notes'"
      >
        Notes
      </button>
    </nav>
    
    <div class="standup__grid" :class="{ 'standup__grid--tab-hidden': activeTab === 'notes' }">
      <article class="standup__section" :class="{ 'standup__section--tab-hidden': activeTab !== 'yesterday' }">
        <header class="standup__section-header">
          <h2>Completed Yesterday</h2>
          <span class="standup__count">
            {{ completedYesterdayCount }}
            <template v-if="totalCompletedYesterday > completedYesterdayCount">
              / {{ totalCompletedYesterday }}
            </template>
          </span>
        </header>
        <div class="standup__date-filter" aria-live="polite">
          <div class="standup__date-filter-summary">
            <span v-if="showCompletedDateHint" class="standup__date-filter-hint">
              {{ selectedCompletedDateDisplay || 'Select a date range' }}
            </span>
            <button
              type="button"
              class="standup__date-filter-toggle"
              @click="toggleDateAdjustments"
            >
              {{ showDateAdjustments ? 'Hide Date Controls' : 'Adjust Date' }}
            </button>
          </div>
          <div v-if="showDateAdjustments" class="standup__date-filter-fields">
            <label class="standup__date-filter-field">
              <span class="standup__date-filter-label">From</span>
              <input
                v-model="selectedCompletedStartDate"
                type="date"
                class="standup__date-filter-input"
                :max="completedDateMax"
              />
            </label>
            <label class="standup__date-filter-field">
              <span class="standup__date-filter-label">To</span>
              <input
                v-model="selectedCompletedEndDate"
                type="date"
                class="standup__date-filter-input"
                :max="completedDateMax"
              />
            </label>
          </div>
        </div>
        <p v-if="completedYesterdayCount === 0" class="standup__empty">
          <span v-if="totalCompletedYesterday === 0">
            No completed tasks logged for {{ selectedCompletedDateMessageLabel }}.
          </span>
          <span v-else>
            All completed tasks are hidden. Enable Show all to review them.
          </span>
        </p>
        <div v-else class="standup__groups">
          <section
            v-for="group in completedYesterdayGroups"
            :key="group.key"
            class="standup__group"
          >
            <header class="standup__group-header">
              <h3 class="standup__subheading standup__subheading--date">{{ group.label }}</h3>
              <span class="standup__count standup__count--inline">{{ group.items.length }}</span>
            </header>
            <ul class="standup__list">
              <li
                v-for="entry in group.items"
                :key="entry.id"
                :class="[
                  'standup__item',
                  {
                    'standup__item--hidden': showAll && isHidden(buildYesterdayKey(entry)),
                    'standup__item--drag-over': isDragOverItem('yesterday', buildYesterdayKey(entry)),
                    'standup__item--dragging': isDraggingItem('yesterday', buildYesterdayKey(entry)),
                  },
                ]"
                :draggable="displayedCompletedYesterday.length > 1"
                @dragstart="handleDragStart('yesterday', buildYesterdayKey(entry), $event)"
                @dragend="handleDragEnd"
                @dragenter.prevent="handleDragEnter('yesterday', buildYesterdayKey(entry))"
                @dragover.prevent
                @dragleave="handleDragLeave('yesterday', buildYesterdayKey(entry))"
                @drop.prevent="handleDropOnItem('yesterday', buildYesterdayKey(entry))"
              >
                <div class="standup__item-header">
                  <span class="standup__item-title">{{ entry.title }}</span>
                  <time class="standup__item-meta" :datetime="entry.completedAt">
                    Completed {{ formatTimestamp(entry.completedAt) }}
                  </time>
                  <span v-if="entry.workedOn" class="standup__worked-on">Worked on</span>
                </div>
                <p v-if="entry.description" class="standup__item-description">
                  {{ entry.description }}
                </p>
                <div v-if="entry.completionNotes" class="standup__completion-notes">
                  <p class="standup__completion-notes-label">Completion Notes</p>
                  <p class="standup__completion-notes-body">
                    {{ entry.completionNotes }}
                  </p>
                </div>
                <time
                  v-if="entry.due"
                  class="standup__item-meta"
                  :datetime="entry.due"
                >
                  Originally due {{ formatDueDateTime(entry.due) }}
                </time>
                <div v-if="entry.subtasks?.length" class="standup__subtasks">
                  <p class="standup__subtasks-title">Subtasks</p>
                  <ul class="standup__subtask-list">
                    <li v-for="subtask in entry.subtasks" :key="subtask.id" class="standup__subtask">
                      <span
                        :class="[
                          'standup__subtask-status',
                          { 'standup__subtask-status--done': subtask.completed },
                        ]"
                        aria-hidden="true"
                      ></span>
                      <span
                        :class="[
                          'standup__subtask-title',
                          { 'standup__subtask-title--done': subtask.completed },
                        ]"
                      >
                        {{ subtask.title }}
                      </span>
                    </li>
                  </ul>
                </div>
                <span class="standup__list-pill">
                  <span class="standup__list-text">{{ resolveListName(entry.listId) }}</span>
                </span>
                <div class="standup__item-actions">
                  <button
                    v-if="!showAll"
                    type="button"
                    class="standup__item-toggle"
                    @click="hideTask(buildYesterdayKey(entry))"
                  >
                    Hide
                  </button>
                  <button
                    v-else-if="isHidden(buildYesterdayKey(entry))"
                    type="button"
                    class="standup__item-toggle standup__item-toggle--show"
                    @click="showTask(buildYesterdayKey(entry))"
                  >
                    Show
                  </button>
                </div>
              </li>
            </ul>
          </section>
          <div
            v-if="draggingSection === 'yesterday'"
            class="standup__drop-zone"
            :class="{ 'standup__drop-zone--active': isDropZoneActive('yesterday') }"
            @dragenter.prevent="handleDropZoneEnter('yesterday')"
            @dragover.prevent
            @dragleave="handleDropZoneLeave('yesterday')"
            @drop.prevent="handleDropOnEnd('yesterday')"
          ></div>
        </div>
      </article>
      <article class="standup__section" :class="{ 'standup__section--tab-hidden': activeTab !== 'today' }">
        <header class="standup__section-header">
          <h2>Today&rsquo;s Focus</h2>
          <span class="standup__count">
            {{ todayVisibleCount }}
            <template v-if="totalCompletedToday + totalScheduledToday > todayVisibleCount">
              / {{ totalCompletedToday + totalScheduledToday }}
            </template>
          </span>
        </header>
        <p v-if="todayVisibleCount === 0" class="standup__empty">
          <span v-if="totalCompletedToday + totalScheduledToday === 0">
            No tasks scheduled or completed yet today. Great job staying ahead!
          </span>
          <span v-else>
            All of today's tasks are hidden. Enable Show all to review them.
          </span>
        </p>
        <div v-else class="standup__focus">
          <section
            v-if="showCompletedTodaySection"
            class="standup__focus-group"
          >
            <h3 class="standup__subheading">Completed Today</h3>
            <p
              v-if="completedTodayCount === 0"
              class="standup__empty standup__empty--sub"
            >
              All completed tasks are hidden. Enable Show all to review them.
            </p>
            <ul
              v-else
              class="standup__list"
            >
              <li
                v-for="entry in displayedCompletedToday"
                :key="entry.id"
                :class="[
                  'standup__item',
                  {
                    'standup__item--hidden': showAll && isHidden(buildCompletedTodayKey(entry)),
                    'standup__item--drag-over': isDragOverItem('completedToday', buildCompletedTodayKey(entry)),
                    'standup__item--dragging': isDraggingItem('completedToday', buildCompletedTodayKey(entry)),
                  },
                ]"
                :draggable="displayedCompletedToday.length > 1"
                @dragstart="handleDragStart('completedToday', buildCompletedTodayKey(entry), $event)"
                @dragend="handleDragEnd"
                @dragenter.prevent="handleDragEnter('completedToday', buildCompletedTodayKey(entry))"
                @dragover.prevent
                @dragleave="handleDragLeave('completedToday', buildCompletedTodayKey(entry))"
                @drop.prevent="handleDropOnItem('completedToday', buildCompletedTodayKey(entry))"
              >
                <div class="standup__item-header">
                  <span class="standup__item-title">{{ entry.title }}</span>
                  <time class="standup__item-meta" :datetime="entry.completedAt">
                    Completed at {{ formatTimeOnly(entry.completedAt) }}
                  </time>
                  <span v-if="entry.workedOn" class="standup__worked-on">Worked on</span>
                </div>
                <p v-if="entry.description" class="standup__item-description">
                  {{ entry.description }}
                </p>
                <div v-if="entry.completionNotes" class="standup__completion-notes">
                  <p class="standup__completion-notes-label">Completion Notes</p>
                  <p class="standup__completion-notes-body">
                    {{ entry.completionNotes }}
                  </p>
                </div>
                <time
                  v-if="entry.due"
                  class="standup__item-meta"
                  :datetime="entry.due"
                >
                  Was due {{ formatDueDateTime(entry.due) }}
                </time>
                <div v-if="entry.subtasks?.length" class="standup__subtasks">
                  <p class="standup__subtasks-title">Subtasks</p>
                  <ul class="standup__subtask-list">
                    <li v-for="subtask in entry.subtasks" :key="subtask.id" class="standup__subtask">
                      <span
                        :class="[
                          'standup__subtask-status',
                          { 'standup__subtask-status--done': subtask.completed },
                        ]"
                        aria-hidden="true"
                      ></span>
                      <span
                        :class="[
                          'standup__subtask-title',
                          { 'standup__subtask-title--done': subtask.completed },
                        ]"
                      >
                        {{ subtask.title }}
                      </span>
                    </li>
                  </ul>
                </div>
                <div class="standup__meta-row">
                  <span class="standup__list-pill">
                    <span class="standup__list-text">{{ resolveListName(entry.listId) }}</span>
                  </span>
                  <span
                    v-if="entry.recurrence"
                    class="standup__recurrence-icon"
                    v-tooltip="`Repeats: ${entry.recurrence}`"
                    aria-label="Repeats"
                  >
                    <IconGlyph name="repeat" size="14" aria-hidden="true" />
                  </span>
                  <div class="standup__item-actions">
                    <button
                      v-if="!showAll"
                      type="button"
                      class="standup__item-toggle"
                      @click="hideTask(buildCompletedTodayKey(entry))"
                    >
                      Hide
                    </button>
                    <button
                      v-else-if="isHidden(buildCompletedTodayKey(entry))"
                      type="button"
                      class="standup__item-toggle standup__item-toggle--show"
                      @click="showTask(buildCompletedTodayKey(entry))"
                    >
                      Show
                    </button>
                  </div>
                </div>
              </li>
              <li
                v-if="draggingSection === 'completedToday'"
                class="standup__drop-zone"
                :class="{ 'standup__drop-zone--active': isDropZoneActive('completedToday') }"
                @dragenter.prevent="handleDropZoneEnter('completedToday')"
                @dragover.prevent
                @dragleave="handleDropZoneLeave('completedToday')"
                @drop.prevent="handleDropOnEnd('completedToday')"
              ></li>
            </ul>
          </section>
          <section
            v-if="hasScheduledToday"
            class="standup__focus-group"
          >
            <h3 class="standup__subheading">Scheduled</h3>
            <p
              v-if="scheduledTodayCount === 0"
              class="standup__empty standup__empty--sub"
            >
              All scheduled tasks are hidden. Enable Show all to review them.
            </p>
            <ul
              v-else
              class="standup__list"
            >
              <li
                v-for="task in displayedScheduledToday"
                :key="task.id"
                :class="[
                  'standup__item',
                  {
                    'standup__item--hidden': showAll && isHidden(buildScheduledKey(task)),
                    'standup__item--drag-over': isDragOverItem('scheduled', buildScheduledKey(task)),
                    'standup__item--dragging': isDraggingItem('scheduled', buildScheduledKey(task)),
                  },
                ]"
                :draggable="displayedScheduledToday.length > 1"
                @dragstart="handleDragStart('scheduled', buildScheduledKey(task), $event)"
                @dragend="handleDragEnd"
                @dragenter.prevent="handleDragEnter('scheduled', buildScheduledKey(task))"
                @dragover.prevent
                @dragleave="handleDragLeave('scheduled', buildScheduledKey(task))"
                @drop.prevent="handleDropOnItem('scheduled', buildScheduledKey(task))"
              >
                <div class="standup__item-header">
                  <span class="standup__item-title">{{ task.title }}</span>
                  <time
                    v-if="formatTimeOnly(task.due)"
                    class="standup__item-meta"
                    :datetime="task.due"
                  >
                    Due {{ formatDueTimeOnly(task.due) }}
                  </time>
                </div>
                <p v-if="task.description" class="standup__item-description">
                  {{ task.description }}
                </p>
                <div v-if="task.subtasks?.length" class="standup__subtasks">
                  <p class="standup__subtasks-title">Subtasks</p>
                  <ul class="standup__subtask-list">
                    <li v-for="subtask in task.subtasks" :key="subtask.id" class="standup__subtask">
                      <span
                        :class="[
                          'standup__subtask-status',
                          { 'standup__subtask-status--done': subtask.completed },
                        ]"
                        aria-hidden="true"
                      ></span>
                      <span
                        :class="[
                          'standup__subtask-title',
                          { 'standup__subtask-title--done': subtask.completed },
                        ]"
                      >
                        {{ subtask.title }}
                      </span>
                    </li>
                  </ul>
                </div>
                <div class="standup__meta-row">
                  <span class="standup__list-pill">
                    <span class="standup__list-text">{{ resolveListName(task.listId) }}</span>
                  </span>
                  <span
                    v-if="task.recurrence"
                    class="standup__recurrence-icon"
                    v-tooltip="`Repeats: ${task.recurrence}`"
                    aria-label="Repeats"
                  >
                    <IconGlyph name="repeat" size="14" aria-hidden="true" />
                  </span>
                  <div class="standup__item-actions">
                    <button
                      v-if="!showAll"
                      type="button"
                      class="standup__item-toggle"
                      @click="hideTask(buildScheduledKey(task))"
                    >
                      Hide
                    </button>
                    <button
                      v-else-if="isHidden(buildScheduledKey(task))"
                      type="button"
                      class="standup__item-toggle standup__item-toggle--show"
                      @click="showTask(buildScheduledKey(task))"
                    >
                      Show
                    </button>
                  </div>
                </div>
              </li>
              <li
                v-if="draggingSection === 'scheduled'"
                class="standup__drop-zone"
                :class="{ 'standup__drop-zone--active': isDropZoneActive('scheduled') }"
                @dragenter.prevent="handleDropZoneEnter('scheduled')"
                @dragover.prevent
                @dragleave="handleDropZoneLeave('scheduled')"
                @drop.prevent="handleDropOnEnd('scheduled')"
              ></li>
            </ul>
          </section>
        </div>
      </article>
    </div>

    <article 
      ref="notesContainerRef"
      class="standup__notes-section" 
      :class="{ 
        'standup__notes-section--tab-hidden': activeTab !== 'notes',
        'standup__notes-section--resizing': isResizing
      }"
      :style="{ height: `${notesHeight}px` }"
    >
      <div
        class="standup__notes-resize-handle"
        role="presentation"
        aria-label="Drag to resize notes section"
        @mousedown="handleResizeStart"
      ></div>
      <header class="standup__notes-header">
        <h2 class="standup__notes-title">Notes</h2>
      </header>
      <nav class="standup__notes-tabs" aria-label="Standup notes sections">
        <button
          type="button"
          :class="['standup__notes-tab', { 'standup__notes-tab--active': notesTab === 'notes' }]"
          @click="notesTab = 'notes'"
        >
          Notes
        </button>
        <button
          type="button"
          :class="['standup__notes-tab', { 'standup__notes-tab--active': notesTab === 'saved' }]"
          @click="notesTab = 'saved'"
        >
          Saved Notes
        </button>
      </nav>
      <div class="standup__notes-body">
        <div v-if="notesTab === 'notes'" class="standup__notes-panel standup__notes-panel--editor">
          <div class="standup__notes-actions">
            <button
              type="button"
              class="standup__notes-clear"
              :disabled="!standupNotes.trim() || standupNotesSaving"
              @click="clearNotes"
            >
              Clear
            </button>
            <button
              type="button"
              class="standup__notes-clear"
              :disabled="!standupNotes.trim() || standupNotesSaving"
              @click="handleSaveStandupSnapshot"
            >
              Save
            </button>
            <button
              type="button"
              class="standup__notes-clear"
              :disabled="!standupNotes.trim()"
              @click="handleCopyCurrentNotes"
            >
              Copy
            </button>
          </div>
          <textarea
            v-model="standupNotes"
            class="standup__notes-textarea"
            placeholder="Add your standup notes here..."
            @input="handleNotesInput"
          ></textarea>
        </div>
        <section
          v-else
          class="standup__history"
          aria-label="Saved standup notes history"
        >
          <header class="standup__history-header">
            <h3 class="standup__history-title">Saved Notes</h3>
          </header>
          <p v-if="sortedStandupHistory.length === 0" class="standup__history-empty">
            No saved standup notes yet.
          </p>
          <ul v-else class="standup__history-list">
            <li
              v-for="entry in sortedStandupHistory"
              :key="entry.id || entry.createdAt"
              class="standup__history-item"
            >
              <div class="standup__history-item-header">
                <div>
                  <p class="standup__history-item-title">{{ entry.title || 'Saved standup notes' }}</p>
                  <p class="standup__history-item-meta">{{ formatHistoryTimestamp(entry.createdAt) }}</p>
                </div>
                <div class="standup__history-actions">
                  <button
                    type="button"
                    class="standup__item-toggle"
                    @click="toggleHistoryExpanded(entry)"
                  >
                    {{ isHistoryExpanded(entry) ? 'Hide' : 'Show' }}
                  </button>
                  <button
                    type="button"
                    class="standup__item-toggle"
                    @click="handleLoadStandupSnapshot(entry)"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    class="standup__item-toggle"
                    @click="handleCopySnapshot(entry)"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    class="standup__item-toggle"
                    @click="handleDeleteSnapshot(entry)"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <pre v-if="isHistoryExpanded(entry)" class="standup__history-text">{{ entry.text }}</pre>
            </li>
          </ul>
        </section>
        <p v-if="standupNotesSaving || standupHistorySaving" class="standup__notes-status">
          <template v-if="standupNotesSaving">Saving notes...</template>
          <template v-else>Saving history...</template>
        </p>
        <p v-else-if="standupCopyStatus" class="standup__notes-status" aria-live="polite">
          {{ standupCopyStatus }}
        </p>
      </div>
    </article>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.standup {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 1.5rem;
  overflow: hidden;
}

.standup__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.standup__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.standup__subtitle {
  margin: 0.2rem 0 0;
  color: theme.$color-text-muted;
}

.standup__toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.standup__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-heading;
  user-select: none;
}

.standup__toggle-input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: theme.$color-accent;
}

.standup__hint {
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.standup__grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  min-height: 0;
  overflow: hidden;
}

.standup__section {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  grid-template-rows: auto auto 1fr;
  min-height: 0;
  overflow: hidden;
}

.standup__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
  }
}

.standup__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.standup__date-filter {
  display: grid;
  gap: 0.75rem;
}

.standup__date-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.standup__date-filter-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.standup__date-filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.standup__date-filter-label {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$color-text-muted;
}

.standup__date-filter-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid theme.$color-border-input;
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
  color: theme.$color-text-primary;
  font: inherit;
}

.standup__date-filter-input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.standup__date-filter-hint {
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.standup__date-filter-toggle {
  align-self: center;
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.standup__empty {
  margin: 0;
  padding: 1.25rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 0.75rem;
  color: theme.$color-text-muted;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
}

.standup__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-auto-rows: min-content;
  overflow-y: auto;
  min-height: 0;
}

.standup__groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
  min-height: 0;
}

.standup__group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.standup__group-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  justify-content: space-between;
}

.standup__subheading--date {
  margin: 0;
}

.standup__count--inline {
  font-size: 0.9rem;
}

.standup__focus {
  display: grid;
  gap: 1.25rem;
  overflow-y: auto;
  min-height: 0;
}

.standup__focus-group {
  display: grid;
  gap: 0.75rem;
}

.standup__subheading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.standup__item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(12, 12, 13, 0.55);
  display: grid;
  gap: 0.5rem;
}

.standup__item-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.standup__item-title {
  font-weight: 600;
  color: theme.$color-text-primary;
}

.standup__item-meta {
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.standup__worked-on {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, 0.5);
  background: rgba(59, 130, 246, 0.18);
  color: #bfdbfe;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.standup__item-description {
  margin: 0;
  color: #d4d4d8;
  opacity: 0.85;
}

.standup__completion-notes {
  padding: 0.65rem 0.75rem;
  border: 1px dashed theme.$color-border-input;
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.35rem;
}

.standup__completion-notes-label {
  margin: 0;
  font-weight: 700;
  color: theme.$color-text-heading;
  font-size: 0.85rem;
}

.standup__completion-notes-body {
  margin: 0;
  color: #d4d4d8;
  line-height: 1.5;
  white-space: pre-line;
}

.standup__subtasks {
  display: grid;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border: 1px dashed theme.$color-border-input;
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.03);
}

.standup__subtasks-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: theme.$color-text-muted;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.standup__subtask-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.standup__subtask {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.standup__subtask-status {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 0.3rem;
  border: 2px solid theme.$color-border-input;
  flex: none;
  background: rgba(255, 255, 255, 0.04);
}

.standup__subtask-status--done {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.7);
}

.standup__subtask-title {
  flex: 1;
  min-width: 0;
  color: theme.$color-text-primary;
}

.standup__subtask-title--done {
  color: theme.$color-text-muted;
  text-decoration: line-through;
}

.standup__meta-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.standup__list-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(148, 163, 184, 0.12);
  color: theme.$color-text-heading;
  font-weight: 600;
  font-size: 0.85rem;
  width: fit-content;
  justify-self: start;
}

.standup__list-text {
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.standup__recurrence-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.standup__item-actions {
  display: flex;
  justify-content: flex-end;
  margin-left: auto;
}

.standup__item-toggle {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.standup__item-toggle--show {
  border-color: rgba(34, 197, 94, 0.6);
  color: rgba(134, 239, 172, 0.95);

  &:hover {
    background: rgba(34, 197, 94, 0.2);
    color: #ffffff;
  }
}

.standup__item--hidden {
  opacity: 0.65;
  border-style: dashed;
}

.standup__item--dragging {
  opacity: 0.4;
}

.standup__item--drag-over {
  border-color: theme.$color-accent;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

.standup__drop-zone {
  height: 0;
  border-top: 2px dashed theme.$color-border-input;
  margin: 0.4rem 0;
  transition: border-color 0.2s ease;
}

.standup__drop-zone--active {
  border-color: theme.$color-accent;
}

.standup__notes-section {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 0.5rem;
  background: rgba(23, 23, 24, 0.6);
  border: 1px solid theme.$color-border-strong;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 320px;
  max-height: 640px;
  height: 400px;
  position: relative;
  transition: border-color 0.2s ease;

  &.standup__notes-section--resizing {
    user-select: none;
    border-color: theme.$color-accent;
  }
}

.standup__notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.standup__notes-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
  flex: none;
}

.standup__notes-tab {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1.1;
  min-height: 2rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.standup__notes-tab--active {
  border-color: rgba(34, 197, 94, 0.65);
  background: rgba(34, 197, 94, 0.1);
  color: theme.$color-text-heading;
}

.standup__notes-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.standup__notes-body {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.75rem;
}

.standup__notes-panel {
  display: grid;
  gap: 0.75rem;
  min-height: 0;
  height: 100%;
}

.standup__notes-panel--editor {
  grid-template-rows: auto minmax(0, 1fr);
}

.standup__notes-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.standup__notes-clear {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.4rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;

  &:hover:not(:disabled) {
    color: theme.$color-text-heading;
    border-color: rgba(239, 68, 68, 0.6);
    background: rgba(239, 68, 68, 0.1);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.standup__notes-textarea {
  padding: 0.75rem;
  border: 1px solid theme.$color-border-input;
  border-radius: 0.375rem;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  resize: none;
  min-height: 0;

  &:focus {
    outline: none;
    border-color: theme.$color-accent;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  &::placeholder {
    color: theme.$color-text-muted;
  }
}

.standup__notes-status {
  margin: 0;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
  font-style: italic;
}

.standup__history {
  display: grid;
  gap: 0.6rem;
  min-height: 0;
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}

.standup__history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.standup__history-title {
  margin: 0;
  font-size: 0.95rem;
  color: theme.$color-text-heading;
}

.standup__history-empty {
  margin: 0;
  color: theme.$color-text-muted;
  font-size: 0.85rem;
  align-self: start;
}

.standup__history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
  overflow-y: auto;
  min-height: 0;
}

.standup__history-item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.6rem;
  background: rgba(12, 12, 13, 0.45);
  padding: 0.65rem 0.75rem;
  display: grid;
  gap: 0.45rem;
}

.standup__history-item-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.standup__history-item-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.standup__history-item-meta {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: theme.$color-text-muted;
}

.standup__history-actions {
  display: inline-flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.standup__history-text {
  margin: 0;
  padding: 0.6rem;
  border-radius: 0.5rem;
  border: 1px dashed theme.$color-border-input;
  background: rgba(255, 255, 255, 0.03);
  color: theme.$color-text-primary;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.4;
}

.standup__notes-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1.25rem;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.standup__notes-resize-handle::before {
  content: '';
  width: 2.5rem;
  height: 0.25rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  transition: background 0.2s ease;
  pointer-events: none;
}

.standup__notes-resize-handle:hover::before,
.standup__notes-section--resizing .standup__notes-resize-handle::before {
  background: theme.$color-accent;
}

/* Mobile tabs - hidden on desktop */
.standup__tabs {
  display: none;
}

.standup__tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: rgba(27, 27, 29, 0.4);
  color: theme.$color-text-muted;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  border-bottom: 2px solid transparent;

  &:first-child {
    border-radius: 0.5rem 0 0 0.5rem;
  }

  &:last-child {
    border-radius: 0 0.5rem 0.5rem 0;
  }

  &:hover {
    background: rgba(27, 27, 29, 0.6);
    color: theme.$color-text-primary;
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: -2px;
  }
}

.standup__tab--active {
  background: rgba(34, 197, 94, 0.15);
  color: theme.$color-accent;
  border-bottom-color: theme.$color-accent;

  &:hover {
    background: rgba(34, 197, 94, 0.2);
    color: theme.$color-accent;
  }
}

/* Mobile responsive behavior */
@media (max-width: 768px) {
  .standup {
    grid-template-rows: auto auto auto 1fr;
  }

  .standup__tabs {
    display: flex;
    gap: 0;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid theme.$color-border-muted;
  }

  .standup__grid {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .standup__grid--tab-hidden {
    display: none;
  }

  .standup__section--tab-hidden {
    display: none;
  }

  .standup__notes-section {
    max-height: none;
    min-height: 0;
    display: flex;
    flex-direction: column;
    height: auto;
  }

  .standup__notes-body {
    flex: 1;
    min-height: 0;
  }

  .standup__notes-section--tab-hidden {
    display: none;
  }

  .standup__notes-textarea {
    flex: 1;
    min-height: 220px;
  }

  .standup__notes-resize-handle {
    display: none;
  }

  .standup__section {
    grid-template-rows: auto auto 1fr;
    overflow: hidden;
  }
}
</style>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import IconGlyph from '../components/IconGlyph.vue';
import { useTaskStore } from '../stores/useTaskStore';
import {
  getStorageSettings,
  updateStorageSettings,
  getSummariesData,
  updateSummariesData,
} from '../services/jsonStorage';

const SUMMARY_HIDDEN_STORAGE_KEY = 'todo-list.summary-hidden';
const SUMMARY_SHOW_ALL_STORAGE_KEY = 'todo-list.summary-show-all';

const { sortedCompletedTasks, lists } = useTaskStore();

const loadHiddenSet = () => {
  try {
    const raw = window.localStorage.getItem(SUMMARY_HIDDEN_STORAGE_KEY);
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
  return window.localStorage.getItem(SUMMARY_SHOW_ALL_STORAGE_KEY) === 'true';
};

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

const getLastWorkWeekRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // JS getDay(): Sun=0, Mon=1, ..., Sat=6
  const offsetToMonday = (today.getDay() + 6) % 7;
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(mondayThisWeek.getDate() - offsetToMonday);

  // Previous full work week (Mon-Fri)
  const start = new Date(mondayThisWeek);
  start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);

  return { start, end };
};

const lastWorkWeek = getLastWorkWeekRange();
const selectedStartDate = ref(toDateInputValue(lastWorkWeek.start));
const selectedEndDate = ref(toDateInputValue(lastWorkWeek.end));
const showDateControls = ref(false);

const completedDateBounds = computed(() => {
  const startValue = parseDateInputValue(selectedStartDate.value);
  const endValue = parseDateInputValue(selectedEndDate.value);
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

const dateRangeLabel = computed(() => {
  const { startDate, endDate } = completedDateBounds.value;
  if (!startDate || !endDate) {
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

const dateFilterMax = computed(() => toDateInputValue(new Date()));

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

const hiddenTaskIds = ref(loadHiddenSet());
const showAll = ref(loadShowAll());
const hiddenCount = computed(() => hiddenTaskIds.value.size);

const activeSection = ref('summarize');
const isSummarizeActive = computed(() => activeSection.value === 'summarize');

const summaryNotes = ref('');
const summaryNotesSaving = ref(false);
let saveNotesTimeout = null;

const summaryHistory = ref([]);
const summaryHistorySaving = ref(false);

const editingHistoryId = ref('');
const editingHistoryTitle = ref('');
const editingHistoryText = ref('');

const expandedHistoryTextIds = ref(new Set());

const copyStatus = ref('');
let copyStatusTimer = null;

const buildKey = (entry) => {
  const id = entry?.id ?? entry?.taskId ?? null;
  if (id === null || id === undefined || String(id).trim().length === 0) {
    return '';
  }
  return `completed:${id}`;
};

const isHidden = (key) => hiddenTaskIds.value.has(key);

const updateHiddenSet = (updater) => {
  const next = new Set(hiddenTaskIds.value);
  updater(next);
  hiddenTaskIds.value = next;
};

const hideEntry = (entry) => {
  const key = buildKey(entry);
  if (!key) {
    return;
  }
  updateHiddenSet((set) => set.add(key));
};

const showEntry = (entry) => {
  const key = buildKey(entry);
  if (!key) {
    return;
  }
  updateHiddenSet((set) => set.delete(key));
};

watch(
  hiddenTaskIds,
  (value) => {
    const values = Array.from(value);
    window.localStorage.setItem(SUMMARY_HIDDEN_STORAGE_KEY, JSON.stringify(values));
  },
  { deep: false }
);

watch(showAll, (value) => {
  window.localStorage.setItem(SUMMARY_SHOW_ALL_STORAGE_KEY, value ? 'true' : 'false');
});

const formatTimestamp = (value) => {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
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

const rawCompletedInRange = computed(() => {
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

const unhiddenEntries = computed(() =>
  rawCompletedInRange.value.filter((entry) => !isHidden(buildKey(entry)))
);

const displayedEntries = computed(() => {
  const entries = rawCompletedInRange.value;
  if (showAll.value) {
    return entries;
  }
  return entries.filter((entry) => !isHidden(buildKey(entry)));
});

const totalCount = computed(() => rawCompletedInRange.value.length);
const visibleCount = computed(() => displayedEntries.value.length);

const groupedEntries = computed(() => {
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
  const groups = new Map();

  displayedEntries.value.forEach((entry) => {
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
      const sortValue = typeof timestamp === 'number' ? timestamp : Number.MAX_SAFE_INTEGER;
      return {
        key: typeof timestamp === 'number' ? `date:${timestamp}` : 'date:undated',
        label: dateLabel,
        items,
        sortValue,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue);
});

const groupedUnhiddenEntries = computed(() => {
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
  const groups = new Map();

  unhiddenEntries.value.forEach((entry) => {
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
      const sortValue = typeof timestamp === 'number' ? timestamp : Number.MAX_SAFE_INTEGER;
      return {
        key: typeof timestamp === 'number' ? `date:${timestamp}` : 'date:undated',
        label: dateLabel,
        items,
        sortValue,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue);
});

const toggleDateControls = () => {
  showDateControls.value = !showDateControls.value;
};

const isEmpty = computed(() => visibleCount.value === 0);

const buildClipboardText = () => {
  const groups = groupedUnhiddenEntries.value;
  if (!Array.isArray(groups) || groups.length === 0) {
    return '';
  }

  const lines = [];
  groups.forEach((group, index) => {
    if (index > 0) {
      lines.push('');
    }
    lines.push(group.label);
    (Array.isArray(group.items) ? group.items : []).forEach((entry) => {
      const listName = resolveListName(entry?.listId);
      lines.push(`- ${String(entry?.title ?? 'Untitled task')} (${listName})`);

      const completionNotes = String(entry?.completionNotes ?? '').trim();
      if (completionNotes) {
        const noteLines = completionNotes.split(/\r?\n/);
        lines.push(`  Completion Notes: ${noteLines[0]}`);
        noteLines.slice(1).forEach((line) => {
          lines.push(`  ${line}`);
        });
      }
    });
  });

  return lines.join('\n');
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

const setCopyStatus = (message) => {
  copyStatus.value = message;
  if (copyStatusTimer) {
    window.clearTimeout(copyStatusTimer);
  }
  copyStatusTimer = window.setTimeout(() => {
    copyStatus.value = '';
    copyStatusTimer = null;
  }, 2000);
};

const saveSummaryNotes = async () => {
  summaryNotesSaving.value = true;
  await updateSummariesData({ notes: summaryNotes.value, history: summaryHistory.value });
  summaryNotesSaving.value = false;
};

const saveSummaryHistory = async () => {
  summaryHistorySaving.value = true;
  await updateSummariesData({ notes: summaryNotes.value, history: summaryHistory.value });
  summaryHistorySaving.value = false;
};

const buildSummaryHistoryId = () => {
  try {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
  } catch (error) {
    // ignore
  }
  return `summary:${Date.now()}:${Math.random().toString(16).slice(2)}`;
};

const handleNotesInput = () => {
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  saveNotesTimeout = setTimeout(() => {
    saveSummaryNotes();
  }, 500);
};

const normalizeHistoryEntries = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .filter((entry) => entry && typeof entry.text === 'string')
    .map((entry) => ({
      id: typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : buildSummaryHistoryId(),
      title: typeof entry.title === 'string' ? entry.title : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      text: String(entry.text ?? ''),
    }))
    .slice(0, 200);
};

const loadSummaries = async () => {
  const result = await getSummariesData();
  if (result.ok) {
    summaryNotes.value = String(result.summaries?.notes ?? '');
    summaryHistory.value = normalizeHistoryEntries(result.summaries?.history);

    const hasSummaries = summaryNotes.value.trim().length > 0 || summaryHistory.value.length > 0;
    if (!hasSummaries) {
      await migrateSummariesFromSettings();
    }

    return;
  }

  // If summaries.json read fails, fall back to settings migration.
  await migrateSummariesFromSettings();
};

const migrateSummariesFromSettings = async () => {
  const result = await getStorageSettings();
  if (!result.ok) {
    return;
  }

  const legacyNotes = typeof result.settings?.summaryNotes === 'string' ? result.settings.summaryNotes : '';
  const legacyHistory = Array.isArray(result.settings?.summaryHistory)
    ? normalizeHistoryEntries(result.settings.summaryHistory)
    : [];

  if (!legacyNotes && legacyHistory.length === 0) {
    return;
  }

  summaryNotes.value = legacyNotes;
  summaryHistory.value = legacyHistory;

  await updateSummariesData({ notes: summaryNotes.value, history: summaryHistory.value });

  // Best effort cleanup so we truly stop using settings.json for summaries.
  await updateStorageSettings({ summaryNotes: '', summaryHistory: [] });
};

const handleUpdateNotesWithVisibleTasks = async () => {
  const text = buildClipboardText();
  if (!text) {
    setCopyStatus('No visible tasks');
    return;
  }
  summaryNotes.value = text;
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  await saveSummaryNotes();
  setCopyStatus('Notes updated');
};

const handleCopyNotes = async () => {
  const text = String(summaryNotes.value ?? '').trim();
  if (!text) {
    setCopyStatus('Nothing to copy');
    return;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied');
      return;
    }
  } catch (error) {
    // fall back
  }

  try {
    const ok = copyTextFallback(text);
    setCopyStatus(ok ? 'Copied' : 'Copy failed');
  } catch (error) {
    setCopyStatus('Copy failed');
  }
};

const handleClearSummaryText = async () => {
  if (!summaryNotes.value.trim()) {
    return;
  }
  summaryNotes.value = '';
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
  await saveSummaryNotes();
  setCopyStatus('Cleared');
};

const handleSaveNotesToHistory = async () => {
  const text = String(summaryNotes.value ?? '').trim();
  if (!text) {
    setCopyStatus('Nothing to save');
    return;
  }

  const title = String(dateRangeLabel.value || 'Selected date range');
  const entry = {
    id: buildSummaryHistoryId(),
    title,
    createdAt: new Date().toISOString(),
    text,
  };

  const existingEntries = Array.isArray(summaryHistory.value) ? summaryHistory.value : [];
  summaryHistory.value = [entry, ...existingEntries].slice(0, 200);
  await saveSummaryHistory();
  setCopyStatus('Saved');
};

const sortedSummaryHistory = computed(() => {
  const entries = Array.isArray(summaryHistory.value) ? summaryHistory.value : [];
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

const startEditingHistoryEntry = (entry) => {
  if (!entry) {
    return;
  }
  const id = String(entry.id ?? '');
  if (!id) {
    return;
  }
  editingHistoryId.value = id;
  editingHistoryTitle.value = String(entry.title ?? '');
  editingHistoryText.value = String(entry.text ?? '');
};

const cancelEditingHistoryEntry = () => {
  editingHistoryId.value = '';
  editingHistoryTitle.value = '';
  editingHistoryText.value = '';
};

const saveEditingHistoryEntry = async () => {
  const id = String(editingHistoryId.value ?? '').trim();
  if (!id) {
    return;
  }

  const text = String(editingHistoryText.value ?? '').trim();
  if (!text) {
    setCopyStatus('Nothing to save');
    return;
  }

  const nextTitle = String(editingHistoryTitle.value ?? '').trim();

  const entries = Array.isArray(summaryHistory.value) ? summaryHistory.value : [];
  const nextEntries = entries.map((existing) => {
    if (String(existing?.id ?? '') !== id) {
      return existing;
    }
    return {
      ...existing,
      title: nextTitle || String(existing?.title ?? ''),
      text,
    };
  });

  summaryHistory.value = nextEntries;
  await saveSummaryHistory();
  cancelEditingHistoryEntry();
  setCopyStatus('Saved');
};

const deleteHistoryEntry = async (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return;
  }

  const ok = window.confirm('Delete this saved summary?');
  if (!ok) {
    return;
  }

  const entries = Array.isArray(summaryHistory.value) ? summaryHistory.value : [];
  summaryHistory.value = entries.filter((existing) => String(existing?.id ?? '') !== id);

  if (editingHistoryId.value === id) {
    cancelEditingHistoryEntry();
  }

  expandedHistoryTextIds.value = new Set(
    Array.from(expandedHistoryTextIds.value).filter((value) => value !== id)
  );

  await saveSummaryHistory();
  setCopyStatus('Deleted');
};

const isHistoryTextExpanded = (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return false;
  }
  return expandedHistoryTextIds.value.has(id);
};

const toggleHistoryTextExpanded = (entry) => {
  const id = String(entry?.id ?? '').trim();
  if (!id) {
    return;
  }
  const next = new Set(expandedHistoryTextIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedHistoryTextIds.value = next;
};

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

onMounted(() => {
  loadSummaries();
});

onUnmounted(() => {
  if (copyStatusTimer) {
    window.clearTimeout(copyStatusTimer);
  }
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }
});
</script>

<template>
  <section class="summary">
    <header class="summary__header">
      <div>
        <h1 class="summary__title">Summary</h1>
        <p class="summary__subtitle">
          Completed tasks for {{ dateRangeLabel || 'the selected date range' }}
        </p>
      </div>
      <div v-if="isSummarizeActive" class="summary__meta">
        <span class="summary__count">
          {{ visibleCount }}
          <template v-if="totalCount > visibleCount">/ {{ totalCount }}</template>
        </span>
      </div>
    </header>

    <nav class="summary__tabs" aria-label="Summary sections">
      <button
        type="button"
        :class="['summary__tab', { 'summary__tab--active': activeSection === 'summarize' }]"
        @click="activeSection = 'summarize'"
      >
        Summarize
      </button>
      <button
        type="button"
        :class="['summary__tab', { 'summary__tab--active': activeSection === 'history' }]"
        @click="activeSection = 'history'"
      >
        History
      </button>
    </nav>

    <div v-if="isSummarizeActive" class="summary__panel summary__panel--summarize">
      <div class="summary__toolbar">
        <label class="summary__toggle">
          <input v-model="showAll" type="checkbox" class="summary__toggle-input" />
          <span>Show all tasks</span>
        </label>
        <button
          type="button"
          class="summary__action"
          :disabled="unhiddenEntries.length === 0"
          @click="handleUpdateNotesWithVisibleTasks"
        >
          Send visible tasks to Notes
        </button>
        <span v-if="copyStatus" class="summary__hint" aria-live="polite">{{ copyStatus }}</span>
        <span v-if="showAll && hiddenCount > 0" class="summary__hint">
          Hidden tasks are highlighted. Use Show to unhide them.
        </span>
      </div>

      <div class="summary__section">
        <div class="summary__date-filter" aria-live="polite">
          <div class="summary__date-filter-summary">
            <span class="summary__date-filter-hint">
              {{ dateRangeLabel || 'Select a date range' }}
            </span>
            <button
              type="button"
              class="summary__date-filter-toggle"
              @click="toggleDateControls"
            >
              {{ showDateControls ? 'Hide Date Controls' : 'Adjust Date' }}
            </button>
          </div>
          <div v-if="showDateControls" class="summary__date-filter-fields">
            <label class="summary__date-filter-field">
              <span class="summary__date-filter-label">From</span>
              <input
                v-model="selectedStartDate"
                type="date"
                class="summary__date-filter-input"
                :max="dateFilterMax"
              />
            </label>
            <label class="summary__date-filter-field">
              <span class="summary__date-filter-label">To</span>
              <input
                v-model="selectedEndDate"
                type="date"
                class="summary__date-filter-input"
                :max="dateFilterMax"
              />
            </label>
          </div>
        </div>

        <p v-if="isEmpty" class="summary__empty">
          <span v-if="totalCount === 0">No completed tasks logged for this range.</span>
          <span v-else>All completed tasks are hidden. Enable Show all to review them.</span>
        </p>

        <div v-else class="summary__groups">
          <section
            v-for="group in groupedEntries"
            :key="group.key"
            class="summary__group"
          >
            <header class="summary__group-header">
              <h2 class="summary__group-title">{{ group.label }}</h2>
              <span class="summary__count summary__count--inline">{{ group.items.length }}</span>
            </header>
            <ul class="summary__list">
              <li
                v-for="entry in group.items"
                :key="entry.id"
                :class="[
                  'summary__item',
                  { 'summary__item--hidden': showAll && isHidden(buildKey(entry)) },
                ]"
              >
                <div class="summary__item-header">
                  <span class="summary__item-title">{{ entry.title }}</span>
                  <time class="summary__item-meta" :datetime="entry.completedAt">
                    <IconGlyph name="check" size="16" class="summary__item-icon" />
                    {{ formatTimestamp(entry.completedAt) }}
                  </time>
                  <span v-if="entry.workedOn" class="summary__worked-on">Worked on</span>
                </div>
                <p v-if="entry.description" class="summary__item-description">
                  {{ entry.description }}
                </p>
                <div v-if="entry.completionNotes" class="summary__completion-notes">
                  <p class="summary__completion-notes-label">Completion Notes</p>
                  <p class="summary__completion-notes-body">{{ entry.completionNotes }}</p>
                </div>
                <span class="summary__list-pill">
                  <IconGlyph name="folder" size="16" class="summary__pill-icon" />
                  <span class="summary__list-text">{{ resolveListName(entry.listId) }}</span>
                </span>
                <div class="summary__item-actions">
                  <button
                    v-if="!showAll"
                    type="button"
                    class="summary__item-toggle"
                    @click="hideEntry(entry)"
                  >
                    Hide
                  </button>
                  <button
                    v-else-if="isHidden(buildKey(entry))"
                    type="button"
                    class="summary__item-toggle summary__item-toggle--show"
                    @click="showEntry(entry)"
                  >
                    Show
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <article class="summary__notes-section">
        <header class="summary__notes-header">
          <h2 class="summary__notes-title">Summary Text</h2>
          <div class="summary__notes-actions">
            <button
              type="button"
              class="summary__notes-copy"
              :disabled="!summaryNotes.trim()"
              @click="handleClearSummaryText"
            >
              Clear
            </button>
            <button
              type="button"
              class="summary__notes-copy"
              :disabled="!summaryNotes.trim()"
              @click="handleSaveNotesToHistory"
            >
              Save
            </button>
            <button
              type="button"
              class="summary__notes-copy"
              :disabled="!summaryNotes.trim()"
              @click="handleCopyNotes"
            >
              Copy Notes
            </button>
          </div>
        </header>
        <textarea
          v-model="summaryNotes"
          class="summary__notes-textarea"
          placeholder="Add your summary text here..."
          @input="handleNotesInput"
        ></textarea>
        <p v-if="summaryNotesSaving || summaryHistorySaving" class="summary__notes-status">
          <template v-if="summaryNotesSaving">Saving notes...</template>
          <template v-else>Saving history...</template>
        </p>
      </article>
    </div>

    <div v-else class="summary__panel summary__panel--history">
      <p v-if="copyStatus" class="summary__hint" aria-live="polite">{{ copyStatus }}</p>

      <p v-if="sortedSummaryHistory.length === 0" class="summary__empty">
        No saved summaries yet.
      </p>

      <div v-else class="summary__history-list">
        <article
          v-for="entry in sortedSummaryHistory"
          :key="entry.id || entry.createdAt || entry.title"
          class="summary__history-item"
        >
          <header class="summary__history-header">
            <div class="summary__history-heading">
              <h2 class="summary__history-title">{{ entry.title || 'Saved summary' }}</h2>
              <time class="summary__history-meta" :datetime="entry.createdAt">
                {{ formatHistoryTimestamp(entry.createdAt) }}
              </time>
            </div>
            <div class="summary__history-actions">
              <button
                v-if="editingHistoryId !== entry.id"
                type="button"
                class="summary__notes-copy"
                @click="toggleHistoryTextExpanded(entry)"
              >
                {{ isHistoryTextExpanded(entry) ? 'Hide Text' : 'Show Text' }}
              </button>
              <button
                v-if="editingHistoryId !== entry.id"
                type="button"
                class="summary__notes-copy"
                @click="startEditingHistoryEntry(entry)"
              >
                Edit
              </button>
              <button
                type="button"
                class="summary__notes-copy"
                @click="deleteHistoryEntry(entry)"
              >
                Delete
              </button>
            </div>
          </header>

          <div v-if="editingHistoryId === entry.id" class="summary__history-editor">
            <label class="summary__history-field">
              <span class="summary__history-field-label">Title</span>
              <input v-model="editingHistoryTitle" type="text" class="summary__history-input" />
            </label>
            <label class="summary__history-field">
              <span class="summary__history-field-label">Text</span>
              <textarea v-model="editingHistoryText" class="summary__history-textarea"></textarea>
            </label>
            <div class="summary__history-editor-actions">
              <button type="button" class="summary__notes-copy" @click="saveEditingHistoryEntry">
                Save
              </button>
              <button type="button" class="summary__notes-copy" @click="cancelEditingHistoryEntry">
                Cancel
              </button>
            </div>
          </div>

          <pre
            v-else-if="isHistoryTextExpanded(entry)"
            class="summary__history-text"
          >{{ entry.text }}</pre>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.summary {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 1.5rem;
  overflow: hidden;
}

.summary__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary__tab {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 999px;
  padding: 0.35rem 1rem;
  font-weight: 700;
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

.summary__tab--active {
  border-color: rgba(34, 197, 94, 0.65);
  background: rgba(34, 197, 94, 0.1);
  color: theme.$color-text-heading;
}

.summary__panel {
  min-height: 0;
  overflow: hidden;
}

.summary__panel--summarize {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1.5rem;
}

.summary__panel--history {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  padding: 1.25rem;
  overflow: auto;
  display: grid;
  gap: 1rem;
  align-content: start;
}

.summary__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.summary__subtitle {
  margin: 0.2rem 0 0;
  color: theme.$color-text-muted;
}

.summary__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.summary__count--inline {
  font-size: 0.9rem;
}

.summary__toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.summary__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-heading;
  user-select: none;
}

.summary__toggle-input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: theme.$color-accent;
}

.summary__hint {
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.summary__action {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, opacity 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.summary__section {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  grid-template-rows: auto 1fr;
  min-height: 0;
  overflow: hidden;
}

.summary__notes-section {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 0.5rem;
  background: rgba(23, 23, 24, 0.6);
  border: 1px solid theme.$color-border-strong;
  grid-template-rows: auto 1fr auto;
  min-height: 20rem;
  max-height: 28rem;
  overflow: hidden;
}

.summary__notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary__notes-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.summary__notes-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.summary__notes-copy {
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
    border-color: theme.$color-accent;
    background: rgba(34, 197, 94, 0.15);
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

.summary__notes-textarea {
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

.summary__history-list {
  display: grid;
  gap: 1rem;
  grid-auto-rows: min-content;
  align-content: start;
}

.summary__history-item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.75rem;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  align-self: start;
}

.summary__history-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: baseline;
}

.summary__history-heading {
  display: grid;
  gap: 0.15rem;
}

.summary__history-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.summary__history-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.summary__history-meta {
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.summary__history-text {
  margin: 0;
  padding: 0.75rem;
  border: 1px solid theme.$color-border-input;
  border-radius: 0.5rem;
  background: rgba(12, 12, 13, 0.6);
  color: theme.$color-text-primary;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.summary__history-editor {
  display: grid;
  gap: 0.75rem;
}

.summary__history-field {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.summary__history-field-label {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$color-text-muted;
}

.summary__history-input,
.summary__history-textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid theme.$color-border-input;
  border-radius: 0.5rem;
  padding: 0.6rem 0.75rem;
  color: theme.$color-text-primary;
  font: inherit;
}

.summary__history-textarea {
  min-height: 220px;
  resize: vertical;
  white-space: pre-wrap;
}

.summary__history-input:focus-visible,
.summary__history-textarea:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.summary__history-editor-actions {
  display: inline-flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.summary__notes-status {
  margin: 0;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
  font-style: italic;
}

.summary__date-filter {
  display: grid;
  gap: 0.75rem;
}

.summary__date-filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.summary__date-filter-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary__date-filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.summary__date-filter-label {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$color-text-muted;
}

.summary__date-filter-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid theme.$color-border-input;
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
  color: theme.$color-text-primary;
  font: inherit;
}

.summary__date-filter-input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.summary__date-filter-hint {
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.summary__date-filter-toggle {
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

.summary__empty {
  margin: 0;
  padding: 1.25rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 0.75rem;
  color: theme.$color-text-muted;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
}

.summary__groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
  min-height: 0;
}

.summary__group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary__group-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  justify-content: space-between;
}

.summary__group-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: theme.$color-text-heading;
}

.summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-auto-rows: min-content;
}

.summary__item {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.9rem;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.6rem;
}

.summary__item--hidden {
  border-color: rgba(34, 197, 94, 0.65);
  background: rgba(34, 197, 94, 0.08);
}

.summary__item-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.summary__item-title {
  font-weight: 700;
  color: theme.$color-text-heading;
}

.summary__item-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.summary__worked-on {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  border: 1px solid theme.$color-border-input;
  color: theme.$color-text-heading;
}

.summary__item-description {
  margin: 0;
  color: theme.$color-text-primary;
  white-space: pre-wrap;
}

.summary__completion-notes {
  border-left: 3px solid theme.$color-accent;
  padding-left: 0.75rem;
  display: grid;
  gap: 0.25rem;
}

.summary__completion-notes-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$color-text-muted;
}

.summary__completion-notes-body {
  margin: 0;
  color: theme.$color-text-primary;
  white-space: pre-wrap;
}

.summary__list-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  border: 1px solid theme.$color-border-input;
  width: fit-content;
  color: theme.$color-text-muted;
}

.summary__list-text {
  color: theme.$color-text-muted;
  font-size: 0.85rem;
}

.summary__item-actions {
  display: flex;
  justify-content: flex-end;
}

.summary__item-toggle {
  border: 1px solid theme.$color-border-input;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
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

.summary__item-toggle--show {
  border-color: rgba(34, 197, 94, 0.65);
}

@media (max-width: 720px) {
  .summary {
    gap: 1rem;
  }

  .summary__section {
    padding: 1rem;
  }

  .summary__item {
    padding: 0.8rem;
  }

  .summary__notes-section {
    max-height: none;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .summary__notes-textarea {
    flex: 1;
    min-height: 260px;
  }
}
</style>

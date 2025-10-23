<script setup>
import { computed, ref, watch } from 'vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasksDueToday,
  tasksCompletedYesterday,
  tasksCompletedToday,
  lists,
} = useTaskStore();

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

const rawCompletedYesterday = computed(() => {
  return Array.isArray(tasksCompletedYesterday.value)
    ? tasksCompletedYesterday.value
    : [];
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

const hiddenTaskIds = ref(new Set());
const showAll = ref(false);

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

const displayedCompletedYesterday = computed(() => {
  const entries = orderedCompletedYesterday.value;
  if (showAll.value) {
    return entries;
  }
  return entries.filter((entry) => !isHidden(buildYesterdayKey(entry)));
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
const hasCompletedToday = computed(() => totalCompletedToday.value > 0);
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
    <div class="standup__grid">
      <article class="standup__section">
        <header class="standup__section-header">
          <h2>Completed Yesterday</h2>
          <span class="standup__count">
            {{ completedYesterdayCount }}
            <template v-if="totalCompletedYesterday > completedYesterdayCount">
              / {{ totalCompletedYesterday }}
            </template>
          </span>
        </header>
        <p v-if="completedYesterdayCount === 0" class="standup__empty">
          <span v-if="totalCompletedYesterday === 0">
            No completed tasks logged yesterday.
          </span>
          <span v-else>
            All completed tasks are hidden. Enable Show all to review them.
          </span>
        </p>
        <ul v-else class="standup__list">
          <li
            v-for="entry in displayedCompletedYesterday"
            :key="entry.taskId"
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
            </div>
            <p v-if="entry.description" class="standup__item-description">
              {{ entry.description }}
            </p>
            <time
              v-if="entry.due"
              class="standup__item-meta"
              :datetime="entry.due"
            >
              Originally due {{ formatTimestamp(entry.due) }}
            </time>
            <span class="standup__badge">List: {{ resolveListName(entry.listId) }}</span>
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
          <li
            v-if="draggingSection === 'yesterday'"
            class="standup__drop-zone"
            :class="{ 'standup__drop-zone--active': isDropZoneActive('yesterday') }"
            @dragenter.prevent="handleDropZoneEnter('yesterday')"
            @dragover.prevent
            @dragleave="handleDropZoneLeave('yesterday')"
            @drop.prevent="handleDropOnEnd('yesterday')"
          ></li>
        </ul>
      </article>
      <article class="standup__section">
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
            v-if="hasCompletedToday"
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
                :key="entry.taskId"
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
                </div>
                <p v-if="entry.description" class="standup__item-description">
                  {{ entry.description }}
                </p>
                <time
                  v-if="entry.due"
                  class="standup__item-meta"
                  :datetime="entry.due"
                >
                  Was due {{ formatTimestamp(entry.due) }}
                </time>
                <div class="standup__meta-row">
                  <span class="standup__badge">List: {{ resolveListName(entry.listId) }}</span>
                  <span v-if="entry.recurrence" class="standup__badge standup__badge--info">
                    Repeats: {{ entry.recurrence }}
                  </span>
                </div>
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
                  <time class="standup__item-meta" :datetime="task.due">
                    Due {{ formatTimeOnly(task.due) }}
                  </time>
                </div>
                <p v-if="task.description" class="standup__item-description">
                  {{ task.description }}
                </p>
                <div class="standup__meta-row">
                  <span class="standup__badge">List: {{ resolveListName(task.listId) }}</span>
                  <span v-if="task.recurrence" class="standup__badge standup__badge--info">
                    Repeats: {{ task.recurrence }}
                  </span>
                </div>
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
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.standup {
  display: grid;
  gap: 1.5rem;
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
}

.standup__section {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  grid-template-rows: min-content auto;
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
}

.standup__focus {
  display: grid;
  gap: 1.25rem;
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

.standup__item-description {
  margin: 0;
  color: #d4d4d8;
  opacity: 0.85;
}

.standup__meta-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.standup__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.standup__badge--info {
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
}

.standup__item-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
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
</style>

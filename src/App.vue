<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AddEditTaskModal from './components/AddEditTaskModal.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TaskNotifications from './components/TaskNotifications.vue';
import CompletionNotesModal from './components/CompletionNotesModal.vue';
import IconGlyph from './components/IconGlyph.vue';
import { useTaskStore } from './stores/useTaskStore';

const {
  notifications,
  dismissNotification,
  teardown,
  tasks,
  addTask,
  toggleTaskCompletion,
  reviveCompletedTask,
  updateCompletedTaskNotes,
  tasksDueToday,
  tasksDueTodayPastDue,
  tasksDueTomorrow,
  tasksOverdue,
  activeTasks,
  lists,
  addList,
  removeList,
  reorderList,
  activeCountsByList,
  sortedCompletedTasks,
  refreshFromStorage,
  lastSavedAt,
  storageStatus,
} = useTaskStore();

const showForm = ref(false);
const isSidebarCollapsed = ref(false);
const isListsSectionCollapsed = ref(false);
const addTaskButtonRef = ref(null);
const DEFAULT_LIST_ID = 'default';
const DEFAULT_SIDEBAR_WIDTH = 380;
const MIN_SIDEBAR_WIDTH = 256;
const MAX_SIDEBAR_WIDTH = 480;
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const lastExpandedWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const isResizingSidebar = ref(false);
const pointerStartX = ref(0);
const pointerStartWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const showListDeleteDialog = ref(false);
const listPendingDelete = ref(null);

const draggedListId = ref(null);
const dragOverListId = ref(null);
const layoutStyle = computed(() => {
  if (isSidebarCollapsed.value) {
    return {};
  }
  return { '--sidebar-width': `${Math.round(sidebarWidth.value)}px` };
});
let hasInitializedVisibility = false;
const route = useRoute();
const router = useRouter();

const STANDUP_SETTING_STORAGE_KEY = 'todo-list.standup-enabled';
const FONT_SIZE_SETTING_STORAGE_KEY = 'todo-list.font-size';
const isStandupEnabled = ref(true);
const fontSizeSetting = ref('large');
const showCompletionNotesModal = ref(false);
const completionNotesTargetId = ref(null);
const completionNotesInitial = ref('');
const completionNotesTaskTitle = ref('');
const storageBannerVisible = ref(false);
const storageBannerMessage = ref('');
let storageBannerTimer = null;

watch(
  storageStatus,
  (status) => {
    if (!status?.ok && status?.message) {
      storageBannerMessage.value = status.message;
      storageBannerVisible.value = true;
      if (storageBannerTimer) {
        window.clearTimeout(storageBannerTimer);
        storageBannerTimer = null;
      }
      return;
    }

    if (storageBannerVisible.value) {
      if (storageBannerTimer) {
        window.clearTimeout(storageBannerTimer);
      }
      storageBannerTimer = window.setTimeout(() => {
        storageBannerVisible.value = false;
        storageBannerMessage.value = '';
        storageBannerTimer = null;
      }, 2000);
    }
  },
  { immediate: true, deep: true }
);

const applyFontSizeSetting = (value) => {
  const root = document.documentElement;
  if (!root) {
    return;
  }
  root.style.fontSize = value === 'small' ? '80%' : '100%';
};

const storedStandupSetting = window.localStorage.getItem(STANDUP_SETTING_STORAGE_KEY);
if (storedStandupSetting === 'false') {
  isStandupEnabled.value = false;
} else if (storedStandupSetting === 'true') {
  isStandupEnabled.value = true;
}

const storedFontSize = window.localStorage.getItem(FONT_SIZE_SETTING_STORAGE_KEY);
if (storedFontSize === 'small' || storedFontSize === 'large') {
  fontSizeSetting.value = storedFontSize;
}

const clampSidebarWidth = (value) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

const defaultDueDate = computed(() => {
  const currentPath = typeof route.path === 'string' ? route.path : '';
  const isTodayRoute = currentPath.startsWith('/today');
  const isTomorrowRoute = currentPath.startsWith('/tomorrow');

  if (!isTodayRoute && !isTomorrowRoute) {
    return null;
  }

  const target = new Date();
  if (isTomorrowRoute) {
    target.setDate(target.getDate() + 1);
  }

  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const listCounts = computed(() => activeCountsByList.value ?? {});
const activeListId = computed(() => {
  if (typeof route.params?.id !== 'string') {
    return null;
  }
  return route.path.startsWith('/lists/') ? route.params.id : null;
});
const defaultListIdForForm = computed(() => {
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  if (!availableLists.length) {
    return null;
  }
  const candidate = activeListId.value;
  if (candidate && availableLists.some((list) => list.id === candidate)) {
    return candidate;
  }
  return availableLists[0].id;
});

const todayCount = computed(() => tasksDueToday.value?.length ?? 0);
const todayDueCount = computed(() => tasksDueTodayPastDue.value?.length ?? 0);
const tomorrowCount = computed(() => tasksDueTomorrow.value?.length ?? 0);
const overdueCount = computed(() => tasksOverdue.value?.length ?? 0);
const allCount = computed(() => activeTasks.value?.length ?? 0);

const todayLabel = computed(() => `Today (${shortDateFormatter.format(new Date())})`);
const tomorrowLabel = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `Tomorrow (${shortDateFormatter.format(tomorrow)})`;
});

const primaryNavLinks = computed(() => {
  const links = [];

  if (isStandupEnabled.value) {
    links.push({
      to: '/standup',
      label: 'Standup',
      icon: 'person',
      count: null,
    });
  }

  links.push(
    {
      to: '/overdue',
      label: 'Overdue',
      icon: 'exclamation',
      count: overdueCount.value,
    },
    {
      to: '/today',
      label: todayLabel.value,
      icon: 'sun',
      count: todayCount.value,
      secondaryCount: todayDueCount.value,
    },
    {
      to: '/tomorrow',
      label: tomorrowLabel.value,
      icon: 'sunrise',
      count: tomorrowCount.value,
    },
    {
      to: '/all',
      label: 'All Tasks',
      icon: 'layers',
      count: allCount.value,
    },
    {
      to: '/completed',
      label: 'Completed',
      icon: 'check',
      count: null,
    }
  );

  return links;
});

const handleCreateList = () => {
  const name = window.prompt('List name');
  if (!name) {
    return;
  }
  const created = addList(name);
  if (created) {
    router.push(`/lists/${created.id}`);
  }
};

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const toggleListsSection = () => {
  isListsSectionCollapsed.value = !isListsSectionCollapsed.value;
};

const resetDeleteListState = () => {
  showListDeleteDialog.value = false;
  listPendingDelete.value = null;
};

const requestDeleteList = (list) => {
  if (!list || list.id === DEFAULT_LIST_ID) {
    return;
  }
  listPendingDelete.value = list;
  showListDeleteDialog.value = true;
};

const handleCancelDeleteList = () => {
  resetDeleteListState();
};


const handleConfirmDeleteList = () => {
  if (!listPendingDelete.value) {
    resetDeleteListState();
    return;
  }

  const targetId = listPendingDelete.value.id;
  resetDeleteListState();

  const removed = removeList(targetId);
  if (!removed) {
    return;
  }

  if (route.path === `/lists/${targetId}`) {
    const remainingLists = (Array.isArray(lists.value) ? lists.value : []).filter(
      (list) => list.id !== targetId
    );
    if (remainingLists.length > 0) {
      router.push(`/lists/${remainingLists[0].id}`);
    } else {
      router.push('/today');
    }
  }
};

const handleListDragStart = (list) => {
  draggedListId.value = list?.id ?? null;
};

const handleListDragEnd = () => {
  draggedListId.value = null;
  dragOverListId.value = null;
};

const handleListDragEnter = (list) => {
  if (!draggedListId.value) {
    return;
  }
  if (!list) {
    dragOverListId.value = null;
    return;
  }
  if (list.id === draggedListId.value) {
    return;
  }
  dragOverListId.value = list.id;
};

const handleListDrop = (list) => {
  if (!draggedListId.value || !list || list.id === draggedListId.value) {
    handleListDragEnd();
    return;
  }

  reorderList({ id: draggedListId.value, beforeId: list.id });
  handleListDragEnd();
};

const handleListDropAtEnd = () => {
  if (!draggedListId.value) {
    return;
  }
  reorderList({ id: draggedListId.value, beforeId: null });
  handleListDragEnd();
};

const onSidebarResizePointerMove = (event) => {
  if (!isResizingSidebar.value) {
    return;
  }
  const delta = event.clientX - pointerStartX.value;
  sidebarWidth.value = clampSidebarWidth(pointerStartWidth.value + delta);
};

const stopSidebarResize = () => {
  if (!isResizingSidebar.value) {
    return;
  }
  isResizingSidebar.value = false;
  window.removeEventListener('pointermove', onSidebarResizePointerMove);
  window.removeEventListener('pointerup', stopSidebarResize);
  window.removeEventListener('pointercancel', stopSidebarResize);
  if (!isSidebarCollapsed.value) {
    sidebarWidth.value = clampSidebarWidth(sidebarWidth.value);
    lastExpandedWidth.value = sidebarWidth.value;
  }
};

const beginSidebarResize = (event) => {
  if (isSidebarCollapsed.value) {
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  isResizingSidebar.value = true;
  pointerStartX.value = event.clientX;
  pointerStartWidth.value = sidebarWidth.value;
  window.addEventListener('pointermove', onSidebarResizePointerMove);
  window.addEventListener('pointerup', stopSidebarResize);
  window.addEventListener('pointercancel', stopSidebarResize);
  if (typeof event.target?.setPointerCapture === 'function') {
    event.target.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
};

const handleAddTask = (payload) => {
  addTask(payload);
  // Focus the Add a Task button after task is added
  if (addTaskButtonRef.value) {
    addTaskButtonRef.value.focus();
  }
};

const closeCompletionNotesModal = () => {
  showCompletionNotesModal.value = false;
  completionNotesTargetId.value = null;
  completionNotesInitial.value = '';
  completionNotesTaskTitle.value = '';
};

const openCompletionNotesModal = (completedId) => {
  if (!completedId) {
    return;
  }
  const entry =
    sortedCompletedTasks.value?.find((item) => item.id === completedId) || null;
  if (!entry) {
    return;
  }
  completionNotesTargetId.value = entry.id;
  completionNotesTaskTitle.value = entry.title ?? '';
  completionNotesInitial.value = entry.completionNotes ?? '';
  showCompletionNotesModal.value = true;
};

const handleSaveCompletionNotes = (notes) => {
  if (completionNotesTargetId.value) {
    updateCompletedTaskNotes(completionNotesTargetId.value, notes);
  }
  closeCompletionNotesModal();
};

const handleCancelCompletionNotes = () => {
  closeCompletionNotesModal();
};

const handleNotificationAction = ({ id, action }) => {
  if (!action) {
    return;
  }

  if (action.type === 'undo-completed-task') {
    const completedId = action.payload?.completedId ?? null;
    const taskId = action.payload?.taskId ?? null;

    if (completedId) {
      reviveCompletedTask(completedId, { suppressNotification: true });
      dismissNotification(id);
      return;
    }

    if (taskId !== undefined && taskId !== null) {
      const match =
        sortedCompletedTasks.value?.find(
          (entry) => entry.id === taskId || entry.taskId === taskId
        ) || null;
      if (match) {
        reviveCompletedTask(match.id, { suppressNotification: true });
        dismissNotification(id);
        return;
      }
    }
  }

  if (action.type === 'add-completion-notes') {
    const completedId = action.payload?.completedId;
    if (completedId) {
      openCompletionNotesModal(completedId);
    }
    dismissNotification(id);
    return;
  }

  if (action.type === 'undo-revive-task') {
    const taskId = action.payload?.taskId;
    if (taskId !== undefined && taskId !== null) {
      // Re-complete the task by toggling it back
      toggleTaskCompletion(taskId, { suppressNotification: true });
    }
    dismissNotification(id);
    return;
  }

  dismissNotification(id);
};

watch(
  isStandupEnabled,
  (enabled) => {
    window.localStorage.setItem(STANDUP_SETTING_STORAGE_KEY, String(enabled));
  },
  { immediate: true }
);

watch(
  [isStandupEnabled, () => route.path],
  ([enabled, currentPath]) => {
    if (!enabled && typeof currentPath === 'string' && currentPath.startsWith('/standup')) {
      router.replace('/today');
    }
  },
  { immediate: true }
);

onMounted(() => {
});

watch(isSidebarCollapsed, (collapsed) => {
  if (collapsed) {
    lastExpandedWidth.value = sidebarWidth.value;
    stopSidebarResize();
    return;
  }
  sidebarWidth.value = clampSidebarWidth(lastExpandedWidth.value);
});

watch(
  tasks,
  (value) => {
    if (!hasInitializedVisibility) {
      hasInitializedVisibility = true;
      return;
    }
    if (Array.isArray(value) && value.length === 0) {
      showForm.value = true;
    }
  },
  { immediate: true }
);

watch(
  fontSizeSetting,
  (value) => {
    window.localStorage.setItem(FONT_SIZE_SETTING_STORAGE_KEY, value);
    applyFontSizeSetting(value);
  },
  { immediate: true }
);

onUnmounted(() => {
  stopSidebarResize();
  teardown();
});
</script>

<template>
  <div v-if="storageBannerVisible" class="storage-banner" role="alert">
    <span class="storage-banner__text">{{ storageBannerMessage }}</span>
  </div>
  <TaskNotifications
    :notifications="notifications"
    @dismiss="dismissNotification"
    @action="handleNotificationAction"
  />
  <CompletionNotesModal
    v-model:visible="showCompletionNotesModal"
    :task-title="completionNotesTaskTitle"
    :initial-notes="completionNotesInitial"
    @save="handleSaveCompletionNotes"
    @cancel="handleCancelCompletionNotes"
  />
  <div class="layout" :class="{ 'layout--collapsed': isSidebarCollapsed }" :style="layoutStyle">
    <aside
      :class="['layout__sidebar', { 'layout__sidebar--collapsed': isSidebarCollapsed }]"
      :aria-expanded="!isSidebarCollapsed"
    >
      <div class="layout__sidebar-content" :class="{ 'layout__sidebar-content--collapsed': isSidebarCollapsed }">
        <div class="layout__sidebar-top" :class="{ 'layout__sidebar-top--hidden-title': isSidebarCollapsed }">
          <div class="layout__header">
            <h1 class="layout__title">TODOs</h1>
            <button
              type="button"
              class="layout__collapse-toggle"
              :aria-expanded="!isSidebarCollapsed"
              :aria-label="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              @click="toggleSidebar"
            >
              <IconGlyph
                :name="isSidebarCollapsed ? 'chevron-right' : 'chevron-left'"
                size="22"
                class="layout__collapse-icon"
                aria-hidden="true"
              />
            </button>
          </div>
          <nav class="layout__nav">
            <RouterLink
              v-for="link in primaryNavLinks"
              :key="link.to"
              v-tooltip="isSidebarCollapsed ? link.label : undefined"
              :to="link.to"
              class="layout__link"
              active-class="layout__link--active"
            >
              <span class="layout__nav-icon" aria-hidden="true">
                <IconGlyph :name="link.icon" size="22" />
              </span>
              <span class="layout__nav-label">{{ link.label }}</span>
              <span
                v-if="(link.secondaryCount ?? 0) > 0 || link.count !== null"
                class="layout__nav-counts"
              >
                <span
                  v-if="link.secondaryCount > 0"
                  class="layout__nav-count layout__nav-count--due"
                  :aria-label="`${link.secondaryCount} due tasks today`"
                >
                  {{ link.secondaryCount }} due
                </span>
                <span
                  v-if="link.count !== null"
                  class="layout__list-count layout__nav-count"
                >
                  {{ link.count }}
                </span>
              </span>
            </RouterLink>
          </nav>
          <section class="layout__lists">
            <header class="layout__lists-header">
              <button
                v-tooltip="isSidebarCollapsed ? (isListsSectionCollapsed ? 'Expand lists' : 'Collapse lists') : undefined"
                type="button"
                class="layout__lists-toggle"
                :aria-expanded="!isListsSectionCollapsed"
                :aria-label="isListsSectionCollapsed ? 'Expand lists section' : 'Collapse lists section'"
                @click="toggleListsSection"
              >
                <IconGlyph
                  :name="isListsSectionCollapsed ? 'chevron-right' : 'chevron-down'"
                  size="14"
                  aria-hidden="true"
                />
                <span v-show="!isSidebarCollapsed" class="layout__lists-title">Lists</span>
              </button>
              <button
                v-show="!isSidebarCollapsed"
                v-tooltip="isSidebarCollapsed ? 'New List' : undefined"
                type="button"
                class="layout__add-list"
                @click="handleCreateList"
              >
                <IconGlyph
                  name="plus"
                  size="14"
                  class="layout__add-list-icon"
                  aria-hidden="true"
                />
                <span class="layout__add-list-text">New List</span>
              </button>
            </header>
            <nav
              v-show="!isListsSectionCollapsed"
              class="layout__list-nav"
              @dragover.prevent="handleListDragEnter(null)"
              @drop.prevent="handleListDropAtEnd"
            >
              <div
                v-for="list in lists"
                :key="list.id"
                class="layout__list-item"
                :class="{
                  'layout__list-item--drag-over': dragOverListId === list.id,
                  'layout__list-item--dragging': draggedListId === list.id,
                }"
                draggable="true"
                @dragstart="handleListDragStart(list)"
                @dragend="handleListDragEnd"
                @dragenter.prevent="handleListDragEnter(list)"
                @dragover.prevent
                @drop.prevent="handleListDrop(list)"
              >
                <RouterLink
                  v-tooltip="isSidebarCollapsed ? list.name : undefined"
                  :to="`/lists/${list.id}`"
                  class="layout__link layout__link--list"
                  active-class="layout__link--active"
                >
                  <span class="layout__list-icon" aria-hidden="true">
                    <IconGlyph name="folder" size="16" />
                  </span>
                  <span class="layout__list-name">{{ list.name }}</span>
                  <span class="layout__list-count">{{ listCounts[list.id] ?? 0 }}</span>
                </RouterLink>
              </div>
            </nav>
          </section>
        </div>
        <button
          ref="addTaskButtonRef"
          v-tooltip="isSidebarCollapsed ? 'Add a Task' : undefined"
          type="button"
          class="layout__add-task"
          @click="showForm = true"
        >
          <IconGlyph
            name="plus"
            size="18"
            class="layout__add-task-icon"
            aria-hidden="true"
          />
          <span class="layout__add-task-text">Add a Task</span>
        </button>
      </div>
      <RouterLink
        v-tooltip="isSidebarCollapsed ? 'Settings' : undefined"
        to="/settings"
        class="layout__link layout__settings-link"
        active-class="layout__link--active"
      >
        <IconGlyph name="settings" size="22" aria-hidden="true" />
        <span class="layout__nav-label">Settings</span>
      </RouterLink>
      <div
        v-show="!isSidebarCollapsed"
        class="layout__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        :aria-valuemin="MIN_SIDEBAR_WIDTH"
        :aria-valuemax="MAX_SIDEBAR_WIDTH"
        :aria-valuenow="Math.round(sidebarWidth)"
        :class="{ 'layout__resize-handle--active': isResizingSidebar }"
        @pointerdown.stop="beginSidebarResize"
      />
    </aside>
    <main class="layout__content">
      <RouterView />
    </main>
  </div>
  <AddEditTaskModal
    v-model:visible="showForm"
    :default-due-date="defaultDueDate"
    :lists="lists"
    :default-list-id="defaultListIdForForm"
    @submit="handleAddTask"
  />
  <ConfirmDialog
    v-model:open="showListDeleteDialog"
    title="Delete list?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="listPendingDelete?.name || ''"
    message="Deleting a list moves all of its tasks back into My Tasks."
    @confirm="handleConfirmDeleteList"
    @cancel="handleCancelDeleteList"
  />
</template>

<style scoped lang="scss">
@use './styles/theme' as theme;

.layout {
  --sidebar-width: minmax(16rem, 20rem);
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  color: theme.$color-text-heading;
  background: theme.$color-app-background;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

.layout--collapsed {
  --sidebar-width: 5.5rem;
}

.layout__sidebar {
  background: theme.$color-sidebar-background;
  border-right: 1px solid theme.$color-border-muted;
  padding: 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  position: relative;
}

.layout__sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-height: 0;
  flex: 1 1 auto;
}

.layout__sidebar-content--collapsed {
  align-items: center;
}

.layout__add-task {
  border: none;
  border-radius: 1rem;
  padding: 0.9rem 1.25rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(249, 115, 22, 0.85));
  color: theme.$color-text-inverted;
  font-size: 1rem;
  font-weight: 700;
  width: 100%;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  box-shadow: 0 20px 30px -26px rgba(239, 68, 68, 0.9);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 24px 40px -28px rgba(249, 115, 22, 0.85);
  }

  &:focus-visible {
    outline: 2px solid rgba(248, 113, 113, 0.8);
    outline-offset: 3px;
  }
}

.layout__add-task-icon {
  color: theme.$color-text-inverted;
}

.layout--collapsed .layout__add-task-text {
  display: none;
}

.layout__sidebar--collapsed {
  padding: 1.25rem 0.75rem;
  align-items: center;
  overflow: visible;
}

.layout__sidebar-top {
  display: grid;
  gap: 2rem;
}

.layout__resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 1rem;
  height: 100%;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.layout__resize-handle::before {
  content: '';
  width: 0.25rem;
  height: 2.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  transition: background 0.2s ease;
}

.layout__resize-handle:hover::before,
.layout__resize-handle--active::before {
  background: theme.$color-accent;
}

.layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.layout__collapse-toggle {
  border: 1px solid theme.$color-border-muted;
  background: rgba(255, 255, 255, 0.08);
  color: theme.$color-text-heading;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, color 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: theme.$color-accent;
    color: #1b1b1d;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.layout__collapse-icon {
  color: currentColor;
}

.layout__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: theme.$color-text-heading;
  flex: 1 1 auto;
  min-width: 0;
}

.layout__nav {
  display: grid;
  gap: 0.75rem;
}

.layout__lists {
  display: grid;
  gap: 0.65rem;
  margin-top: 1.5rem;
}

.layout__lists-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.layout__lists-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: theme.$color-text-muted;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
}

.layout__lists-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: inherit;
}

.layout__add-list {
  border: 1px solid theme.$color-border-muted;
  background: transparent;
  color: theme.$color-text-muted;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(239, 68, 68, 0.12);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.layout__list-nav {
  display: grid;
  gap: 0.5rem;
}

.layout__list-item {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 0.35rem;
  cursor: grab;
}

.layout__list-item--drag-over {
  outline: 2px dashed theme.$color-accent;
  outline-offset: 2px;
}

.layout__list-item--dragging {
  opacity: 0.6;
}



.layout__link {
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 0.55rem 0.9rem;
  color: theme.$color-text-muted;
  text-decoration: none;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.layout__link:hover {
  color: theme.$color-text-heading;
  border-color: theme.$color-border-muted;
  background: rgba(255, 255, 255, 0.04);
  transform: translateX(2px);
}

.layout__link--active {
  border-color: theme.$color-accent;
  background: theme.$color-accent;
  color: #1b1b1d;
  box-shadow: 0 10px 25px -20px rgba(239, 68, 68, 0.9);
}

.layout__link--list {
  font-size: 0.95rem;
}

.layout__list-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout__list-count {
  flex: 0 0 auto;
  min-width: 2.25rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: inherit;
  opacity: 0.8;
}

.layout__link--active .layout__list-count {
  opacity: 1;
}

.layout__nav-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout__nav-counts {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.layout__nav-icon {
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  border-radius: 0.85rem;
  background: rgba(239, 68, 68, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.75rem;
  color: theme.$color-accent;
}

.layout--collapsed .layout__sidebar-top {
  width: 100%;
  align-items: center;
}

.layout--collapsed .layout__header {
  justify-content: center;
}

.layout--collapsed .layout__title {
  display: none;
}

.layout--collapsed .layout__nav,
.layout--collapsed .layout__list-nav {
  width: 100%;
}

.layout--collapsed .layout__link {
  justify-content: center;
  padding: 0.5rem;
}

.layout--collapsed .layout__nav-label,
.layout--collapsed .layout__nav-counts,
.layout--collapsed .layout__list-name,
.layout--collapsed .layout__list-count {
  display: none;
}

.layout--collapsed .layout__nav-icon {
  margin-right: 0;
}

.layout--collapsed .layout__add-task {
  width: 100%;
  justify-content: center;
  padding: 0.75rem;
}

.layout__link--active .layout__nav-icon {
  color: #1b1b1d;
}

.layout__list-icon {
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.5rem;
  color: theme.$color-text-muted;
}

.layout__add-list-icon {
  margin-right: 0.4rem;
}

.layout--collapsed .layout__add-list {
  display: none;
}

.layout--collapsed .layout__add-list-text {
  display: none;
}

.layout__sidebar-top--hidden-title .layout__title {
  display: none;
}

.layout__lists-header--hidden {
  display: none;
}

.layout--collapsed .layout__lists-header {
  justify-content: center;
}

.layout--collapsed .layout__lists-toggle {
  width: 100%;
  justify-content: center;
}

.layout__nav-count {
  min-width: 2rem;
}

.layout__nav-count--due {
  min-width: 0;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fecaca;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.layout__content {
  background: theme.$color-main-background;
  padding: 3rem clamp(1.5rem, 5vw, 3.5rem);
  display: block;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
}

.layout__settings-link {
  margin-top: auto;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.storage-banner {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(239, 68, 68, 0.92);
  color: #1b1b1d;
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.01em;
  border-bottom: 1px solid rgba(239, 68, 68, 0.7);
}

.storage-banner__text {
  display: inline-block;
}

</style>

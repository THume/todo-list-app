<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AddTaskForm from './components/AddTaskForm.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import TaskNotifications from './components/TaskNotifications.vue';
import { useTaskStore } from './stores/useTaskStore';

const {
  notifications,
  dismissNotification,
  teardown,
  tasks,
  addTask,
  toggleTaskCompletion,
  tasksDueToday,
  tasksDueTomorrow,
  tasksOverdue,
  activeTasks,
  lists,
  addList,
  removeList,
  activeCountsByList,
} = useTaskStore();

const showForm = ref(false);
const isSidebarCollapsed = ref(false);
const DEFAULT_LIST_ID = 'default';
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 256;
const MAX_SIDEBAR_WIDTH = 480;
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const lastExpandedWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const isResizingSidebar = ref(false);
const pointerStartX = ref(0);
const pointerStartWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const showListDeleteDialog = ref(false);
const listPendingDelete = ref(null);
const layoutStyle = computed(() => {
  if (isSidebarCollapsed.value) {
    return {};
  }
  return { '--sidebar-width': `${Math.round(sidebarWidth.value)}px` };
});
let hasInitializedVisibility = false;
const route = useRoute();
const router = useRouter();

const clampSidebarWidth = (value) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

const defaultDueDate = computed(() => {
  if (route.path !== '/today') {
    return null;
  }
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
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
const tomorrowCount = computed(() => tasksDueTomorrow.value?.length ?? 0);
const overdueCount = computed(() => tasksOverdue.value?.length ?? 0);
const allCount = computed(() => activeTasks.value?.length ?? 0);

const todayLabel = computed(() => `Today (${shortDateFormatter.format(new Date())})`);
const tomorrowLabel = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `Tomorrow (${shortDateFormatter.format(tomorrow)})`;
});

const handleCreateList = () => {
  if (typeof window === 'undefined') {
    return;
  }
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
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', onSidebarResizePointerMove);
    window.removeEventListener('pointerup', stopSidebarResize);
    window.removeEventListener('pointercancel', stopSidebarResize);
  }
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
  if (typeof window === 'undefined') {
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
};

const handleNotificationAction = ({ id, action }) => {
  if (!action) {
    return;
  }

  if (action.type === 'undo-completed-task') {
    const taskId = action.payload?.taskId;
    if (taskId !== undefined && taskId !== null) {
      toggleTaskCompletion(taskId, { suppressNotification: true });
    }
  }

  dismissNotification(id);
};

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

onUnmounted(() => {
  stopSidebarResize();
  teardown();
});
</script>

<template>
  <TaskNotifications
    :notifications="notifications"
    @dismiss="dismissNotification"
    @action="handleNotificationAction"
  />
  <div class="layout" :class="{ 'layout--collapsed': isSidebarCollapsed }" :style="layoutStyle">
    <aside
      :class="['layout__sidebar', { 'layout__sidebar--collapsed': isSidebarCollapsed }]"
      :aria-expanded="!isSidebarCollapsed"
    >
      <button
        type="button"
        class="layout__collapse-toggle"
        :aria-expanded="!isSidebarCollapsed"
        @click="toggleSidebar"
      >
        <span v-if="isSidebarCollapsed">Expand</span>
        <span v-else>Collapse</span>
      </button>
      <div v-show="!isSidebarCollapsed" class="layout__sidebar-content">
        <div class="layout__sidebar-top">
          <h1 class="layout__title">Todo List</h1>
          <nav class="layout__nav">
            <RouterLink to="/today" class="layout__link" active-class="layout__link--active">
              <span class="layout__nav-label">{{ todayLabel }}</span>
              <span class="layout__list-count layout__nav-count">{{ todayCount }}</span>
            </RouterLink>
            <RouterLink to="/tomorrow" class="layout__link" active-class="layout__link--active">
              <span class="layout__nav-label">{{ tomorrowLabel }}</span>
              <span class="layout__list-count layout__nav-count">{{ tomorrowCount }}</span>
            </RouterLink>
            <RouterLink to="/overdue" class="layout__link" active-class="layout__link--active">
              <span class="layout__nav-label">Overdue</span>
              <span class="layout__list-count layout__nav-count">{{ overdueCount }}</span>
            </RouterLink>
            <RouterLink to="/all" class="layout__link" active-class="layout__link--active">
              <span class="layout__nav-label">All Tasks</span>
              <span class="layout__list-count layout__nav-count">{{ allCount }}</span>
            </RouterLink>
            <RouterLink to="/completed" class="layout__link" active-class="layout__link--active">
              Completed
            </RouterLink>
          </nav>
          <section class="layout__lists">
            <header class="layout__lists-header">
              <span class="layout__lists-title">Lists</span>
              <button type="button" class="layout__add-list" @click="handleCreateList">
                New List
              </button>
            </header>
            <nav class="layout__list-nav">
              <div v-for="list in lists" :key="list.id" class="layout__list-item">
                <RouterLink
                  :to="`/lists/${list.id}`"
                  class="layout__link layout__link--list"
                  active-class="layout__link--active"
                >
                  <span class="layout__list-name">{{ list.name }}</span>
                  <span class="layout__list-count">{{ listCounts[list.id] ?? 0 }}</span>
                </RouterLink>
                <button
                  v-if="list.id !== DEFAULT_LIST_ID"
                  type="button"
                  class="layout__list-delete"
                  :aria-label="`Delete list ${list.name}`"
                  title="Delete list"
                  @click.stop="requestDeleteList(list)"
                >
                  &times;
                </button>
              </div>
            </nav>
          </section>
        </div>
        <AddTaskForm
          v-model:visible="showForm"
          class="layout__sidebar-form"
          :default-due-date="defaultDueDate"
          :lists="lists"
          :default-list-id="defaultListIdForForm"
          @submit="handleAddTask"
        />
      </div>
      <div
        v-show="!isSidebarCollapsed"
        class="layout__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        :aria-valuemin="MIN_SIDEBAR_WIDTH"
        :aria-valuemax="MAX_SIDEBAR_WIDTH"
        :aria-valuenow="Math.round(sidebarWidth)"
        @pointerdown.stop="beginSidebarResize"
        :class="{ 'layout__resize-handle--active': isResizingSidebar }"
      />
    </aside>
    <main class="layout__content">
      <RouterView />
    </main>
  </div>
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
  --sidebar-width: 4.75rem;
}

.layout__sidebar {
  background: theme.$color-sidebar-background;
  border-right: 1px solid theme.$color-border-muted;
  padding: 2.5rem 2rem;
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

.layout__sidebar--collapsed {
  padding: 1.25rem 1rem;
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

.layout__collapse-toggle {
  border: 1px solid theme.$color-border-muted;
  background: rgba(255, 255, 255, 0.06);
  color: theme.$color-text-heading;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  align-self: flex-end;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: theme.$color-accent;
    color: #1b1b1d;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.layout__sidebar--collapsed .layout__collapse-toggle {
  align-self: center;
}

.layout__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: theme.$color-text-heading;
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

.layout__lists-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: theme.$color-text-muted;
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
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.35rem;
}

.layout__list-delete {
  border: none;
  background: transparent;
  color: theme.$color-text-muted;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    color: theme.$color-text-heading;
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
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

.layout__nav-count {
  min-width: 2rem;
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

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .layout__sidebar {
    position: sticky;
    top: 0;
    z-index: 1;
    border-right: none;
    border-bottom: 1px solid theme.$color-border-muted;
    padding: 1.5rem 1.5rem 1.75rem;
    gap: 1.25rem;
    height: auto;
    min-height: auto;
  }

  .layout__sidebar-content {
    gap: 1.5rem;
  }

  .layout--collapsed {
    grid-template-columns: 1fr;
  }

  .layout__sidebar--collapsed {
    align-items: flex-end;
  }

  .layout__sidebar-top {
    gap: 1.25rem;
  }

  .layout__resize-handle {
    display: none;
  }

  .layout__nav {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .layout__lists {
    margin-top: 1rem;
  }

  .layout__list-nav {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .layout__list-item {
    grid-template-columns: 1fr auto;
  }

  .layout__list-delete {
    font-size: 0.85rem;
    padding: 0.2rem;
  }

  .layout__list-count {
    min-width: 1.75rem;
  }

  .layout__link {
    text-align: center;
  }

  .layout__link--list {
    text-align: left;
  }

  .layout__add-list {
    padding: 0.3rem 0.75rem;
  }

  .layout__sidebar-form {
    margin-top: 1rem;
  }

  .layout__content {
    height: auto;
    min-height: 0;
    overflow-y: visible;
  }
}
</style>

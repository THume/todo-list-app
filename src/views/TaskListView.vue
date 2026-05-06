<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AddEditTaskModal from '../components/AddEditTaskModal.vue';
import ListSettingsModal from '../components/ListSettingsModal.vue';
import RenameListModal from '../components/RenameListModal.vue';
import IconGlyph from '../components/IconGlyph.vue';
import { useTaskStore } from '../stores/useTaskStore';
import { findListBySlug, getListPath } from '../utils/listSlug';

const route = useRoute();
const router = useRouter();

const {
  tasks,
  lists,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  addTask,
  toggleSubtaskCompletion,
  moveTaskToToday,
  moveTaskToTomorrow,
  removeList,
  renameList,
  updateListSettings,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);
const showDuplicateDialog = ref(false);
const taskPendingDuplicate = ref(null);
const draggedTaskId = ref(null);
const dragOverTaskId = ref(null);
const dropIndicatorIndex = ref(-1);
const showDeleteListDialog = ref(false);
const showListSettingsDialog = ref(false);
const listMenuOpen = ref(false);
const listMenuButton = ref(null);
const listMenuPanel = ref(null);
const sortMode = ref('user');
const showRenameListModal = ref(false);

const activeList = computed(() => {
  const nameSlug = route.params.name;
  if (typeof nameSlug !== 'string' || !nameSlug.trim()) {
    return null;
  }
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  return findListBySlug(availableLists, nameSlug);
});

const activeListId = computed(() => {
  return activeList.value?.id ?? null;
});

const listTasks = computed(() => {
  if (!activeList.value) {
    return [];
  }

  const currentTasks = Array.isArray(tasks.value) ? tasks.value : [];
  return currentTasks.filter(
    (task) => task && !task.completed && task.listId === activeListId.value
  );
});

const sortedListTasks = computed(() => {
  const tasksToSort = listTasks.value ?? [];
  
  if (sortMode.value === 'due-date') {
    // Separate tasks into three categories
    const longTermTasks = tasksToSort.filter(task => task.isLongTerm);
    const tasksWithDueDate = tasksToSort.filter(task => !task.isLongTerm && task.dueDate);
    const tasksWithoutDueDate = tasksToSort.filter(task => !task.isLongTerm && !task.dueDate);
    
    // Sort tasks with due dates by due date
    tasksWithDueDate.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
    
    // Combine: long term tasks first, then tasks with due dates, then without
    return [...longTermTasks, ...tasksWithDueDate, ...tasksWithoutDueDate];
  }
  
  // Default 'user' sort - return in current order
  return tasksToSort;
});

const listNameById = computed(() => {
  const result = {};
  const available = Array.isArray(lists.value) ? lists.value : [];
  available.forEach((list) => {
    if (list && typeof list.id === 'string') {
      result[list.id] = typeof list.name === 'string' && list.name.trim().length > 0
        ? list.name.trim()
        : 'My Tasks';
    }
  });
  return result;
});

const resolveListName = (task) => {
  if (!task) {
    return listNameById.value.default ?? activeList.value?.name ?? 'My Tasks';
  }
  const listId = typeof task.listId === 'string' ? task.listId : '';
  const fallback = listNameById.value.default ?? activeList.value?.name ?? 'My Tasks';
  if (listId && listNameById.value[listId]) {
    return listNameById.value[listId];
  }
  return fallback;
};

const navigateToDefaultList = () => {
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  if (availableLists.length === 0) {
    router.push('/today');
    return;
  }
  router.push(getListPath(availableLists[0]));
};

const closeListMenu = () => {
  listMenuOpen.value = false;
};

const toggleListMenu = () => {
  listMenuOpen.value = !listMenuOpen.value;
};

const handleDocumentClick = (event) => {
  if (!listMenuOpen.value) {
    return;
  }

  const buttonEl = listMenuButton.value;
  const menuEl = listMenuPanel.value;
  const target = event.target;

  if (buttonEl && buttonEl.contains(target)) {
    return;
  }

  if (menuEl && menuEl.contains(target)) {
    return;
  }

  closeListMenu();
};

const handleRenameList = () => {
  if (!activeList.value) {
    return;
  }
  closeListMenu();
  showRenameListModal.value = true;
};

const handleRenameListSubmit = (newName) => {
  if (!activeList.value) {
    return;
  }
  renameList(activeList.value.id, newName);
};

const handleOpenSettings = () => {
  if (!activeList.value) {
    return;
  }
  closeListMenu();
  showListSettingsDialog.value = true;
};

const closeListSettings = () => {
  showListSettingsDialog.value = false;
};

const handleSaveListSettings = ({ listId, settings }) => {
  updateListSettings(listId, settings);
};

const requestDeleteList = () => {
  if (!activeList.value || activeList.value.id === 'default') {
    return;
  }
  closeListMenu();
  showDeleteListDialog.value = true;
};

const closeDeleteListDialog = () => {
  showDeleteListDialog.value = false;
};

const confirmDeleteList = () => {
  if (!activeList.value || activeList.value.id === 'default') {
    closeDeleteListDialog();
    return;
  }
  const targetId = activeList.value.id;
  const removed = removeList(targetId);
  closeDeleteListDialog();

  if (!removed) {
    return;
  }

  const remainingLists = (Array.isArray(lists.value) ? lists.value : []).filter(
    (list) => list.id !== targetId
  );

  if (remainingLists.length > 0) {
    router.push(getListPath(remainingLists[0]));
  } else {
    router.push('/today');
  }
};

const handleToggle = (task) => {
  toggleTaskCompletion(task.id);
};

const requestDelete = (task) => {
  taskPendingDelete.value = task;
  showDeleteDialog.value = true;
};

const closeDialog = () => {
  showDeleteDialog.value = false;
  taskPendingDelete.value = null;
};

const confirmDelete = () => {
  if (taskPendingDelete.value) {
    removeTask(taskPendingDelete.value.id);
  }
  closeDialog();
};

const startEdit = (task) => {
  if (task.completed) {
    return;
  }
  taskPendingEdit.value = task;
  showEditDialog.value = true;
};

const closeEdit = () => {
  showEditDialog.value = false;
};

const handleEditSave = (payload) => {
  updateTask(payload);
  closeEdit();
};

const handleDuplicate = (task) => {
  taskPendingDuplicate.value = task;
  showDuplicateDialog.value = true;
};

const closeDuplicate = () => {
  showDuplicateDialog.value = false;
};

const handleDuplicateSubmit = (payload) => {
  addTask(payload);
  closeDuplicate();
};

const handleMoveToToday = (task) => {
  moveTaskToToday(task.id);
};

const handleMoveToTomorrow = (task) => {
  moveTaskToTomorrow(task.id);
};

const handleToggleSubtask = ({ taskId, subtaskId }) => {
  toggleSubtaskCompletion(taskId, subtaskId);
};

const handleDragStart = (task) => {
  if (task.completed || task.listId !== activeListId.value) {
    return;
  }
  draggedTaskId.value = task.id;
};

const handleDragEnd = () => {
  draggedTaskId.value = null;
  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDragEnter = (task) => {
  if (
    !draggedTaskId.value
    || draggedTaskId.value === task.id
    || task.listId !== activeListId.value
  ) {
    return;
  }

  const allTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const draggedTask = allTasks.find((item) => item.id === draggedTaskId.value);
  if (!draggedTask || draggedTask.listId !== activeListId.value) {
    dropIndicatorIndex.value = -1;
    return;
  }
  const listItems = listTasks.value ?? [];
  const sourceIndexAll = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndexAll = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndexAll < 0 || targetIndexAll < 0) {
    dropIndicatorIndex.value = -1;
    return;
  }

  const sourceIndexList = listItems.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndexList = listItems.findIndex((item) => item.id === task.id);

  let indicatorIndex = targetIndexList >= 0 ? targetIndexList : 0;

  if (sourceIndexAll < targetIndexAll) {
    indicatorIndex = targetIndexList >= 0 ? targetIndexList + 1 : listItems.length;
  } else if (sourceIndexList >= 0 && targetIndexList >= 0) {
    indicatorIndex = targetIndexList;
  }

  dropIndicatorIndex.value = indicatorIndex;
  dragOverTaskId.value = task.id;
};

const handleDragLeave = (task) => {
  if (dragOverTaskId.value === task.id) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
  }
};

const handleDrop = (task) => {
  if (
    !draggedTaskId.value
    || draggedTaskId.value === task.id
    || task.listId !== activeListId.value
  ) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }

  const allTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const draggedTask = allTasks.find((item) => item.id === draggedTaskId.value);
  if (!draggedTask || draggedTask.listId !== activeListId.value) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }
  const sourceIndex = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndex = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndex < 0 || targetIndex < 0) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }

  let beforeId = task.id;
  if (sourceIndex < targetIndex) {
    const nextItem = allTasks[targetIndex + 1];
    beforeId = nextItem ? nextItem.id : null;
  }

  reorderTask({
    id: draggedTaskId.value,
    beforeId,
  });

  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDropAtListEnd = () => {
  if (!draggedTaskId.value || !activeList.value) {
    return;
  }

  const allTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const draggedTask = allTasks.find((item) => item.id === draggedTaskId.value);
  if (!draggedTask || draggedTask.listId !== activeListId.value) {
    handleDragEnd();
    return;
  }

  reorderTask({
    id: draggedTaskId.value,
    beforeId: null,
  });

  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleListDragOver = (event) => {
  if (!draggedTaskId.value || !activeList.value) {
    return;
  }
  if (event?.target !== event?.currentTarget) {
    return;
  }
  const allTasks = Array.isArray(tasks.value) ? tasks.value : [];
  const draggedTask = allTasks.find((item) => item.id === draggedTaskId.value);
  if (!draggedTask || draggedTask.listId !== activeListId.value) {
    return;
  }
  dropIndicatorIndex.value = (listTasks.value ?? []).length;
  dragOverTaskId.value = null;
};

watch(showEditDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingEdit.value = null;
  }
});

watch(showDuplicateDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingDuplicate.value = null;
  }
});

watch(activeListId, () => {
  dropIndicatorIndex.value = -1;
  dragOverTaskId.value = null;
  draggedTaskId.value = null;
});

watch(listTasks, () => {
  const length = listTasks.value?.length ?? 0;
  if (dropIndicatorIndex.value > length) {
    dropIndicatorIndex.value = -1;
  }
});

onMounted(() => {
  window.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleDocumentClick);
});
</script>

<template>
  <section class="task-panel">
    <header class="task-panel__header">
      <h2>{{ activeList?.name ?? 'List' }}</h2>
      <div class="task-panel__header-actions">
        <span class="task-panel__count">
          {{ sortedListTasks.length }} active
        </span>
        <div v-if="activeList" class="task-panel__menu" @keydown.esc.stop="closeListMenu">
          <button
            ref="listMenuButton"
            type="button"
            class="task-panel__menu-trigger"
            aria-haspopup="true"
            :aria-expanded="listMenuOpen"
            aria-label="List options"
            @click.stop="toggleListMenu"
          >
            <IconGlyph name="more-vertical" size="18" aria-hidden="true" />
          </button>
          <transition name="task-menu">
            <ul
              v-if="listMenuOpen"
              ref="listMenuPanel"
              class="task-panel__menu-list"
              role="menu"
              @click.stop
            >
              <li role="none">
                <button
                  type="button"
                  class="task-panel__menu-item"
                  role="menuitem"
                  @click="handleRenameList"
                >
                  Rename list
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  class="task-panel__menu-item"
                  role="menuitem"
                  @click="handleOpenSettings"
                >
                  Settings
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  class="task-panel__menu-item task-panel__menu-item--danger"
                  role="menuitem"
                  :disabled="activeList.id === 'default'"
                  @click="requestDeleteList"
                >
                  Delete list
                </button>
              </li>
            </ul>
          </transition>
        </div>
      </div>
    </header>
    <p v-if="!activeList" class="task-panel__empty">
      This list was not found.
      <button type="button" class="task-panel__empty-button" @click="navigateToDefaultList">
        Go to another list
      </button>
    </p>
    <template v-else>
      <p v-if="sortedListTasks.length === 0" class="task-panel__empty">
        No tasks in this list yet.
      </p>
      <template v-else>
        <div class="task-panel__sort-controls">
          <label for="sort-by" class="task-panel__sort-label">Sort By:</label>
          <select 
            id="sort-by"
            v-model="sortMode"
            class="task-panel__sort-select"
          >
            <option value="user">User</option>
            <option value="due-date">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        <ul
          class="task-panel__list"
          @dragover.prevent="handleListDragOver($event)"
          @drop.prevent="handleDropAtListEnd"
        >
          <template v-for="(task, index) in sortedListTasks" :key="task.id">
            <li
              v-if="dropIndicatorIndex === index"
              class="task-panel__drop-indicator"
            />
            <li
              class="task-panel__item"
              :class="{
                'task-panel__item--drag-over': dragOverTaskId === task.id,
                'task-panel__item--dragging': draggedTaskId === task.id,
              }"
              :draggable="!task.completed"
              @dragstart="handleDragStart(task)"
              @dragend="handleDragEnd"
              @dragenter.prevent="handleDragEnter(task)"
              @dragover.prevent
              @dragleave="handleDragLeave(task)"
              @drop.prevent.stop="handleDrop(task)"
            >
              <Task
                :task="task"
                :list-name="resolveListName(task)"
                @toggle="handleToggle"
                @remove="requestDelete"
              @edit="startEdit"
              @duplicate="handleDuplicate"
              @move-to-today="handleMoveToToday"
              @move-to-tomorrow="handleMoveToTomorrow"
              @toggle-subtask="handleToggleSubtask"
            />
            </li>
          </template>
          <li
            v-if="dropIndicatorIndex === sortedListTasks.length"
            class="task-panel__drop-indicator task-panel__drop-indicator--end"
          />
        </ul>
      </template>
    </template>
  </section>
  <ConfirmDialog
    v-model:open="showDeleteDialog"
    title="Delete task?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="taskPendingDelete?.title || ''"
    @confirm="confirmDelete"
    @cancel="closeDialog"
  />
  <ConfirmDialog
    v-model:open="showDeleteListDialog"
    title="Delete list?"
    confirm-label="Delete"
    cancel-label="Cancel"
    :item-label="activeList?.name || ''"
    message="Deleting a list moves all of its tasks back into My Tasks."
    @confirm="confirmDeleteList"
    @cancel="closeDeleteListDialog"
  />
  <AddEditTaskModal
    v-model:visible="showEditDialog"
    mode="edit"
    :task="taskPendingEdit"
    :lists="lists"
    @save="handleEditSave"
    @cancel="closeEdit"
  />
  <AddEditTaskModal
    v-model:visible="showDuplicateDialog"
    mode="duplicate"
    :task="taskPendingDuplicate"
    :lists="lists"
    @submit="handleDuplicateSubmit"
    @cancel="closeDuplicate"
  />
  <ListSettingsModal
    v-model:visible="showListSettingsDialog"
    :list="activeList"
    @save="handleSaveListSettings"
    @cancel="closeListSettings"
  />
  <RenameListModal
    v-model:visible="showRenameListModal"
    :current-name="activeList?.name ?? ''"
    @submit="handleRenameListSubmit"
  />
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.task-panel {
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  padding: 1.25rem;
  background: rgba(23, 23, 24, 0.6);
  box-shadow: 0 18px 32px -28px rgba(0, 0, 0, 0.85);
  display: grid;
  gap: 1rem;

  @media (max-width: 640px) {
    padding: 1rem;
  }
}

.task-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.task-panel__header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.task-panel__menu {
  position: relative;
}

.task-panel__menu-trigger {
  border: 1px solid theme.$color-border-input;
  background: rgba(255, 255, 255, 0.04);
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  font-size: 1rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  padding: 0;

  &:hover {
    color: theme.$color-text-heading;
    border-color: theme.$color-accent;
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.task-menu-enter-active,
.task-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.task-menu-enter-from,
.task-menu-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

.task-panel__menu-list {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 9rem;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  background: #1c1c1d;
  border: 1px solid theme.$color-border-strong;
  border-radius: 0.65rem;
  box-shadow: 0 16px 32px -24px rgba(0, 0, 0, 0.75);
  display: grid;
  gap: 0.25rem;
  z-index: 5;
}

.task-panel__menu-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: theme.$color-text-heading;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  font-family: inherit;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--danger {
    color: theme.$color-accent;

    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.16);
    }
  }
}

.task-panel__count {
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.task-panel__empty {
  margin: 0;
  padding: 1.5rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 1rem;
  color: theme.$color-text-muted;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 0.75rem;
}

.task-panel__empty-button {
  justify-self: center;
  border: 1px solid theme.$color-border-input;
  background: rgba(255, 255, 255, 0.04);
  color: #e5e5e5;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.16);
    border-color: theme.$color-accent;
    color: #ffffff;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }
}

.task-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.task-panel__item {
  list-style: none;
}

.task-panel__item--drag-over {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.task-panel__item--dragging {
  opacity: 0.6;
}

.task-panel__drop-indicator {
  height: 0;
  border-top: 2px dashed theme.$color-accent;
  margin: 0.25rem 0;
}

.task-panel__drop-indicator--end {
  margin-bottom: 0;
}

.task-panel__sort-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.task-panel__sort-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.task-panel__sort-select {
  border: 1px solid theme.$color-border-input;
  background: rgba(255, 255, 255, 0.04);
  color: theme.$color-text-heading;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: theme.$color-border-strong;
  }

  &:focus-visible {
    outline: 2px solid theme.$color-accent;
    outline-offset: 2px;
  }

  option {
    background: #1c1c1d;
    color: #e5e5e5;
  }
}
</style>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import TaskEditorDialog from '../components/TaskEditorDialog.vue';
import { useTaskStore } from '../stores/useTaskStore';

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
  moveTaskToToday,
  moveTaskToTomorrow,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);
const draggedTaskId = ref(null);
const dragOverTaskId = ref(null);
const dropIndicatorIndex = ref(-1);

const activeListId = computed(() => {
  const id = route.params.id;
  return typeof id === 'string' ? id : null;
});

const activeList = computed(() => {
  if (!activeListId.value) {
    return null;
  }
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  return availableLists.find((list) => list.id === activeListId.value) ?? null;
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

const navigateToDefaultList = () => {
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  if (availableLists.length === 0) {
    router.push('/today');
    return;
  }
  router.push(`/lists/${availableLists[0].id}`);
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
  const duplicated = duplicateTask(task.id);
  if (duplicated) {
    startEdit(duplicated);
  }
};

const handleMoveToToday = (task) => {
  moveTaskToToday(task.id);
};

const handleMoveToTomorrow = (task) => {
  moveTaskToTomorrow(task.id);
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
</script>

<template>
  <section class="task-panel">
    <header class="task-panel__header">
      <h2>{{ activeList?.name ?? 'List' }}</h2>
      <span class="task-panel__count">
        {{ listTasks.length }} active
      </span>
    </header>
    <p v-if="!activeList" class="task-panel__empty">
      This list was not found.
      <button type="button" class="task-panel__empty-button" @click="navigateToDefaultList">
        Go to another list
      </button>
    </p>
    <template v-else>
      <p v-if="listTasks.length === 0" class="task-panel__empty">
        No tasks in this list yet.
      </p>
      <ul
        v-else
        class="task-panel__list"
        @dragover.prevent="handleListDragOver($event)"
        @drop.prevent="handleDropAtListEnd"
      >
        <template v-for="(task, index) in listTasks" :key="task.id">
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
              @toggle="handleToggle"
              @remove="requestDelete"
              @edit="startEdit"
              @duplicate="handleDuplicate"
              @move-to-today="handleMoveToToday"
              @move-to-tomorrow="handleMoveToTomorrow"
            />
          </li>
        </template>
        <li
          v-if="dropIndicatorIndex === listTasks.length"
          class="task-panel__drop-indicator task-panel__drop-indicator--end"
        />
      </ul>
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
  <TaskEditorDialog
    v-model:open="showEditDialog"
    :task="taskPendingEdit"
    @save="handleEditSave"
    @cancel="closeEdit"
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
</style>

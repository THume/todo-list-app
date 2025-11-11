<script setup>
import { computed, ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import TaskEditorDialog from '../components/TaskEditorDialog.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasks,
  tasksOverdue,
  tasksDueToday,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  moveTaskToToday,
  moveTaskToTomorrow,
  lists,
} = useTaskStore();

const showDeleteDialog = ref(false);
const taskPendingDelete = ref(null);
const showEditDialog = ref(false);
const taskPendingEdit = ref(null);
const draggedTaskId = ref(null);
const dragOverTaskId = ref(null);
const dropIndicatorIndex = ref(-1);
const overdueCount = computed(() =>
  Array.isArray(tasksOverdue.value) ? tasksOverdue.value.length : 0
);
const hasOverdueTasks = computed(() => overdueCount.value > 0);

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
    return listNameById.value.default ?? 'My Tasks';
  }
  const listId = typeof task.listId === 'string' ? task.listId : '';
  const fallback = listNameById.value.default ?? 'My Tasks';
  if (listId && listNameById.value[listId]) {
    return listNameById.value[listId];
  }
  return fallback;
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
  draggedTaskId.value = task.id;
};

const handleDragEnd = () => {
  draggedTaskId.value = null;
  dragOverTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDragEnter = (task) => {
  if (!draggedTaskId.value || draggedTaskId.value === task.id) {
    return;
  }
  const allTasks = tasks.value ?? [];
  const todayList = tasksDueToday.value ?? [];
  const sourceIndexAll = allTasks.findIndex((item) => item.id === draggedTaskId.value);
  const targetIndexAll = allTasks.findIndex((item) => item.id === task.id);

  if (sourceIndexAll < 0 || targetIndexAll < 0) {
    dropIndicatorIndex.value = -1;
    return;
  }

  const targetIndexToday = todayList.findIndex((item) => item.id === task.id);
  const sourceIndexToday = todayList.findIndex((item) => item.id === draggedTaskId.value);

  let indicatorIndex = targetIndexToday >= 0 ? targetIndexToday : 0;

  if (sourceIndexAll < targetIndexAll) {
    indicatorIndex = targetIndexToday >= 0 ? targetIndexToday + 1 : todayList.length;
  } else if (sourceIndexToday >= 0 && targetIndexToday >= 0) {
    indicatorIndex = targetIndexToday;
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
  if (!draggedTaskId.value || draggedTaskId.value === task.id) {
    dragOverTaskId.value = null;
    dropIndicatorIndex.value = -1;
    return;
  }

  const allTasks = tasks.value ?? [];
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
  draggedTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleDropAtListEnd = () => {
  if (!draggedTaskId.value) {
    return;
  }

  reorderTask({
    id: draggedTaskId.value,
    beforeId: null,
  });

  dragOverTaskId.value = null;
  draggedTaskId.value = null;
  dropIndicatorIndex.value = -1;
};

const handleListDragOver = (event) => {
  if (!draggedTaskId.value) {
    return;
  }
  if (event?.target !== event?.currentTarget) {
    return;
  }
  dropIndicatorIndex.value = (tasksDueToday.value ?? []).length;
  dragOverTaskId.value = null;
};

watch(showEditDialog, (isOpen) => {
  if (!isOpen) {
    taskPendingEdit.value = null;
  }
});
</script>

<template>
  <section v-if="hasOverdueTasks" class="task-panel task-panel--overdue" aria-live="polite">
    <header class="task-panel__header">
      <div>
        <h2>Overdue</h2>
        <p class="task-panel__note">
          Tasks that slipped past their due time stay here until you reschedule or complete them.
        </p>
      </div>
      <span class="task-panel__count">{{ overdueCount }} overdue</span>
    </header>
    <ul class="task-panel__list">
      <li
        v-for="task in tasksOverdue"
        :key="task.id"
        class="task-panel__item task-panel__item--overdue"
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
        />
      </li>
    </ul>
  </section>
  <section class="task-panel" aria-live="polite">
    <header class="task-panel__header">
      <div>
        <h2>Today</h2>
        <p class="task-panel__note">This list covers everything due before midnight.</p>
      </div>
      <span class="task-panel__count">{{ tasksDueToday.length }} due</span>
    </header>
    <p v-if="tasksDueToday.length === 0" class="task-panel__empty">
      No tasks are due today.
    </p>
    <ul
      v-else
      class="task-panel__list"
      @dragover.prevent="handleListDragOver($event)"
      @drop.prevent="handleDropAtListEnd"
    >
      <template v-for="(task, index) in tasksDueToday" :key="task.id">
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
          />
        </li>
      </template>
      <li
        v-if="dropIndicatorIndex === tasksDueToday.length"
        class="task-panel__drop-indicator task-panel__drop-indicator--end"
      />
    </ul>
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
  box-shadow: 0 18px 28px -26px rgba(0, 0, 0, 0.85);
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

.task-panel__note {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  color: theme.$color-text-muted;
}

.task-panel__empty {
  margin: 0;
  padding: 1.5rem;
  border: 2px dashed theme.$color-border-input;
  border-radius: 1rem;
  color: theme.$color-text-muted;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
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

.task-panel--overdue {
  border-color: rgba(239, 68, 68, 0.65);
  background: rgba(239, 68, 68, 0.08);
}

.task-panel__item--overdue {
  border-radius: 1rem;
  background: rgba(239, 68, 68, 0.04);
  padding: 0.35rem;
}
</style>

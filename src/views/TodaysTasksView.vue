<script setup>
import { computed, ref, watch } from 'vue';
import Task from '../components/Task.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import AddEditTaskModal from '../components/AddEditTaskModal.vue';
import { useTaskStore } from '../stores/useTaskStore';

const {
  tasks,
  tasksDueToday,
  tasksDueTodayPastDue,
  tasksDueTodayUpcoming,
  toggleTaskCompletion,
  removeTask,
  updateTask,
  reorderTask,
  duplicateTask,
  addTask,
  toggleSubtaskCompletion,
  moveTaskToToday,
  moveTaskToTomorrow,
  lists,
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
const todayTasksLength = computed(() =>
  Array.isArray(tasksDueToday.value) ? tasksDueToday.value.length : 0
);
const dueCount = computed(() =>
  Array.isArray(tasksDueTodayPastDue.value) ? tasksDueTodayPastDue.value.length : 0
);
const upcomingCount = computed(() =>
  Array.isArray(tasksDueTodayUpcoming.value) ? tasksDueTodayUpcoming.value.length : 0
);
const hasDueTasks = computed(() => dueCount.value > 0);
const todayIndexById = computed(() => {
  const map = {};
  const todayList = Array.isArray(tasksDueToday.value) ? tasksDueToday.value : [];
  todayList.forEach((task, index) => {
    if (task?.id !== undefined && task?.id !== null) {
      map[task.id] = index;
    }
  });
  return map;
});
const getTodayIndex = (task) => {
  if (!task || task.id === undefined || task.id === null) {
    return -1;
  }
  return todayIndexById.value[task.id] ?? -1;
};
const shouldShowDropIndicator = (task) => dropIndicatorIndex.value === getTodayIndex(task);

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
  dropIndicatorIndex.value = todayTasksLength.value;
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
</script>

<template>
  <section v-if="hasDueTasks" class="task-panel task-panel--due" aria-live="polite">
    <header class="task-panel__header">
      <div>
        <h2>Due</h2>
        <p class="task-panel__note">
          These tasks were scheduled for earlier today. Complete or reschedule them to clear this list.
        </p>
      </div>
      <span class="task-panel__count">{{ dueCount }} due</span>
    </header>
    <ul class="task-panel__list">
      <template v-for="task in tasksDueTodayPastDue" :key="task.id">
        <li
          v-if="shouldShowDropIndicator(task)"
          class="task-panel__drop-indicator"
        />
        <li
          class="task-panel__item task-panel__item--due"
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
    </ul>
  </section>
  <section class="task-panel" aria-live="polite">
    <header class="task-panel__header">
      <div>
        <h2>Today</h2>
        <p class="task-panel__note">
          Everything scheduled for today before midnight. Due tasks are listed above.
        </p>
      </div>
      <span class="task-panel__count">{{ todayTasksLength }} today</span>
    </header>
    <p v-if="todayTasksLength === 0" class="task-panel__empty">
      No tasks are due today.
    </p>
    <p v-else-if="upcomingCount === 0" class="task-panel__empty">
      Nothing scheduled for the rest of today.
    </p>
    <ul
      v-else
      class="task-panel__list"
      @dragover.prevent="handleListDragOver($event)"
      @drop.prevent="handleDropAtListEnd"
    >
      <template v-for="task in tasksDueTodayUpcoming" :key="task.id">
        <li
          v-if="shouldShowDropIndicator(task)"
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
        v-if="dropIndicatorIndex === todayTasksLength"
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

.task-panel + .task-panel {
  margin-top: 2rem;
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

.task-panel--due {
  border-color: rgba(239, 68, 68, 0.65);
  background: rgba(239, 68, 68, 0.08);
}

.task-panel__item--due {
  border-radius: 1rem;
  background: rgba(239, 68, 68, 0.04);
  padding: 0.35rem;
}
</style>

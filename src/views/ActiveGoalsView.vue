<script setup>
import { ref } from 'vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import GoalCard from '../components/GoalCard.vue';
import GoalOutcomeModal from '../components/GoalOutcomeModal.vue';
import AddEditGoalModal from '../components/AddEditGoalModal.vue';
import { useGoalStore } from '../stores/useGoalStore';

const {
  activeGoals,
  updateGoal,
  deleteGoal,
  changeGoalProgress,
  resolveGoal,
} = useGoalStore();

const showEditModal = ref(false);
const goalPendingEdit = ref(null);

const showDeleteDialog = ref(false);
const goalPendingDelete = ref(null);

const showResolveModal = ref(false);
const goalPendingResolve = ref(null);
const resolveOutcome = ref('succeeded');

const openEditModal = (goal) => {
  goalPendingEdit.value = goal;
  showEditModal.value = true;
};

const requestDeleteGoal = (goal) => {
  goalPendingDelete.value = goal;
  showDeleteDialog.value = true;
};

const handleDeleteGoal = () => {
  if (!goalPendingDelete.value?.id) {
    showDeleteDialog.value = false;
    goalPendingDelete.value = null;
    return;
  }
  deleteGoal(goalPendingDelete.value.id);
  showDeleteDialog.value = false;
  goalPendingDelete.value = null;
};

const handleResolveRequest = ({ goal, outcome }) => {
  goalPendingResolve.value = goal;
  resolveOutcome.value = outcome;
  showResolveModal.value = true;
};

const handleResolveConfirm = ({ outcome, notes, actualCount }) => {
  if (!goalPendingResolve.value?.id) {
    showResolveModal.value = false;
    return;
  }

  resolveGoal(goalPendingResolve.value.id, outcome, {
    notes,
    actualCount,
  });

  showResolveModal.value = false;
  goalPendingResolve.value = null;
};

const handleSaveGoal = (payload) => {
  updateGoal(payload);
  showEditModal.value = false;
  goalPendingEdit.value = null;
};

const incrementGoal = (goal) => {
  changeGoalProgress(goal.id, 1);
};

const decrementGoal = (goal) => {
  changeGoalProgress(goal.id, -1);
};
</script>

<template>
  <section class="goals-page">
    <header class="goals-page__header">
      <div>
        <h1 class="goals-page__title">Active Goals</h1>
        <p class="goals-page__subtitle">
          Manage active goals and resolve them as succeeded or failed.
        </p>
      </div>
    </header>

    <section class="goals-content">
      <p v-if="activeGoals.length === 0" class="goals-content__empty">
        No active goals yet.
      </p>
      <GoalCard
        v-for="goal in activeGoals"
        :key="goal.id"
        :goal="goal"
        @edit="openEditModal"
        @delete="requestDeleteGoal"
        @increment="incrementGoal"
        @decrement="decrementGoal"
        @resolve="handleResolveRequest"
      />
    </section>

    <AddEditGoalModal
      v-model:visible="showEditModal"
      mode="edit"
      :goal="goalPendingEdit"
      @save="handleSaveGoal"
    />

    <ConfirmDialog
      v-model:open="showDeleteDialog"
      title="Delete goal?"
      confirm-label="Delete"
      cancel-label="Cancel"
      :item-label="goalPendingDelete?.title || ''"
      message="Deleting this goal removes it from active goals but keeps historical outcomes."
      @confirm="handleDeleteGoal"
      @cancel="showDeleteDialog = false"
    />

    <GoalOutcomeModal
      v-model:visible="showResolveModal"
      :goal="goalPendingResolve"
      :outcome="resolveOutcome"
      @confirm="handleResolveConfirm"
      @cancel="showResolveModal = false"
    />
  </section>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.goals-page {
  color: theme.$color-text-primary;
  background: theme.$color-main-background;
  padding: 2rem 2.25rem 3rem;
  display: grid;
  gap: 1.5rem;
}

.goals-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.goals-page__title {
  margin: 0;
  font-size: 1.9rem;
}

.goals-page__subtitle {
  margin: 0.5rem 0 0;
  color: theme.$color-text-muted;
}

.goals-content {
  display: grid;
  gap: 0.9rem;
}

.goals-content__empty {
  margin: 0;
  color: theme.$color-text-muted;
  border: 1px dashed theme.$color-border-muted;
  border-radius: 0.75rem;
  padding: 1rem;
}
</style>

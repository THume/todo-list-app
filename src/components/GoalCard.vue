<script setup>
import { computed } from 'vue';

const props = defineProps({
  goal: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['edit', 'delete', 'increment', 'decrement', 'resolve']);

const isCountGoal = computed(() => props.goal.trackingType === 'count');
const progressLabel = computed(() => {
  if (!isCountGoal.value) {
    return 'Binary goal';
  }
  const current = props.goal.currentCount ?? 0;
  const target = props.goal.targetCount ?? 0;
  return `${current} / ${target}`;
});

const statusClass = computed(() => {
  if (props.goal.status === 'succeeded') {
    return 'goal-card__status goal-card__status--succeeded';
  }
  if (props.goal.status === 'failed') {
    return 'goal-card__status goal-card__status--failed';
  }
  return 'goal-card__status goal-card__status--active';
});
</script>

<template>
  <article class="goal-card">
    <header class="goal-card__header">
      <div>
        <h3 class="goal-card__title">{{ goal.title }}</h3>
        <p v-if="goal.description" class="goal-card__description">{{ goal.description }}</p>
      </div>
      <span :class="statusClass">{{ goal.status }}</span>
    </header>

    <dl class="goal-card__meta">
      <div class="goal-card__meta-row">
        <dt>Tracking</dt>
        <dd>{{ goal.trackingType === 'count' ? 'Count' : 'Binary' }}</dd>
      </div>
      <div class="goal-card__meta-row">
        <dt>Period</dt>
        <dd>{{ goal.period || 'none' }}</dd>
      </div>
      <div class="goal-card__meta-row">
        <dt>Target date</dt>
        <dd>{{ goal.targetDate || 'None' }}</dd>
      </div>
      <div class="goal-card__meta-row">
        <dt>Progress</dt>
        <dd>{{ progressLabel }}</dd>
      </div>
    </dl>

    <div v-if="goal.status === 'active'" class="goal-card__actions">
      <button type="button" class="goal-card__button" @click="emit('edit', goal)">Edit</button>
      <button
        v-if="isCountGoal"
        type="button"
        class="goal-card__button"
        @click="emit('decrement', goal)"
      >
        -1
      </button>
      <button
        v-if="isCountGoal"
        type="button"
        class="goal-card__button"
        @click="emit('increment', goal)"
      >
        +1
      </button>
      <button type="button" class="goal-card__button goal-card__button--success" @click="emit('resolve', { goal, outcome: 'succeeded' })">
        Succeeded
      </button>
      <button type="button" class="goal-card__button goal-card__button--danger" @click="emit('resolve', { goal, outcome: 'failed' })">
        Failed
      </button>
      <button type="button" class="goal-card__button" @click="emit('delete', goal)">Delete</button>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.goal-card {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.02);
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
}

.goal-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.goal-card__title {
  margin: 0;
  color: theme.$color-text-primary;
  font-size: 1.05rem;
}

.goal-card__description {
  margin: 0.35rem 0 0;
  color: theme.$color-text-muted;
  font-size: 0.9rem;
}

.goal-card__status {
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.goal-card__status--active {
  background: theme.$color-accent-soft;
  color: theme.$color-accent-hover;
}

.goal-card__status--succeeded {
  background: theme.$color-success-soft;
  color: theme.$color-success-bright;
}

.goal-card__status--failed {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.goal-card__meta {
  margin: 0;
  display: grid;
  gap: 0.45rem;
}

.goal-card__meta-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: theme.$color-text-muted;
  font-size: 0.9rem;
}

.goal-card__meta-row dt,
.goal-card__meta-row dd {
  margin: 0;
}

.goal-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.goal-card__button {
  border: 1px solid theme.$color-border-muted;
  background: transparent;
  color: theme.$color-text-primary;
  border-radius: 0.65rem;
  padding: 0.45rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: theme.$color-accent;
    background: theme.$color-accent-soft;
  }
}

.goal-card__button--success {
  border-color: theme.$color-success-border;

  &:hover {
    border-color: theme.$color-success-bright;
    background: theme.$color-success-soft;
  }
}

.goal-card__button--danger {
  border-color: theme.$color-accent-soft-border;

  &:hover {
    border-color: theme.$color-accent-hover;
    background: theme.$color-accent-soft;
  }
}
</style>

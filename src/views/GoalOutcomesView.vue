<script setup>
import { computed, ref } from 'vue';
import { useGoalStore } from '../stores/useGoalStore';

const {
  goalOutcomes,
} = useGoalStore();

const outcomeFilter = ref('all');

const filteredOutcomes = computed(() => {
  if (outcomeFilter.value === 'all') {
    return goalOutcomes.value;
  }
  return goalOutcomes.value.filter((entry) => entry.outcome === outcomeFilter.value);
});

const formatResolvedAt = (value) => {
  const date = new Date(value ?? '');
  if (Number.isNaN(date.valueOf())) {
    return 'Unknown date';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
</script>

<template>
  <section class="goals-page">
    <header class="goals-page__header">
      <div>
        <h1 class="goals-page__title">Success/Failure</h1>
        <p class="goals-page__subtitle">
          Review resolved outcomes across all goals.
        </p>
      </div>
    </header>

    <section class="goals-content">
      <div class="goals-content__toolbar">
        <label class="goals-content__filter">
          <span>Filter outcomes</span>
          <select v-model="outcomeFilter">
            <option value="all">All</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>

      <p v-if="filteredOutcomes.length === 0" class="goals-content__empty">
        No outcomes to review yet.
      </p>

      <article
        v-for="entry in filteredOutcomes"
        :key="entry.id"
        class="goal-outcome-entry"
      >
        <header class="goal-outcome-entry__header">
          <h3>{{ entry.title }}</h3>
          <span
            class="goal-outcome-entry__badge"
            :class="entry.outcome === 'succeeded' ? 'goal-outcome-entry__badge--success' : 'goal-outcome-entry__badge--failed'"
          >
            {{ entry.outcome }}
          </span>
        </header>
        <p class="goal-outcome-entry__meta">
          Resolved {{ formatResolvedAt(entry.resolvedAt) }}
        </p>
        <p v-if="entry.trackingType === 'count'" class="goal-outcome-entry__meta">
          Count: {{ entry.actualCount ?? 0 }} / {{ entry.targetCount ?? 0 }}
        </p>
        <p v-if="entry.notes" class="goal-outcome-entry__notes">{{ entry.notes }}</p>
      </article>
    </section>
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

.goals-content__toolbar {
  display: flex;
  justify-content: flex-end;
}

.goals-content__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: theme.$color-text-muted;
  font-size: 0.86rem;
}

.goals-content__filter select {
  padding: 0.45rem 0.65rem;

  @include theme.modal-form-input;
}

.goals-content__empty {
  margin: 0;
  color: theme.$color-text-muted;
  border: 1px dashed theme.$color-border-muted;
  border-radius: 0.75rem;
  padding: 1rem;
}

.goal-outcome-entry {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.8rem;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.02);
}

.goal-outcome-entry__header {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.goal-outcome-entry__header h3 {
  margin: 0;
  font-size: 1rem;
}

.goal-outcome-entry__badge {
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.goal-outcome-entry__badge--success {
  background: theme.$color-success-soft;
  color: theme.$color-success-bright;
}

.goal-outcome-entry__badge--failed {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.goal-outcome-entry__meta,
.goal-outcome-entry__notes {
  margin: 0.45rem 0 0;
  color: theme.$color-text-muted;
}
</style>

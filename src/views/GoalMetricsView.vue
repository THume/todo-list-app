<script setup>
import { computed } from 'vue';
import { useGoalStore } from '../stores/useGoalStore';

const {
  activeGoals,
  goalsDueSoon,
  succeededOutcomesCount,
  failedOutcomesCount,
  totalResolvedCount,
  overallSuccessRate,
} = useGoalStore();

const successRateLabel = computed(() => {
  if (overallSuccessRate.value === null) {
    return 'No resolved goals yet';
  }
  return `${Math.round(overallSuccessRate.value * 100)}%`;
});
</script>

<template>
  <section class="goals-page">
    <header class="goals-page__header">
      <div>
        <h1 class="goals-page__title">Metrics</h1>
        <p class="goals-page__subtitle">
          Track goal performance over time.
        </p>
      </div>
    </header>

    <section class="goals-metrics" aria-label="Goal success metrics">
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Success Rate</p>
        <p class="goals-metrics__value">{{ successRateLabel }}</p>
      </article>
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Succeeded</p>
        <p class="goals-metrics__value">{{ succeededOutcomesCount }}</p>
      </article>
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Failed</p>
        <p class="goals-metrics__value">{{ failedOutcomesCount }}</p>
      </article>
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Active</p>
        <p class="goals-metrics__value">{{ activeGoals.length }}</p>
      </article>
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Due Soon</p>
        <p class="goals-metrics__value">{{ goalsDueSoon.length }}</p>
      </article>
      <article class="goals-metrics__card">
        <p class="goals-metrics__label">Resolved</p>
        <p class="goals-metrics__value">{{ totalResolvedCount }}</p>
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

.goals-metrics {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.goals-metrics__card {
  border: 1px solid theme.$color-border-input;
  border-radius: 0.75rem;
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.02);
}

.goals-metrics__label {
  margin: 0;
  color: theme.$color-text-muted;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.goals-metrics__value {
  margin: 0.45rem 0 0;
  font-size: 1.4rem;
  font-weight: 700;
}
</style>

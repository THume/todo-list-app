<script setup>
import IconGlyph from './IconGlyph.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  snapshots: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  restoringId: {
    type: [String, Number],
    default: null,
  },
});

const emit = defineEmits(['close', 'restore']);

const backupDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatBackupTimestamp = (snapshot) => {
  const createdAt = snapshot?.createdAt;
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.valueOf())) {
      return backupDateFormatter.format(parsed);
    }
  }
  return snapshot?.id ?? 'Unknown backup';
};

const closeModal = () => {
  emit('close');
};

const restoreSnapshot = (snapshotId) => {
  emit('restore', snapshotId);
};
</script>

<template>
  <div v-if="visible" class="backup-modal" role="presentation">
    <div class="backup-modal__backdrop" @click="closeModal"></div>
    <div
      class="backup-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
      @click.stop
    >
      <header class="backup-modal__header">
        <div>
          <p class="backup-modal__eyebrow">Settings</p>
          <h2 id="backup-modal-title" class="backup-modal__title">Restore backup</h2>
        </div>
        <button
          type="button"
          class="backup-modal__close"
          aria-label="Close restore backup modal"
          @click="closeModal"
        >
          <IconGlyph name="close" size="18" aria-hidden="true" />
        </button>
      </header>
      <p class="backup-modal__hint">
        Choose a snapshot to restore. This replaces tasks, lists, and completed history.
      </p>
      <div class="backup-modal__body">
        <p v-if="loading" class="backup-modal__status">Loading backups...</p>
        <p v-else-if="error" class="backup-modal__status backup-modal__status--error">
          {{ error }}
        </p>
        <p v-else-if="snapshots.length === 0" class="backup-modal__status">
          No backups found yet.
        </p>
        <div v-else class="backup-modal__list">
          <div v-for="snapshot in snapshots" :key="snapshot.id" class="backup-modal__item">
            <div class="backup-modal__item-meta">
              <p class="backup-modal__item-title">{{ formatBackupTimestamp(snapshot) }}</p>
              <p class="backup-modal__item-counts">
                Tasks: {{ snapshot.counts?.tasks ?? 0 }} · Lists: {{ snapshot.counts?.lists ?? 0 }}
                · Completed: {{ snapshot.counts?.completed ?? 0 }}
              </p>
            </div>
            <button
              type="button"
              class="backup-modal__restore"
              :disabled="restoringId !== null"
              @click="restoreSnapshot(snapshot.id)"
            >
              {{ restoringId === snapshot.id ? 'Restoring...' : 'Restore' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.backup-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 20;
}

.backup-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.7);
  backdrop-filter: blur(4px);
}

.backup-modal__panel {
  position: relative;
  width: min(560px, 92vw);
  background: rgba(20, 22, 25, 0.98);
  border: 1px solid theme.$color-border-strong;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 30px 60px -35px rgba(0, 0, 0, 0.9);
  display: grid;
  gap: 1rem;
}

.backup-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.backup-modal__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: theme.$color-text-muted;
}

.backup-modal__title {
  margin: 0.25rem 0 0;
  font-size: 1.35rem;
  color: theme.$color-text-heading;
}

.backup-modal__close {
  border: 1px solid theme.$color-border-muted;
  background: transparent;
  color: theme.$color-text-muted;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.backup-modal__close:hover {
  border-color: theme.$color-accent;
  color: theme.$color-text-heading;
  background: rgba(255, 255, 255, 0.06);
}

.backup-modal__close:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.backup-modal__hint {
  margin: 0;
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.backup-modal__body {
  display: grid;
  gap: 0.75rem;
}

.backup-modal__status {
  margin: 0;
  color: theme.$color-text-muted;
  font-size: 0.95rem;
}

.backup-modal__status--error {
  color: #fca5a5;
}

.backup-modal__list {
  display: grid;
  gap: 0.75rem;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.backup-modal__item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border: 1px solid theme.$color-border-muted;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.02);
}

.backup-modal__item-meta {
  display: grid;
  gap: 0.2rem;
}

.backup-modal__item-title {
  margin: 0;
  font-weight: 600;
  color: theme.$color-text-heading;
}

.backup-modal__item-counts {
  margin: 0;
  font-size: 0.85rem;
  color: theme.$color-text-muted;
}

.backup-modal__restore {
  border: none;
  border-radius: 0.65rem;
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.9);
  color: #1b1b1d;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.backup-modal__restore:hover:enabled {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -18px rgba(239, 68, 68, 0.9);
}

.backup-modal__restore:disabled {
  cursor: wait;
  opacity: 0.7;
}
</style>

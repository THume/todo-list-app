<script setup>
import ModalBase from './ModalBase.vue';
import IconGlyph from './IconGlyph.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  showSummaries: {
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
  <ModalBase
    :open="visible"
    title="Restore backup"
    eyebrow="Settings"
    size="large"
    @update:open="$emit('close')"
    @close="closeModal"
  >
    <template #default>
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
                <template v-if="showSummaries">
                  · Summaries: {{ snapshot.counts?.summaries ?? 0 }}
                </template>
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
    </template>
  </ModalBase>
</template>

<style scoped lang="scss">
@use '../styles/theme' as theme;

.backup-modal {
  &__hint {
    margin: 0;
    color: theme.$color-text-muted;
    font-size: 0.95rem;
  }

  &__body {
    display: grid;
    gap: 0.75rem;
  }

  &__status {
    margin: 0;
    color: theme.$color-text-muted;
    font-size: 0.95rem;

    &--error {
      color: #fca5a5;
    }
  }

  &__list {
    display: grid;
    gap: 0.75rem;
    max-height: 50vh;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  &__item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.85rem 1rem;
    border: 1px solid theme.$color-border-muted;
    border-radius: 0.85rem;
    background: rgba(255, 255, 255, 0.02);
  }

  &__item-meta {
    display: grid;
    gap: 0.2rem;
  }

  &__item-title {
    margin: 0;
    font-weight: 600;
    color: theme.$color-text-heading;
  }

  &__item-counts {
    margin: 0;
    font-size: 0.85rem;
    color: theme.$color-text-muted;
  }

  &__restore {
    @include theme.modal-action-button;
    padding: 0.5rem 1rem;
    border-radius: 0.65rem;

    &:hover:enabled {
      box-shadow: 0 12px 24px -18px rgba(239, 68, 68, 0.9);
    }

    &:disabled {
      cursor: wait;
      opacity: 0.7;
    }
  }
}
</style>

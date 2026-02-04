<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTaskStore } from '../stores/useTaskStore';
import {
  listBackupSnapshots,
  restoreBackupSnapshot,
  exportDataBundle,
  importDataBundle,
  getStorageSettings,
  updateStorageSettings,
} from '../services/jsonStorage';
import BackupRestoreModal from '../components/BackupRestoreModal.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';

const router = useRouter();
const { lastSavedAt, storageStatus, refreshFromStorage } = useTaskStore();

const STANDUP_SETTING_STORAGE_KEY = 'todo-list.standup-enabled';
const FONT_SIZE_SETTING_STORAGE_KEY = 'todo-list.font-size';
const FORCE_STORAGE_FAILURE_KEY = 'todo-list.force-storage-failure';

const isStandupEnabled = ref(true);
const fontSizeSetting = ref('large');
const showStorageFailureToggle = import.meta.env.DEV;
const forceStorageFailure = ref(false);
const duplicateDirectory = ref('');
const duplicateDirectoryDraft = ref('');
const duplicateDirectoryStatus = ref('');
const duplicateDirectoryStatusIsError = ref(false);
const duplicateDirectorySaving = ref(false);
const showBackupModal = ref(false);
const backupSnapshots = ref([]);
const backupLoading = ref(false);
const backupError = ref('');
const backupRestoringId = ref(null);
const lastBackupAt = ref(null);
const exportError = ref('');
const importError = ref('');
const importFileRef = ref(null);
const pendingImportBundle = ref(null);
const importSummary = ref('');
const showImportConfirm = ref(false);

const lastSavedLabel = computed(() => {
  if (!lastSavedAt.value) {
    return 'Not saved yet';
  }
  const parsed = new Date(lastSavedAt.value);
  if (Number.isNaN(parsed.valueOf())) {
    return 'Not saved yet';
  }
  return `Saved ${parsed.toLocaleString()}`;
});

const lastBackupLabel = computed(() => {
  if (!lastBackupAt.value) {
    return 'Last backup: Not available';
  }
  const parsed = new Date(lastBackupAt.value);
  if (Number.isNaN(parsed.valueOf())) {
    return 'Last backup: Not available';
  }
  return `Last backup: ${parsed.toLocaleString()}`;
});

const applyFontSizeSetting = (value) => {
  const root = document.documentElement;
  if (!root) {
    return;
  }
  root.style.fontSize = value === 'small' ? '80%' : '100%';
};

// Initialize settings from localStorage
const storedStandupSetting = window.localStorage.getItem(STANDUP_SETTING_STORAGE_KEY);
if (storedStandupSetting === 'false') {
  isStandupEnabled.value = false;
} else if (storedStandupSetting === 'true') {
  isStandupEnabled.value = true;
}

const storedFontSize = window.localStorage.getItem(FONT_SIZE_SETTING_STORAGE_KEY);
if (storedFontSize === 'small' || storedFontSize === 'large') {
  fontSizeSetting.value = storedFontSize;
}

const storedForceFailure = window.localStorage.getItem(FORCE_STORAGE_FAILURE_KEY);
if (storedForceFailure === 'true') {
  forceStorageFailure.value = true;
}

watch(
  isStandupEnabled,
  (enabled) => {
    window.localStorage.setItem(STANDUP_SETTING_STORAGE_KEY, String(enabled));
  },
  { immediate: true }
);

watch(
  [isStandupEnabled, () => router.currentRoute.value.path],
  ([enabled, currentPath]) => {
    if (!enabled && typeof currentPath === 'string' && currentPath.startsWith('/standup')) {
      router.replace('/today');
    }
  },
  { immediate: true }
);

watch(
  fontSizeSetting,
  (value) => {
    window.localStorage.setItem(FONT_SIZE_SETTING_STORAGE_KEY, value);
    applyFontSizeSetting(value);
  },
  { immediate: true }
);

watch(forceStorageFailure, (value) => {
  if (!showStorageFailureToggle) {
    return;
  }
  window.localStorage.setItem(FORCE_STORAGE_FAILURE_KEY, value ? 'true' : 'false');
});

const loadBackupSnapshots = async () => {
  backupLoading.value = true;
  backupError.value = '';
  const result = await listBackupSnapshots();
  if (result.ok) {
    backupSnapshots.value = Array.isArray(result.snapshots) ? result.snapshots : [];
    lastBackupAt.value = backupSnapshots.value[0]?.createdAt ?? null;
  } else {
    backupError.value = 'Unable to load backups.';
    backupSnapshots.value = [];
    lastBackupAt.value = null;
  }
  backupLoading.value = false;
};

const openBackupModal = () => {
  showBackupModal.value = true;
  loadBackupSnapshots();
};

const closeBackupModal = () => {
  showBackupModal.value = false;
  backupError.value = '';
  backupRestoringId.value = null;
};

const handleRestoreBackup = async (snapshotId) => {
  if (!snapshotId) {
    return;
  }
  backupRestoringId.value = snapshotId;
  backupError.value = '';
  const result = await restoreBackupSnapshot(snapshotId);
  if (!result.ok) {
    backupError.value = 'Backup restore failed.';
    backupRestoringId.value = null;
    return;
  }
  await refreshFromStorage();
  backupRestoringId.value = null;
  closeBackupModal();
};

const buildExportFileName = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `todo-backup-${timestamp}.json`;
};

const handleExportData = async () => {
  exportError.value = '';
  const result = await exportDataBundle();
  if (!result.ok) {
    exportError.value = 'Export failed.';
    return;
  }

  const blob = new Blob([JSON.stringify(result.data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildExportFileName();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const openImportPicker = () => {
  importError.value = '';
  pendingImportBundle.value = null;
  importSummary.value = '';
  if (importFileRef.value) {
    importFileRef.value.value = '';
    importFileRef.value.click();
  }
};

const buildImportSummary = (bundle) => {
  const tasksCount = Array.isArray(bundle?.tasks) ? bundle.tasks.length : 0;
  const listsCount = Array.isArray(bundle?.lists) ? bundle.lists.length : 0;
  const completedCount = Array.isArray(bundle?.completed) ? bundle.completed.length : 0;
  return `Tasks: ${tasksCount}, Lists: ${listsCount}, Completed: ${completedCount}.`;
};

const handleImportFileChange = (event) => {
  const file = event.target?.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = String(reader.result ?? '').trim();
      const parsed = raw.length > 0 ? JSON.parse(raw) : null;
      if (
        !parsed
        || !Array.isArray(parsed.tasks)
        || !Array.isArray(parsed.lists)
        || !Array.isArray(parsed.completed)
      ) {
        importError.value = 'Invalid backup file.';
        return;
      }
      pendingImportBundle.value = parsed;
      importSummary.value = buildImportSummary(parsed);
      showImportConfirm.value = true;
    } catch (error) {
      importError.value = 'Invalid JSON file.';
    }
  };
  reader.onerror = () => {
    importError.value = 'Unable to read file.';
  };
  reader.readAsText(file);
};

const applyDuplicateDirectory = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  duplicateDirectory.value = normalized;
  duplicateDirectoryDraft.value = normalized;
};

const loadStorageSettings = async () => {
  duplicateDirectoryStatus.value = '';
  duplicateDirectoryStatusIsError.value = false;
  const result = await getStorageSettings();
  if (result.ok) {
    const value =
      typeof result.settings?.duplicateDirectory === 'string'
        ? result.settings.duplicateDirectory
        : '';
    applyDuplicateDirectory(value);
  } else {
    duplicateDirectoryStatus.value = 'Unable to load duplicate directory.';
    duplicateDirectoryStatusIsError.value = true;
  }
};

const handleDuplicateDirectorySave = async () => {
  if (duplicateDirectorySaving.value) {
    return;
  }
  duplicateDirectorySaving.value = true;
  duplicateDirectoryStatus.value = '';
  duplicateDirectoryStatusIsError.value = false;
  const nextValue =
    typeof duplicateDirectoryDraft.value === 'string' ? duplicateDirectoryDraft.value.trim() : '';
  const result = await updateStorageSettings({ duplicateDirectory: nextValue });
  if (result.ok) {
    const value =
      typeof result.settings?.duplicateDirectory === 'string'
        ? result.settings.duplicateDirectory
        : '';
    applyDuplicateDirectory(value);
    duplicateDirectoryStatus.value = value
      ? 'Duplicate directory saved.'
      : 'Duplicate directory cleared.';
  } else {
    duplicateDirectoryStatus.value =
      result.error?.message ?? 'Unable to save duplicate directory.';
    duplicateDirectoryStatusIsError.value = true;
  }
  duplicateDirectorySaving.value = false;
};

const handleDuplicateDirectoryClear = async () => {
  duplicateDirectoryDraft.value = '';
  await handleDuplicateDirectorySave();
};

const handleConfirmImport = async () => {
  if (!pendingImportBundle.value) {
    showImportConfirm.value = false;
    return;
  }
  importError.value = '';
  const result = await importDataBundle(pendingImportBundle.value);
  if (!result.ok) {
    importError.value = 'Import failed.';
    pendingImportBundle.value = null;
    importSummary.value = '';
    return;
  }
  showImportConfirm.value = false;
  pendingImportBundle.value = null;
  importSummary.value = '';
  await refreshFromStorage();
  loadBackupSnapshots();
};

const handleCancelImport = () => {
  showImportConfirm.value = false;
  pendingImportBundle.value = null;
  importSummary.value = '';
};

const handleBackupKeydown = (event) => {
  if (event.key === 'Escape') {
    closeBackupModal();
  }
};

watch(showBackupModal, (open) => {
  if (open) {
    document.addEventListener('keydown', handleBackupKeydown);
  } else {
    document.removeEventListener('keydown', handleBackupKeydown);
  }
});

onMounted(() => {
  loadBackupSnapshots();
  loadStorageSettings();
});
</script>

<template>
  <div class="settings-page">
    <h1 class="settings-page__title">Settings</h1>

    <section class="settings-page__section">
      <h2 class="settings-page__section-title">Appearance</h2>
      <label class="settings-page__option">
        <div class="settings-page__option-text">
          <span class="settings-page__option-title">Standup page</span>
          <span class="settings-page__option-hint">
            {{ isStandupEnabled ? 'Enabled' : 'Hidden' }}
          </span>
        </div>
        <input
          v-model="isStandupEnabled"
          type="checkbox"
          class="settings-page__toggle-input"
          aria-label="Toggle Standup page visibility"
        />
        <span class="settings-page__toggle" aria-hidden="true"></span>
      </label>

      <div class="settings-page__field">
        <p class="settings-page__field-title">Font size</p>
        <div class="settings-page__radio-group" role="group" aria-label="Font size">
          <label class="settings-page__radio">
            <input
              v-model="fontSizeSetting"
              type="radio"
              class="settings-page__radio-input"
              value="large"
              aria-label="Use large font size"
            />
            <span class="settings-page__radio-label">
              <span class="settings-page__radio-title">Large</span>
            </span>
          </label>
          <label class="settings-page__radio">
            <input
              v-model="fontSizeSetting"
              type="radio"
              class="settings-page__radio-input"
              value="small"
              aria-label="Use small font size"
            />
            <span class="settings-page__radio-label">
              <span class="settings-page__radio-title">Small</span>
            </span>
          </label>
        </div>
      </div>
    </section>

    <section class="settings-page__section">
      <h2 class="settings-page__section-title">Data</h2>
      <button type="button" class="settings-page__action" @click="handleExportData">
        Export data
      </button>
      <button type="button" class="settings-page__action" @click="openImportPicker">
        Import data
      </button>
      <button type="button" class="settings-page__action" @click="openBackupModal">
        Restore backup
      </button>

      <div class="settings-page__field">
        <label class="settings-page__field-label" for="duplicate-directory-input">
          Directory to store duplicate of data
        </label>
        <p class="settings-page__field-hint">
          Optional path for a mirrored copy of the data folder.
        </p>
        <input
          id="duplicate-directory-input"
          v-model="duplicateDirectoryDraft"
          type="text"
          class="settings-page__input"
          placeholder="C:\\Users\\you\\OneDrive\\TodoBackups"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="settings-page__field-actions">
          <button
            type="button"
            class="settings-page__action settings-page__action--inline"
            :disabled="duplicateDirectorySaving"
            @click="handleDuplicateDirectorySave"
          >
            {{ duplicateDirectorySaving ? 'Saving...' : 'Save directory' }}
          </button>
          <button
            type="button"
            class="settings-page__action settings-page__action--inline"
            :disabled="duplicateDirectorySaving"
            @click="handleDuplicateDirectoryClear"
          >
            Clear
          </button>
        </div>
        <p
          class="settings-page__status"
          :class="{ 'settings-page__status--error': duplicateDirectoryStatusIsError }"
        >
          {{
            duplicateDirectoryStatus ||
              (duplicateDirectory ? 'Duplicate directory is active.' : 'No duplicate directory set.')
          }}
        </p>
      </div>

      <p v-if="exportError" class="settings-page__status settings-page__status--error">
        {{ exportError }}
      </p>
      <p v-if="importError" class="settings-page__status settings-page__status--error">
        {{ importError }}
      </p>
      <p
        class="settings-page__status"
        :class="{ 'settings-page__status--error': !storageStatus.ok }"
      >
        {{ storageStatus.ok ? lastSavedLabel : storageStatus.message }}
      </p>
      <p class="settings-page__status">
        {{ lastBackupLabel }}
      </p>
      <label
        v-if="showStorageFailureToggle"
        class="settings-page__option settings-page__option--inline"
      >
        <div class="settings-page__option-text">
          <span class="settings-page__option-title">Force storage error</span>
          <span class="settings-page__option-hint">Dev only</span>
        </div>
        <input
          v-model="forceStorageFailure"
          type="checkbox"
          class="settings-page__toggle-input"
          aria-label="Force storage failure"
        />
        <span class="settings-page__toggle" aria-hidden="true"></span>
      </label>
    </section>

    <input
      ref="importFileRef"
      type="file"
      accept="application/json"
      class="sr-only"
      aria-hidden="true"
      @change="handleImportFileChange"
    />

    <BackupRestoreModal
      v-model:visible="showBackupModal"
      :snapshots="backupSnapshots"
      :loading="backupLoading"
      :error="backupError"
      :restoring-id="backupRestoringId"
      @restore="handleRestoreBackup"
      @close="closeBackupModal"
    />

    <ConfirmDialog
      v-model:open="showImportConfirm"
      title="Import data?"
      confirm-label="Import"
      cancel-label="Cancel"
      :message="`This will replace all current data. ${importSummary}`"
      @confirm="handleConfirmImport"
      @cancel="handleCancelImport"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../styles/theme';

.settings-page {
  max-width: 42rem;
  margin: 0 auto;
}

.settings-page__title {
  margin: 0 0 2rem 0;
  font-size: 2.25rem;
  font-weight: 800;
  color: theme.$color-text-heading;
}

.settings-page__section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid theme.$color-border-muted;
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: grid;
  gap: 1rem;
}

.settings-page__section-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme.$color-text-muted;
}

.settings-page__option {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
  font-weight: 600;
  color: theme.$color-text-primary;
  cursor: pointer;
  padding: 0.5rem 0;
}

.settings-page__option--inline {
  margin-top: 0.35rem;
}

.settings-page__option-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.settings-page__option-title {
  font-size: 1rem;
}

.settings-page__option-hint {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme.$color-text-muted;
}

.settings-page__toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.settings-page__toggle {
  width: 2.75rem;
  height: 1.4rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  position: relative;
  transition: background 0.2s ease;
}

.settings-page__toggle::after {
  content: '';
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease, background 0.2s ease;
}

.settings-page__option input:checked + .settings-page__toggle {
  background: rgba(34, 197, 94, 0.4);
}

.settings-page__option input:checked + .settings-page__toggle::after {
  transform: translateX(1.35rem);
  background: #ecfccb;
}

.settings-page__field {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.settings-page__field-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme.$color-text-muted;
}

.settings-page__field-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: theme.$color-text-primary;
}

.settings-page__field-hint {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: theme.$color-text-muted;
}

.settings-page__input {
  width: 100%;
  border: 1px solid theme.$color-border-muted;
  border-radius: 0.6rem;
  padding: 0.5rem 0.7rem;
  background: rgba(255, 255, 255, 0.05);
  color: theme.$color-text-primary;
  font-size: 0.9rem;
}

.settings-page__input:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.settings-page__field-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.settings-page__action {
  border: 1px solid theme.$color-border-muted;
  border-radius: 0.65rem;
  padding: 0.55rem 0.85rem;
  background: rgba(255, 255, 255, 0.04);
  color: theme.$color-text-primary;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.settings-page__action:hover {
  border-color: theme.$color-accent;
  background: rgba(239, 68, 68, 0.18);
  color: theme.$color-text-heading;
}

.settings-page__action:focus-visible {
  outline: 2px solid theme.$color-accent;
  outline-offset: 2px;
}

.settings-page__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-page__action--inline {
  width: auto;
  padding: 0.45rem 0.7rem;
}

.settings-page__status {
  margin: 0;
  font-size: 0.75rem;
  color: theme.$color-text-muted;
}

.settings-page__status--error {
  color: #fca5a5;
}

.settings-page__radio-group {
  display: grid;
  gap: 0.5rem;
}

.settings-page__radio {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.35rem 0.2rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.settings-page__radio:hover {
  background: rgba(255, 255, 255, 0.03);
}

.settings-page__radio-input {
  accent-color: theme.$color-accent;
}

.settings-page__radio-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.settings-page__radio-title {
  font-size: 0.95rem;
  color: theme.$color-text-primary;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

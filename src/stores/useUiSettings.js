import { ref, watch } from 'vue';

const STANDUP_SETTING_STORAGE_KEY = 'todo-list.standup-enabled';
const SUMMARY_SETTING_STORAGE_KEY = 'todo-list.summary-enabled';
const GOALS_SETTING_STORAGE_KEY = 'todo-list.goals-enabled';
const FONT_SIZE_SETTING_STORAGE_KEY = 'todo-list.font-size';
const LONG_TERM_TASKS_SETTING_STORAGE_KEY = 'todo-list.long-term-tasks-enabled';

const readBooleanSetting = (key, defaultValue) => {
  const raw = window.localStorage.getItem(key);
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return defaultValue;
};

const readEnumSetting = (key, values, defaultValue) => {
  const raw = window.localStorage.getItem(key);
  if (values.includes(raw)) {
    return raw;
  }
  return defaultValue;
};

const applyFontSizeSetting = (value) => {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  root.style.fontSize = value === 'small' ? '80%' : '100%';
};

const isStandupEnabled = ref(readBooleanSetting(STANDUP_SETTING_STORAGE_KEY, true));
const isSummaryEnabled = ref(readBooleanSetting(SUMMARY_SETTING_STORAGE_KEY, true));
const isGoalsEnabled = ref(readBooleanSetting(GOALS_SETTING_STORAGE_KEY, true));
const isLongTermTasksEnabled = ref(readBooleanSetting(LONG_TERM_TASKS_SETTING_STORAGE_KEY, false));
const fontSizeSetting = ref(readEnumSetting(FONT_SIZE_SETTING_STORAGE_KEY, ['small', 'large'], 'large'));

watch(
  isStandupEnabled,
  (enabled) => {
    window.localStorage.setItem(STANDUP_SETTING_STORAGE_KEY, String(enabled));
  },
  { immediate: true }
);

watch(
  isSummaryEnabled,
  (enabled) => {
    window.localStorage.setItem(SUMMARY_SETTING_STORAGE_KEY, String(enabled));
  },
  { immediate: true }
);

watch(
  isGoalsEnabled,
  (enabled) => {
    window.localStorage.setItem(GOALS_SETTING_STORAGE_KEY, String(enabled));
  },
  { immediate: true }
);

watch(
  isLongTermTasksEnabled,
  (enabled) => {
    window.localStorage.setItem(LONG_TERM_TASKS_SETTING_STORAGE_KEY, String(enabled));
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

export const useUiSettings = () => {
  return {
    isStandupEnabled,
    isSummaryEnabled,
    isGoalsEnabled,
    isLongTermTasksEnabled,
    fontSizeSetting,
  };
};

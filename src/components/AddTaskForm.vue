<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['submit', 'update:visible'])

const title = ref('')
const description = ref('')
const due = ref('')
const titleField = ref(null)

const canSubmit = computed(() => title.value.trim().length > 0)

const toggleVisibility = () => {
  emit('update:visible', !props.visible)
}

const resetForm = () => {
  title.value = ''
  description.value = ''
  due.value = ''
}

const handleSubmit = () => {
  const trimmedTitle = title.value.trim()

  if (!trimmedTitle) {
    return
  }

  emit('submit', {
    title: trimmedTitle,
    description: description.value.trim(),
    due: due.value || null,
  })

  resetForm()

  nextTick(() => {
    titleField.value?.focus()
  })
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => titleField.value?.focus())
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="add-task">
    <header class="add-task__header">
      <h1 class="add-task__title">Add a Task</h1>
      <button
        type="button"
        class="add-task__toggle"
        :aria-expanded="visible"
        @click="toggleVisibility"
      >
        {{ visible ? 'Hide form' : 'Show form' }}
      </button>
    </header>
    <form
      v-show="visible"
      class="add-task__form"
      @submit.prevent="handleSubmit"
    >
      <div class="add-task__fields">
        <input
          ref="titleField"
          v-model="title"
          type="text"
          class="add-task__input"
          name="title"
          placeholder="Task title"
          aria-label="Task title"
          required
        />
        <textarea
          v-model="description"
          class="add-task__textarea"
          name="description"
          placeholder="Description (optional)"
          aria-label="Task description"
          rows="2"
        />
        <label class="add-task__due-label">
          <span>Due date</span>
          <input
            v-model="due"
            type="date"
            name="due"
            class="add-task__due-input"
            aria-label="Due date"
          />
        </label>
      </div>
      <button
        type="submit"
        class="add-task__submit"
        :disabled="!canSubmit"
      >
        Add Task
      </button>
    </form>
  </section>
</template>

<style scoped lang="scss">
$panel-bg: #111827;
$panel-border: #1f2937;
$input-border: #273449;
$input-bg: #0f172a;
$input-bg-focus: #111c32;
$focus-outline: #22d3ee;
$input-text: #f8fafc;
$muted-text: #94a3b8;
$disabled-bg: #1f2937;
$disabled-text: #64748b;
$button-bg: linear-gradient(135deg, #22d3ee, #0ea5e9);
$button-bg-hover: linear-gradient(135deg, #33e0f8, #22b7f0);

.add-task {
  background: $panel-bg;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -20px rgba(2, 6, 23, 0.55);
  border: 1px solid $panel-border;
  display: grid;
  gap: 1.25rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    @media (max-width: 640px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: $input-text;
  }

  &__form {
    display: grid;
    gap: 1.25rem;
  }

  &__fields {
    display: grid;
    gap: 0.75rem;
  }

  &__input,
  &__textarea,
  &__due-input {
    width: 100%;
    border: 1px solid $input-border;
    border-radius: 0.75rem;
    padding: 0.75rem 0.9rem;
    font-size: 1rem;
    font-family: inherit;
    background: $input-bg;
    color: $input-text;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: #34d399;
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.25);
      background: $input-bg-focus;
    }
  }

  &__textarea {
    resize: vertical;
    min-height: 3.5rem;
  }

  &__due-label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: $muted-text;
  }

  &__toggle {
    border: 1px solid $panel-border;
    background: $input-bg;
    color: $input-text;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 0.55rem 1rem;
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

    &:hover {
      background: $input-bg-focus;
      border-color: $input-border;
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid $focus-outline;
      outline-offset: 2px;
    }
  }

  &__submit {
    align-self: start;
    border: none;
    background: $button-bg;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    box-shadow: 0 12px 20px -12px rgba(14, 165, 233, 0.7);

    &:disabled {
      cursor: not-allowed;
      background: $disabled-bg;
      box-shadow: none;
      color: $disabled-text;
    }

    &:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 16px 30px -18px rgba(34, 211, 238, 0.9);
      background: $button-bg-hover;
    }

    @media (max-width: 640px) {
      width: 100%;
      justify-self: stretch;
      text-align: center;
    }
  }
}
</style>

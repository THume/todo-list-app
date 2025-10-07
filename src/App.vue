<script setup>
import { ref } from 'vue'
import Task from './components/Task.vue'

let initialId = 3

const tasks = ref([
  {
    id: 1,
    title: 'Finish Vue task component',
    description: 'Hook the new Task component into the list.',
    completed: false,
    due: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
  },
  {
    id: 2,
    title: "Plan tomorrow's priorities",
    description: '',
    completed: true,
    due: null,
  },
])

const newTaskTitle = ref('')
const newTaskDescription = ref('')
const newTaskDue = ref('')
const showForm = ref(tasks.value.length === 0)

const addTask = () => {
  const title = newTaskTitle.value.trim()
  if (!title) {
    return
  }

  tasks.value.push({
    id: initialId++,
    title,
    description: newTaskDescription.value.trim(),
    completed: false,
    due: newTaskDue.value || null,
  })

  newTaskTitle.value = ''
  newTaskDescription.value = ''
  newTaskDue.value = ''
}

const toggleTask = (task) => {
  const target = tasks.value.find((item) => item.id === task.id)
  if (target) {
    target.completed = !target.completed
  }
}

const removeTask = (task) => {
  tasks.value = tasks.value.filter((item) => item.id !== task.id)
}
</script>

<template>
  <main class="app">
    <section class="task-list">
      <header class="task-list__header">
        <h2>Tasks</h2>
        <span class="task-list__count">{{ tasks.length }} total</span>
      </header>
      <p v-if="tasks.length === 0" class="task-list__empty">
        No tasks yet - open the form below to add your first task.
      </p>
      <ul v-else class="task-list__items">
        <li v-for="task in tasks" :key="task.id" class="task-list__item">
          <Task
            :task="task"
            @toggle="toggleTask"
            @remove="removeTask"
          />
        </li>
      </ul>
    </section>

    <section class="new-task">
      <header class="new-task__header">
        <h1 class="app__title">Add a Task</h1>
        <button
          type="button"
          class="new-task__toggle"
          :aria-expanded="showForm"
          @click="showForm = !showForm"
        >
          {{ showForm ? 'Hide form' : 'Show form' }}
        </button>
      </header>
      <form
        v-show="showForm"
        class="new-task__form"
        @submit.prevent="addTask"
      >
        <div class="new-task__fields">
          <input
            v-model="newTaskTitle"
            type="text"
            class="new-task__input"
            name="title"
            placeholder="Task title"
            aria-label="Task title"
            required
          />
          <textarea
            v-model="newTaskDescription"
            class="new-task__textarea"
            name="description"
            placeholder="Description (optional)"
            aria-label="Task description"
            rows="2"
          />
          <label class="new-task__due-label">
            <span>Due date</span>
            <input
              v-model="newTaskDue"
              type="date"
              name="due"
              class="new-task__due-input"
              aria-label="Due date"
            />
          </label>
        </div>
        <button
          type="submit"
          class="new-task__submit"
          :disabled="newTaskTitle.trim().length === 0"
        >
          Add Task
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped lang="scss">
$app-bg: linear-gradient(180deg, #0f172a 0%, #020617 60%);
$app-text: #e2e8f0;
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

.app {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3.5rem;
  display: grid;
  gap: 2.5rem;
  color: $app-text;
  background: $app-bg;
  min-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1.5rem 1rem 2.5rem;
    gap: 2rem;
  }
}

.app__title {
  margin: 0 0 1rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: $input-text;
}

.new-task {
  background: $panel-bg;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -20px rgba(2, 6, 23, 0.55);
  border: 1px solid $panel-border;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;

    @media (max-width: 640px) {
      flex-direction: column;
      align-items: flex-start;
    }
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
    color: $app-text;
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
    background: linear-gradient(135deg, #22d3ee, #0ea5e9);
    color: #0f172a;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
    }

    @media (max-width: 640px) {
      width: 100%;
      justify-self: stretch;
      text-align: center;
    }
  }
}

.task-list {
  display: grid;
  gap: 1rem;

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: $input-text;
    }
  }

  &__count {
    color: $muted-text;
    font-size: 0.95rem;
  }

  &__empty {
    margin: 0;
    padding: 1.5rem;
    border: 2px dashed $input-border;
    border-radius: 1rem;
    color: $muted-text;
    text-align: center;
    background: rgba(15, 23, 42, 0.35);
  }

  &__items {
    list-style: none;
    display: grid;
    gap: 1rem;
    padding: 0;
    margin: 0;
  }

  &__item {
    list-style: none;
  }
}
</style>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AddTaskForm from './components/AddTaskForm.vue';
import TaskNotifications from './components/TaskNotifications.vue';
import { useTaskStore } from './stores/useTaskStore';

const {
  notifications,
  dismissNotification,
  teardown,
  tasks,
  addTask,
  tasksDueToday,
  tasksDueTomorrow,
  tasksOverdue,
  activeTasks,
  lists,
  addList,
  activeCountsByList,
} = useTaskStore();

const showForm = ref(false);
const isSidebarCollapsed = ref(false);
let hasInitializedVisibility = false;
const route = useRoute();
const router = useRouter();

const defaultDueDate = computed(() => {
  if (route.path !== '/today') {
    return null;
  }
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const listCounts = computed(() => activeCountsByList.value ?? {});
const activeListId = computed(() => {
  if (typeof route.params?.id !== 'string') {
    return null;
  }
  return route.path.startsWith('/lists/') ? route.params.id : null;
});
const defaultListIdForForm = computed(() => {
  const availableLists = Array.isArray(lists.value) ? lists.value : [];
  if (!availableLists.length) {
    return null;
  }
  const candidate = activeListId.value;
  if (candidate && availableLists.some((list) => list.id === candidate)) {
    return candidate;
  }
  return availableLists[0].id;
});

const todayLinkLabel = computed(() => {
  const count = tasksDueToday.value?.length ?? 0;
  return `Today (${shortDateFormatter.format(new Date())}) (${count})`;
});

const tomorrowLinkLabel = computed(() => {
  const count = tasksDueTomorrow.value?.length ?? 0;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return `Tomorrow (${shortDateFormatter.format(tomorrow)}) (${count})`;
});

const overdueLinkLabel = computed(() => {
  const count = tasksOverdue.value?.length ?? 0;
  return `Overdue (${count})`;
});

const allLinkLabel = computed(() => {
  const count = activeTasks.value?.length ?? 0;
  return `All Tasks (${count})`;
});

const handleCreateList = () => {
  if (typeof window === 'undefined') {
    return;
  }
  const name = window.prompt('List name');
  if (!name) {
    return;
  }
  const created = addList(name);
  if (created) {
    router.push(`/lists/${created.id}`);
  }
};

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const handleAddTask = (payload) => {
  addTask(payload);
};

watch(
  tasks,
  (value) => {
    if (!hasInitializedVisibility) {
      hasInitializedVisibility = true;
      return;
    }
    if (Array.isArray(value) && value.length === 0) {
      showForm.value = true;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  teardown();
});
</script>

<template>
  <TaskNotifications :notifications="notifications" @dismiss="dismissNotification" />
  <div class="layout" :class="{ 'layout--collapsed': isSidebarCollapsed }">
    <aside
      :class="['layout__sidebar', { 'layout__sidebar--collapsed': isSidebarCollapsed }]"
      :aria-expanded="!isSidebarCollapsed"
    >
      <button
        type="button"
        class="layout__collapse-toggle"
        :aria-expanded="!isSidebarCollapsed"
        @click="toggleSidebar"
      >
        <span v-if="isSidebarCollapsed">Expand</span>
        <span v-else>Collapse</span>
      </button>
      <div v-show="!isSidebarCollapsed" class="layout__sidebar-content">
        <div class="layout__sidebar-top">
          <h1 class="layout__title">Todo List</h1>
          <nav class="layout__nav">
            <RouterLink to="/today" class="layout__link" active-class="layout__link--active">
              {{ todayLinkLabel }}
            </RouterLink>
            <RouterLink to="/tomorrow" class="layout__link" active-class="layout__link--active">
              {{ tomorrowLinkLabel }}
            </RouterLink>
            <RouterLink to="/overdue" class="layout__link" active-class="layout__link--active">
              {{ overdueLinkLabel }}
            </RouterLink>
            <RouterLink to="/all" class="layout__link" active-class="layout__link--active">
              {{ allLinkLabel }}
            </RouterLink>
            <RouterLink to="/completed" class="layout__link" active-class="layout__link--active">
              Completed
            </RouterLink>
          </nav>
          <section class="layout__lists">
            <header class="layout__lists-header">
              <span class="layout__lists-title">Lists</span>
              <button type="button" class="layout__add-list" @click="handleCreateList">
                New List
              </button>
            </header>
            <nav class="layout__list-nav">
              <RouterLink
                v-for="list in lists"
                :key="list.id"
                :to="`/lists/${list.id}`"
                class="layout__link layout__link--list"
                active-class="layout__link--active"
              >
                {{ list.name }} ({{ listCounts[list.id] ?? 0 }})
              </RouterLink>
            </nav>
          </section>
        </div>
        <AddTaskForm
          v-model:visible="showForm"
          class="layout__sidebar-form"
          :default-due-date="defaultDueDate"
          :lists="lists"
          :default-list-id="defaultListIdForForm"
          @submit="handleAddTask"
        />
      </div>
    </aside>
    <main class="layout__content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
$app-bg: #0f0f10;
$app-sidebar-bg: #161616;
$app-main-bg: #111112;
$app-border: #272727;
$app-text: #f4f4f5;
$app-muted: #a1a1aa;
$app-accent: #ef4444;

.layout {
  display: grid;
  grid-template-columns: minmax(16rem, 20rem) 1fr;
  color: $app-text;
  background: $app-bg;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

.layout--collapsed {
  grid-template-columns: 4.75rem 1fr;
}

.layout__sidebar {
  background: $app-sidebar-bg;
  border-right: 1px solid $app-border;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
}

.layout__sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-height: 0;
  flex: 1 1 auto;
}

.layout__sidebar--collapsed {
  padding: 1.25rem 1rem;
  align-items: center;
  overflow: visible;
}

.layout__sidebar-top {
  display: grid;
  gap: 2rem;
}

.layout__collapse-toggle {
  border: 1px solid $app-border;
  background: rgba(255, 255, 255, 0.06);
  color: $app-text;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  align-self: flex-end;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: $app-accent;
    color: #1b1b1d;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid $app-accent;
    outline-offset: 2px;
  }
}

.layout__sidebar--collapsed .layout__collapse-toggle {
  align-self: center;
}

.layout__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: $app-text;
}

.layout__nav {
  display: grid;
  gap: 0.75rem;
}

.layout__lists {
  display: grid;
  gap: 0.65rem;
  margin-top: 1.5rem;
}

.layout__lists-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.layout__lists-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $app-muted;
}

.layout__add-list {
  border: 1px solid $app-border;
  background: transparent;
  color: $app-muted;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

  &:hover {
    color: $app-text;
    border-color: $app-accent;
    background: rgba(239, 68, 68, 0.12);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid $app-accent;
    outline-offset: 2px;
  }
}

.layout__list-nav {
  display: grid;
  gap: 0.5rem;
}

.layout__link {
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 0.55rem 0.9rem;
  color: $app-muted;
  text-decoration: none;
  font-weight: 600;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.layout__link:hover {
  color: $app-text;
  border-color: $app-border;
  background: rgba(255, 255, 255, 0.04);
  transform: translateX(2px);
}

.layout__link--active {
  border-color: $app-accent;
  background: $app-accent;
  color: #1b1b1d;
  box-shadow: 0 10px 25px -20px rgba(239, 68, 68, 0.9);
}

.layout__link--list {
  font-size: 0.95rem;
}

.layout__content {
  background: $app-main-bg;
  padding: 3rem clamp(1.5rem, 5vw, 3.5rem);
  display: block;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .layout__sidebar {
    position: sticky;
    top: 0;
    z-index: 1;
    border-right: none;
    border-bottom: 1px solid $app-border;
    padding: 1.5rem 1.5rem 1.75rem;
    gap: 1.25rem;
    height: auto;
    min-height: auto;
  }

  .layout__sidebar-content {
    gap: 1.5rem;
  }

  .layout--collapsed {
    grid-template-columns: 1fr;
  }

  .layout__sidebar--collapsed {
    align-items: flex-end;
  }

  .layout__sidebar-top {
    gap: 1.25rem;
  }

  .layout__nav {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .layout__lists {
    margin-top: 1rem;
  }

  .layout__list-nav {
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .layout__link {
    text-align: center;
  }

  .layout__add-list {
    padding: 0.3rem 0.75rem;
  }

  .layout__sidebar-form {
    margin-top: 1rem;
  }

  .layout__content {
    height: auto;
    min-height: 0;
    overflow-y: visible;
  }
}
</style>

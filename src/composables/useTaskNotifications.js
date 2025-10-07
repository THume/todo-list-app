import { ref, watch } from 'vue';

const createNotificationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const maybeShowSystemNotification = (taskTitle) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  const notify = () => {
    try {
      return new Notification('Task due', {
        body: `Task "${taskTitle}" is due now.`,
      });
    } catch (error) {
      console.warn('Unable to display system notification', error);
      return null;
    }
  };

  if (Notification.permission === 'granted') {
    notify();
  } else if (Notification.permission === 'default') {
    Notification.requestPermission()
      .then((permission) => {
        if (permission === 'granted') {
          notify();
        }
      })
      .catch((error) => {
        console.warn('Notification permission request failed', error);
      });
  }
};

export const useTaskNotifications = (tasksRef) => {
  const notifications = ref([]);
  const notifiedTaskIds = new Set();
  let dueCheckTimer = null;

  const dismissNotification = (id) => {
    notifications.value = notifications.value.filter((notification) => notification.id !== id);
  };

  const pushNotification = (message) => {
    const id = createNotificationId();
    const notification = {
      id,
      message,
      createdAt: new Date().toISOString(),
    };

    notifications.value = [...notifications.value, notification];

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        dismissNotification(id);
      }, 8000);
    }

    return id;
  };

  const checkDueTasks = () => {
    const currentTasks = Array.isArray(tasksRef.value) ? tasksRef.value : [];
    const now = Date.now();

    currentTasks.forEach((task) => {
      if (!task || task.completed || !task.due || notifiedTaskIds.has(task.id)) {
        return;
      }

      const dueTime = Date.parse(task.due);

      if (Number.isNaN(dueTime)) {
        return;
      }

      if (dueTime <= now) {
        notifiedTaskIds.add(task.id);
        pushNotification(`Task "${task.title}" is due now.`);
        maybeShowSystemNotification(task.title);
      }
    });
  };

  const synchroniseNotifiedIds = () => {
    const currentTasks = Array.isArray(tasksRef.value) ? tasksRef.value : [];
    const activeIds = new Set(currentTasks.map((task) => task?.id).filter((id) => id !== undefined));

    Array.from(notifiedTaskIds).forEach((id) => {
      if (!activeIds.has(id)) {
        notifiedTaskIds.delete(id);
      }
    });
  };

  const startDueWatcher = () => {
    if (dueCheckTimer !== null || typeof window === 'undefined') {
      checkDueTasks();
      return;
    }

    checkDueTasks();
    dueCheckTimer = window.setInterval(checkDueTasks, 60000);
  };

  const stopDueWatcher = () => {
    if (dueCheckTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(dueCheckTimer);
      dueCheckTimer = null;
    }
  };

  watch(
    tasksRef,
    () => {
      synchroniseNotifiedIds();
      checkDueTasks();
    },
    { deep: true }
  );

  return {
    notifications,
    dismissNotification,
    pushNotification,
    checkDueTasks,
    startDueWatcher,
    stopDueWatcher,
  };
};

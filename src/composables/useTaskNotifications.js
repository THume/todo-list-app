import { ref, watch } from 'vue';

const createNotificationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

let audioContext = null;

const ensureAudioContext = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx) {
    return null;
  }

  if (!audioContext) {
    try {
      audioContext = new AudioCtx();
    } catch (error) {
      console.warn('Unable to create audio context', error);
      return null;
    }
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch((error) => {
      console.warn('Failed to resume audio context', error);
    });
  }

  return audioContext;
};

const playDueTone = () => {
  const ctx = ensureAudioContext();

  if (!ctx) {
    return;
  }

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.warn('Unable to play due tone', error);
  }
};

const maybeShowSystemNotification = ({ title, body, tag } = {}) => {
  if (!('Notification' in window)) {
    return;
  }

  const notify = () => {
    try {
      return new Notification(title ?? 'Task notification', {
        body: body ?? '',
        tag,
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
  const reminderNotifiedKeys = new Set();
  let dueCheckTimer = null;

  const dismissNotification = (id) => {
    notifications.value = notifications.value.filter((notification) => notification.id !== id);
  };

  const pushNotification = (message, options = {}) => {
    const {
      desktop = false,
      desktopTitle,
      desktopBody,
      desktopTag,
      playTone = false,
      action = null,
      duration = 8000,
    } = options;

    const id = createNotificationId();
    const sanitizedAction = action
      ? {
          label:
            typeof action.label === 'string' && action.label.trim().length > 0
              ? action.label.trim()
              : 'Action',
          type: action.type ?? null,
          payload: action.payload ?? null,
        }
      : null;

    const notification = {
      id,
      message,
      createdAt: new Date().toISOString(),
      action: sanitizedAction,
    };

    notifications.value = [...notifications.value, notification];

    if (typeof duration === 'number' && duration > 0) {
      window.setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }

    if (desktop) {
      maybeShowSystemNotification({
        title: desktopTitle ?? 'Task notification',
        body: desktopBody ?? message,
        tag: desktopTag,
      });
    }

    if (playTone) {
      playDueTone();
    }

    return id;
  };

  const checkDueTasks = () => {
    const currentTasks = Array.isArray(tasksRef.value) ? tasksRef.value : [];
    const now = Date.now();
    const newlyDueTasks = [];
    const reminderTasks = [];

    currentTasks.forEach((task) => {
      if (!task || task.completed || !task.due) {
        return;
      }

      const dueTime = Date.parse(task.due);

      if (Number.isNaN(dueTime)) {
        return;
      }

      const reminderOffsetMinutes = Number(task.reminderOffsetMinutes);
      if (
        Number.isFinite(reminderOffsetMinutes)
        && reminderOffsetMinutes > 0
        && dueTime > now
      ) {
        const reminderTimestamp = dueTime - reminderOffsetMinutes * 60000;
        const reminderKey = `${task.id}:${dueTime}:${reminderOffsetMinutes}`;
        if (!reminderNotifiedKeys.has(reminderKey) && reminderTimestamp <= now) {
          reminderNotifiedKeys.add(reminderKey);
          reminderTasks.push(task);
        }
      }

      if (dueTime <= now && !notifiedTaskIds.has(task.id)) {
        notifiedTaskIds.add(task.id);
        newlyDueTasks.push(task);
      }
    });

    if (reminderTasks.length > 0) {
      if (reminderTasks.length === 1) {
        const [task] = reminderTasks;
        const message = `Reminder: "${task.title}" is due soon.`;
        pushNotification(message, {
          desktop: true,
          desktopTitle: 'Task reminder',
          desktopBody: message,
          desktopTag: `task-reminder-${task.id}`,
          playTone: false,
          duration: 8000,
        });
      } else {
        const taskTitles = reminderTasks.map((task) => `"${task.title}"`).slice(0, 3);
        const remainingCount = reminderTasks.length - taskTitles.length;
        let message = `${reminderTasks.length} tasks are due soon: ${taskTitles.join(', ')}`;
        if (remainingCount > 0) {
          message += `, and ${remainingCount} more`;
        }
        pushNotification(message, {
          desktop: true,
          desktopTitle: 'Tasks due soon',
          desktopBody: message,
          desktopTag: `tasks-reminder-${now}`,
          playTone: false,
          duration: 8000,
        });
      }
    }

    if (newlyDueTasks.length === 0) {
      return;
    }

    if (newlyDueTasks.length === 1) {
      const [task] = newlyDueTasks;
      const message = `Task "${task.title}" is due now.`;
      pushNotification(message, {
        desktop: true,
        desktopTitle: 'Task due',
        desktopBody: message,
        desktopTag: `task-due-${task.id}`,
        playTone: true,
      });
      return;
    }

    const taskTitles = newlyDueTasks.map((task) => `"${task.title}"`).slice(0, 3);
    const remainingCount = newlyDueTasks.length - taskTitles.length;
    let message = `${newlyDueTasks.length} tasks are due now: ${taskTitles.join(', ')}`;

    if (remainingCount > 0) {
      message += `, and ${remainingCount} more`;
    }

    message += '.';

    pushNotification(message, {
      desktop: true,
      desktopTitle: 'Tasks due',
      desktopBody: message,
      desktopTag: `tasks-due-${now}`,
      playTone: true,
    });
  };

  const synchroniseNotifiedIds = () => {
    const currentTasks = Array.isArray(tasksRef.value) ? tasksRef.value : [];
    const activeIds = new Set(currentTasks.map((task) => task?.id).filter((id) => id !== undefined));
    const activeReminderKeys = new Set();

    currentTasks.forEach((task) => {
      if (!task || task.completed || !task.due) {
        return;
      }
      const dueTime = Date.parse(task.due);
      const reminderOffsetMinutes = Number(task.reminderOffsetMinutes);
      if (
        Number.isNaN(dueTime)
        || !Number.isFinite(reminderOffsetMinutes)
        || reminderOffsetMinutes <= 0
      ) {
        return;
      }
      activeReminderKeys.add(`${task.id}:${dueTime}:${reminderOffsetMinutes}`);
    });

    Array.from(notifiedTaskIds).forEach((id) => {
      if (!activeIds.has(id)) {
        notifiedTaskIds.delete(id);
      }
    });

    Array.from(reminderNotifiedKeys).forEach((key) => {
      if (!activeReminderKeys.has(key)) {
        reminderNotifiedKeys.delete(key);
      }
    });
  };

  const startDueWatcher = () => {
    if (dueCheckTimer !== null) {
      checkDueTasks();
      return;
    }

    checkDueTasks();
    dueCheckTimer = window.setInterval(checkDueTasks, 60000);
  };

  const stopDueWatcher = () => {
    if (dueCheckTimer !== null) {
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

import { ref, watch } from 'vue';

const createNotificationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

let audioContext = null;

const ensureAudioContext = () => {
  if (typeof window === 'undefined') {
    return null;
  }

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
  if (typeof window === 'undefined' || !('Notification' in window)) {
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
  let dueCheckTimer = null;

  const dismissNotification = (id) => {
    notifications.value = notifications.value.filter((notification) => notification.id !== id);
  };

  const pushNotification = (message, options = {}) => {
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

    if (options.desktop) {
      maybeShowSystemNotification({
        title: options.desktopTitle ?? 'Task notification',
        body: options.desktopBody ?? message,
        tag: options.desktopTag,
      });
    }

    if (options.playTone) {
      playDueTone();
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
        const message = `Task "${task.title}" is due now.`;
        pushNotification(message, {
          desktop: true,
          desktopTitle: 'Task due',
          desktopBody: message,
          desktopTag: `task-due-${task.id}`,
          playTone: true,
        });
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

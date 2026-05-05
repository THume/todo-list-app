export const sortTasksForDisplay = (taskList, mode = 'user') => {
  const tasks = Array.isArray(taskList) ? [...taskList] : [];

  if (mode !== 'due-date') {
    return tasks;
  }

  const longTermTasks = [];
  const tasksWithDue = [];
  const tasksWithoutDue = [];

  tasks.forEach((task, index) => {
    if (!task || typeof task !== 'object') {
      return;
    }

    if (task.isLongTerm) {
      longTermTasks.push({ task, index });
      return;
    }

    const dueValue = typeof task.due === 'string' ? task.due : '';
    const dueTimestamp = Date.parse(dueValue);

    if (Number.isNaN(dueTimestamp)) {
      tasksWithoutDue.push({ task, index });
      return;
    }

    tasksWithDue.push({ task, index, dueTimestamp });
  });

  tasksWithDue.sort((a, b) => {
    if (a.dueTimestamp !== b.dueTimestamp) {
      return a.dueTimestamp - b.dueTimestamp;
    }
    return a.index - b.index;
  });

  return [
    ...longTermTasks.map((entry) => entry.task),
    ...tasksWithDue.map((entry) => entry.task),
    ...tasksWithoutDue.map((entry) => entry.task),
  ];
};

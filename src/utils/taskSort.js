export const sortTasksForDisplay = (taskList, mode = 'user') => {
  const tasks = Array.isArray(taskList) ? [...taskList] : [];

  if (mode === 'priority') {
    // Sort by priority (high > medium > low > none), then by manual order
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, null: 0, undefined: 0 };
    const withIndex = tasks.map((task, index) => ({ task, index }));
    
    withIndex.sort((a, b) => {
      const aPriority = priorityOrder[a.task?.priority] ?? 0;
      const bPriority = priorityOrder[b.task?.priority] ?? 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      return a.index - b.index; // Then by original order
    });
    
    return withIndex.map(entry => entry.task);
  }

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

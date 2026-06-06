const recurrenceOptions = Object.freeze([
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'every2days', label: 'Every 2 days' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Every 3 Months' },
  { value: 'yearly', label: 'Yearly' },
]);

export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeTaskLists = (lists) => (Array.isArray(lists) ? lists : []);

export const resolveListId = (lists, candidate) => {
  const options = normalizeTaskLists(lists);
  if (!options.length) {
    return '';
  }
  if (candidate && options.some((list) => list.id === candidate)) {
    return candidate;
  }
  return options[0].id;
};

export const useRecurrenceOptions = () => recurrenceOptions;

export { recurrenceOptions };

/**
 * Convert a list name to a URL-safe slug (kebab-case)
 * @param {string} name - The list name to convert
 * @returns {string} - The URL-safe slug
 * 
 * Examples:
 * - "Chores" -> "chores"
 * - "Friday Time/Side Work" -> "friday-time-side-work"
 * - "My Tasks" -> "my-tasks"
 */
export function listNameToSlug(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return '';
  }

  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Find a list by its name slug
 * @param {Array} lists - Array of list objects
 * @param {string} slug - The slug to search for
 * @returns {Object|null} - The matching list or null if not found
 */
export function findListBySlug(lists, slug) {
  if (!Array.isArray(lists) || typeof slug !== 'string') {
    return null;
  }

  const normalizedSlug = slug.toLowerCase().trim();
  
  return lists.find((list) => {
    if (!list || typeof list.name !== 'string') {
      return false;
    }
    return listNameToSlug(list.name) === normalizedSlug;
  }) ?? null;
}

/**
 * Generate a URL path for a list
 * @param {Object} list - The list object with name property
 * @returns {string} - The URL path for the list
 */
export function getListPath(list) {
  if (!list || typeof list.name !== 'string') {
    return '/today'; // Default fallback
  }
  
  const slug = listNameToSlug(list.name);
  return slug ? `/lists/${slug}` : '/today';
}

# In Progress

- Integration with Google calendar for task reminders

# TODOs
- Add a way to edit date directly from task, instead of edit menu
- Refactor Summary page to list completed tasks by oldest task completed (top) to newest tasks (bottom) by default
- Add ability to edit completion notes from Summary page
- Add Priority setting for tasks to help order tasks in Summary
- Goals/habits - tracks how often completed
- Add Workspaces to create separate collections of tasks/lists
    - Workspace should be the highest level (Example: "Work" or "Home")
    - Lists live under Workspace, Tasks live under Lists
    - Data for workspaces will be stored separately
        - Exporting, importing, restoring backups are all done at the Workspace level
        - Different workspaces have different directories to store duplicate of data
    - The Standup page setting is unique to what Workspace the user is on
        - Create an area on the Settings page for "Workspace Settings"
        - Put Standup setting in this new area
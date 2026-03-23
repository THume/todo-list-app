# TODOs

- When connection is gone periodically check if it has been reestablished
- Goals/habits - tracks how often completed
- Integration with Google calendar for task reminders
- Add Workspaces to create separate collections of tasks/lists
    - Workspace should be the highest level (Example: "Work" or "Home")
    - Lists live under Workspace, Tasks live under Lists
    - Data for workspaces will be stored separately
        - Exporting, importing, restoring backups are all done at the Workspace level
        - Different workspaces have different directories to store duplicate of data
    - The Standup page setting is unique to what Workspace the user is on
        - Create an area on the Settings page for "Workspace Settings"
        - Put Standup setting in this new area
- Refactor how tasks are ordered
    - Long Term tasks at the top
    - Order by due date/time
    - Keep some ability to reorganize
    - Recurring tasks should keep where they are in the order as much as possible
- Add API calls for Read, Write
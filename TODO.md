# In Progress

- Integration with Google calendar for task reminders

# TODOs

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
- For Summary items, make Folder a string so that the value maintains even if Folder is deleted (do the same for Completed tasks?)
- Choose what days of the week to repeat

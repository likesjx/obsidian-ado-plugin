# Obsidian ADO Plugin

This plugin integrates Azure DevOps (ADO) with Obsidian to manage epics and features effectively. 

## Features

- **Manage Epics**: Create, update, and delete epics in Azure DevOps.
- **Manage Features**: Create, update, and delete features associated with epics.
- **User Settings**: Customize plugin settings through a dedicated settings tab.
- **Epic Anchors & Details Popover**:
   - Insert epic anchors (e.g., `<<#12345>>`) into your notes using a command.
   - In Reading and Live Preview modes, these anchors render as clickable buttons.
   - Clicking an epic button fetches its details from Azure DevOps and displays them in a popover.
   - The popover features a tabbed interface:
       - **Description Tab**: Shows the Epic's `System.Description`.
       - **Contacts Tab**: Displays key personnel like Assigned To, Created By, Changed By, and other configurable custom contact roles (e.g., Epic Owner, Solution Architect). User email addresses (unique names) are linked to directly open a chat in Microsoft Teams.
       - **Features Tab**: Lists child Features of the Epic, showing their ID, Title, and State, with direct links to each Feature in ADO.
       - **Readiness Tab**: A configurable tab for displaying readiness information related to the Epic.
   - Includes an "Open in ADO" button to directly navigate to the work item in Azure DevOps.

## Installation

1. Run `npm install` to install dependencies.
2. Build the plugin with:
   ```sh
   npm run build
   ```
   This will bundle your plugin into a single `main.js` file using esbuild and copy it (along with `manifest.json`) to your Obsidian vault's plugins directory.
3. In Obsidian, go to **Settings → Community plugins → Installed plugins** and enable "Obsidian ADO Plugin".

**Note:** You no longer need to manually copy subfolders or multiple files. The build process creates a single bundled `main.js` for you.

## Usage

### Enabling and Configuring the Plugin

1. Open Obsidian and go to **Settings → Community plugins → Installed plugins**.
2. Enable "Obsidian ADO Plugin".
3. A new section called **Obsidian ADO Plugin** will appear in the settings sidebar.
4. Configure the following fields:
   - **ADO Personal Access Token**: Enter your Azure DevOps PAT.
   - **ADO Organization URL**: Enter your Azure DevOps organization URL (e.g., `https://dev.azure.com/yourorganization`).
   - **ADO Project Name**: Enter the name of your Azure DevOps project (this is now required for the "Open in ADO" link in the epic popover).
   - **Refresh Interval**: Set how often (in minutes) the plugin should refresh data from Azure DevOps.
5. Your settings are saved automatically.


### Using the Plugin

- Access plugin features from the command palette (Cmd+P or Ctrl+P) by searching for plugin commands (e.g., "Manage Epics", "Manage Features", "Insert Epic Anchor").
- Use the ribbon icons (dice for epics, star for features) in the left sidebar to trigger plugin actions.
- Return to the settings tab at any time to update your Azure DevOps credentials or preferences.

#### Epic Anchor Command

You can now insert an **Epic Anchor** in your notes:

- Select a number in the editor and run the command **Insert Epic Anchor** (from the command palette). The number will be wrapped as `<<#123>>`.
- If no number is selected, running the command will prompt you to enter an epic number, and it will be inserted at the cursor as `<<#123>>`.

This is useful for quickly referencing Azure DevOps epics in your notes.

### What the Plugin Does

- Lets you manage Azure DevOps epics and features directly from Obsidian.
- Stores your ADO credentials and preferences securely in your vault.
- Provides a command to insert Epic Anchors for easy referencing.
- (If you add more commands or UI, they’ll appear in the command palette or as additional settings.)

If you want to add more features or commands, edit the TypeScript source, run `npm run build`, and reload the plugin in Obsidian.

## Development & Contribution

### Development

- To develop, edit the TypeScript source files in `src/`.
- Use `npm run build` to bundle and deploy to your vault for testing.
- Use `npm run watch` for automatic rebuilds on file changes.

### Contribution

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
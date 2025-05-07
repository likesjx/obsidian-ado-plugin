# Obsidian ADO Plugin

This plugin integrates Azure DevOps (ADO) with Obsidian to manage epics and features effectively. 

## Features

- **Manage Epics**: Create, update, and delete epics in Azure DevOps.
- **Manage Features**: Create, update, and delete features associated with epics.
- **User Settings**: Customize plugin settings through a dedicated settings tab.

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
   - **Refresh Interval**: Set how often (in minutes) the plugin should refresh data from Azure DevOps.
5. Your settings are saved automatically.

### Using the Plugin

- Access plugin features from the command palette (Cmd+P or Ctrl+P) by searching for plugin commands (e.g., "Manage Epics", "Manage Features") if implemented.
- Use the ribbon icons (dice for epics, star for features) in the left sidebar to trigger plugin actions.
- Return to the settings tab at any time to update your Azure DevOps credentials or preferences.

### What the Plugin Does

- Lets you manage Azure DevOps epics and features directly from Obsidian.
- Stores your ADO credentials and preferences securely in your vault.
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
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

- Access the plugin features from the command palette or ribbon icons.
- Use the settings tab to configure your Azure DevOps connection and preferences.

## Development & Contribution

### Development

- To develop, edit the TypeScript source files in `src/`.
- Use `npm run build` to bundle and deploy to your vault for testing.
- Use `npm run watch` for automatic rebuilds on file changes.

### Contribution

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
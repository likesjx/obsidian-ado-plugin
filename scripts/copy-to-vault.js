const fs = require('fs');
const path = require('path');

// CHANGE THIS to your actual vault plugin directory
const VAULT_PLUGIN_DIR = path.resolve(
  process.env.OBSIDIAN_VAULT_PLUGIN_DIR || '/Users/jl4667/Library/CloudStorage/OneDrive-AT&TServices,Inc/Documents/Work Brain/.obsidian/plugins/obsidian-ado-plugin'
);
const DIST_DIR = path.resolve(__dirname, '../dist');

if (!fs.existsSync(VAULT_PLUGIN_DIR)) {
  fs.mkdirSync(VAULT_PLUGIN_DIR, { recursive: true });
}


function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(DIST_DIR)) {
  copyRecursive(DIST_DIR, VAULT_PLUGIN_DIR);
}

['manifest.json', 'styles.css'].forEach(file => {
  const src = path.resolve(__dirname, `../${file}`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(VAULT_PLUGIN_DIR, file));
  }
});

console.log('Plugin files copied to vault.');

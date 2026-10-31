'use strict';

// One-time migration from the app's previous name (Fato AI → OpenFatoAI).
// The user data folder is derived from the app name, so after the rename the
// old folder (~/.config/fato-ia on Linux) would be orphaned. Copy its top-level
// files (database, config, encrypted keys) and the renderer's Local Storage
// (language and theme) into the new folder on first run.
// The old folder is left untouched.

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

const LEGACY_DIR_NAME = 'fato-ia';

function migrateLegacyUserData() {
  try {
    const legacy  = path.join(app.getPath('appData'), LEGACY_DIR_NAME);
    const current = app.getPath('userData');
    if (legacy === current || !fs.existsSync(legacy)) return;

    // Never overwrite data that already exists in the new folder
    const alreadyMigrated = ['config.json', 'fato-ai.db'].some(f => fs.existsSync(path.join(current, f)));
    if (alreadyMigrated) return;

    fs.mkdirSync(current, { recursive: true });
    for (const entry of fs.readdirSync(legacy, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      fs.copyFileSync(path.join(legacy, entry.name), path.join(current, entry.name), fs.constants.COPYFILE_EXCL);
    }
    const localStorageDir = path.join(legacy, 'Local Storage');
    if (fs.existsSync(localStorageDir)) {
      fs.cpSync(localStorageDir, path.join(current, 'Local Storage'), { recursive: true, force: false });
    }
    console.log(`[migrate] copied user data from ${legacy} to ${current}`);
  } catch (err) {
    // Non-fatal: the app starts with a fresh profile
    console.error('[migrate] user data migration failed:', err.message);
  }
}

module.exports = { migrateLegacyUserData };

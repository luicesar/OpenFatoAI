'use strict';

// ── System tray & application menu ──────────────────────────────

const { app, Tray, Menu, nativeImage } = require('electron');
const { createLogger } = require('../services/logger');
const { getWin, setQuitting } = require('./window');

const log = createLogger('main:menu');

/** @type {Tray | null} */
let tray = null;

/**
 * Builds and sets the system tray with a context menu.
 */
function createTray() {
  // 16x16 solid indigo (#4F46E5) PNG — visible system tray icon
  const TRAY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPwd3tKEmIY1TCqYfhqAABe7noQUrS/JQAAAABJRU5ErkJggg==';
  let icon;
  try {
    icon = nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_PNG_B64);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch (_) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip('OpenFatoAI');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          const win = getWin();
          if (win) { win.show(); win.focus(); }
        },
      },
      {
        label: 'Hide',
        click: () => {
          const win = getWin();
          if (win) win.hide();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { setQuitting(true); app.quit(); } },
    ]),
  );
  log.info('System tray created');
}

module.exports = { createTray };

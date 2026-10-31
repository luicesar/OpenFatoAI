'use strict';

const { ipcMain, app } = require('electron');
const { IPC } = require('../../shared/constants');
const { getWin } = require('../window');

function registerWindowHandlers() {
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => {
    getWin()?.minimize();
  });

  ipcMain.handle(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    const win = getWin();
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.handle(IPC.WINDOW_CLOSE, () => {
    getWin()?.hide();
  });

  ipcMain.handle(IPC.WINDOW_QUIT, () => {
    app.quit();
  });
}

module.exports = { registerWindowHandlers };

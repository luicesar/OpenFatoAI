'use strict';

// Preload bridge for the region-selector overlay window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectorAPI', {
  getScreenshot : ()              => ipcRenderer.invoke('get-selector-screenshot'),
  done          : (croppedUrl)    => ipcRenderer.send('region-selected', croppedUrl),
  cancel        : ()              => ipcRenderer.send('region-cancelled'),
});

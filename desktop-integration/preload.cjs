const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whatNowDesktop', {
  captureSources: () => ipcRenderer.invoke('capture-sources'),
});

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whatNowDesktop', {
  captureFrame: sourceId => ipcRenderer.invoke('capture-frame', sourceId),
  onPaused: callback => {
    const listener = (_event, paused) => callback(paused);
    ipcRenderer.on('capture-paused', listener);
    return () => ipcRenderer.removeListener('capture-paused', listener);
  },
  captureSources: () => ipcRenderer.invoke('capture-sources'),
});

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whatNowDesktop', {
  minimize: () => ipcRenderer.invoke('minimize-help'),
  setReady: ready => ipcRenderer.invoke('nudge-ready', ready),
  setBusy: busy => ipcRenderer.invoke('nudge-busy', busy),
  captureNow: () => ipcRenderer.invoke('capture-now'),
  onNudge: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('nudge-capture', listener);
    return () => ipcRenderer.removeListener('nudge-capture', listener);
  },
  onPaused: callback => {
    const listener = (_event, paused) => callback(paused);
    ipcRenderer.on('capture-paused', listener);
    return () => ipcRenderer.removeListener('capture-paused', listener);
  },
});

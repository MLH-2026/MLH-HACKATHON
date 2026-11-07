const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  open: () => ipcRenderer.invoke('open-help'),
  pause: () => ipcRenderer.invoke('pause-capture'),
  quit: () => ipcRenderer.invoke('quit-desktop'),
});
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#open').onclick = () => window.launcher.open();
  document.querySelector('#pause').onclick = async event => {
    const paused = await window.launcher.pause();
    event.target.textContent = paused ? 'Resume capture' : 'Pause capture';
    document.querySelector('#state').textContent = paused ? 'Capture paused' : 'Capture only when you ask';
  };
  document.querySelector('#quit').onclick = () => window.launcher.quit();
});

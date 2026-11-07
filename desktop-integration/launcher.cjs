const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#open').onclick = () => ipcRenderer.invoke('open-help');
  document.querySelector('#edit').onclick = () => ipcRenderer.invoke('edit-context');
  document.querySelector('#pause').onclick = async event => {
    const paused = await ipcRenderer.invoke('pause-capture');
    event.target.textContent = paused ? 'Resume' : 'Pause';
    document.querySelector('#state').textContent = paused ? 'Capture paused' : 'Click to capture & get help';
  };
  document.querySelector('#quit').onclick = () => ipcRenderer.invoke('quit-desktop');
});

const { app, BrowserWindow, desktopCapturer, ipcMain, screen, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

let help, launcher, server, origin;
let paused = false;
const dist = path.resolve(__dirname, '../frontend/dist');

function secureWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/MLH-2026/MLH-HACKATHON') void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
}

function authorize(event, window) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
    throw new Error('Untrusted desktop request.');
  }
}

async function startServer() {
  // Same-origin API proxy keeps keys and backend configuration out of the renderer.
  server = http.createServer(async (req, res) => {
    if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
    if (req.url.startsWith('/api/')) {
      const upstream = http.request({ hostname: '127.0.0.1', port: 8000,
        path: req.url.slice(4), method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:8000', origin: 'http://127.0.0.1:5173' } }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'backend_unavailable', message: 'Start the backend with npm --prefix backend start.' } }));
      });
      req.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
      const content = await fs.readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'none'" });
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
}

let readyToNudge = false;
let nudgeBusy = false;

function showHelp() {
  launcher.hide();
  help.show();
  help.focus();
}

async function nudge() {
  if (!readyToNudge || paused) { showHelp(); return; }
  if (nudgeBusy) return;
  nudgeBusy = true;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  launcher.hide();
  help.hide();
  try {
    await new Promise(resolve => setTimeout(resolve, 250));
    const sources = await desktopCapturer.getSources({
      types: ['screen'], thumbnailSize: { width: 2000, height: 1250 },
    });
    const source = sources.find(item => item.display_id === String(display.id));
    if (!source || source.thumbnail.isEmpty()) throw new Error('Screen capture is unavailable. Enable Electron in macOS Screen Recording settings and reopen WhatNow.');
    if (paused) throw new Error('Capture is paused.');
    showHelp();
    help.webContents.send('nudge-capture', { image: 'data:image/jpeg;base64,' + source.thumbnail.toJPEG(85).toString('base64') });
  } catch (error) {
    nudgeBusy = false;
    showHelp();
    help.webContents.send('nudge-capture', { error: error.message || 'Could not capture this screen.' });
  }
}

app.whenReady().then(async () => {
  await fs.access(path.join(dist, 'index.html'));
  await startServer();
  const area = screen.getPrimaryDisplay().workArea;
  launcher = new BrowserWindow({ width: 210, height: 140, x: area.x + area.width - 230, y: area.y + area.height - 160,
    show: false, frame: false, resizable: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'launcher.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  help = new BrowserWindow({ width: Math.min(820, area.width - 40), height: Math.min(780, area.height - 40),
    minWidth: 420, minHeight: 500, title: 'WhatNow', show: false, backgroundColor: '#0d1014',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  launcher.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  secureWindow(launcher);
  secureWindow(help);
  help.on('close', event => {
    if (!app.isQuitting) { event.preventDefault(); help.hide(); launcher.showInactive(); }
  });
  help.on('minimize', () => { help.hide(); launcher.showInactive(); });
  ipcMain.handle('open-help', event => { authorize(event, launcher); return nudge(); });
  ipcMain.handle('edit-context', event => { authorize(event, launcher); showHelp(); });
  ipcMain.handle('minimize-help', event => { authorize(event, help); help.hide(); launcher.showInactive(); });
  ipcMain.handle('nudge-ready', (event, ready) => { authorize(event, help); readyToNudge = ready === true; });
  ipcMain.handle('nudge-busy', (event, busy) => { authorize(event, help); nudgeBusy = busy === true; });
  ipcMain.handle('capture-now', event => { authorize(event, help); return nudge(); });
  ipcMain.handle('pause-capture', event => {
    authorize(event, launcher); paused = !paused; help.webContents.send('capture-paused', paused); return paused;
  });
  ipcMain.handle('quit-desktop', event => { authorize(event, launcher); app.quit(); });
  await launcher.loadFile(path.join(__dirname, 'launcher.html'));
  await help.loadURL(origin + '/#session');
  showHelp();
}).catch(error => { console.error('Desktop startup failed:', error.message); app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; server?.close(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (help) showHelp(); });

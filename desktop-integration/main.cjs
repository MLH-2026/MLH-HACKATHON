const { app, BrowserWindow, desktopCapturer, ipcMain, screen, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

let help, launcher, server, origin;
let paused = false;
let capturing = false;
const dist = path.resolve(__dirname, '../frontend/dist');

function secureWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'https://github.com/Aly-Baranek/MLH-HACKATHON') void shell.openExternal(url);
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
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-src 'none'" });
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
}

app.whenReady().then(async () => {
  await fs.access(path.join(dist, 'index.html'));
  await startServer();
  const area = screen.getPrimaryDisplay().workArea;
  launcher = new BrowserWindow({ width: 250, height: 205, x: area.x + area.width - 270, y: area.y + 30,
    frame: false, resizable: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'launcher.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  help = new BrowserWindow({ width: 1100, height: 820, show: false, backgroundColor: '#0d1014',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  secureWindow(launcher);
  secureWindow(help);
  help.on('close', event => { if (!app.isQuitting) { event.preventDefault(); help.hide(); } });
  ipcMain.handle('open-help', event => { authorize(event, launcher); help.show(); help.focus(); });
  ipcMain.handle('pause-capture', event => { authorize(event, launcher); paused = !paused; return paused; });
  ipcMain.handle('quit-desktop', event => { authorize(event, launcher); app.quit(); });
  ipcMain.handle('capture-sources', async event => {
    authorize(event, help);
    if (paused) throw new Error('Capture is paused. Resume it from the floating control.');
    if (capturing) throw new Error('A capture is already in progress.');
    capturing = true;
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1600, height: 1000 } });
      if (paused) throw new Error('Capture was paused.');
      return sources.filter(source => !source.thumbnail.isEmpty()).map(source => ({
        id: source.id, name: source.name, image: source.thumbnail.toDataURL(),
      }));
    } catch (error) {
      if (paused) throw error;
      throw new Error('Could not capture. On macOS, enable Screen Recording for Electron in System Settings → Privacy & Security, then restart the desktop app.');
    } finally { capturing = false; }
  });
  await launcher.loadFile(path.join(__dirname, 'launcher.html'));
  await help.loadURL(origin + '/#session');
}).catch(error => { console.error('Desktop startup failed:', error.message); app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; server?.close(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => launcher?.show());

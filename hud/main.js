const { app, BrowserWindow, globalShortcut, screen, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let hudWindow = null;
let tray = null;
let isVisible = false;

// ============ CREATE HUD WINDOW ============
function createHUD() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const hudHeight = 320;

  hudWindow = new BrowserWindow({
    width,
    height: hudHeight,
    x: 0,
    y: -hudHeight - 20,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  hudWindow.loadFile('hud.html');

  // When page is ready, renderer decides stay-open vs auto-hide
  hudWindow.webContents.on('did-finish-load', () => {
    // Ensure window can receive key events (ESC)
    showHUD();
  });
}

// ============ SHOW / HIDE ============
function showHUD() {
  if (!hudWindow) return;
  hudWindow.setPosition(0, 0);
  hudWindow.show();
  hudWindow.focus();
  hudWindow.webContents.send('hud-show');
  isVisible = true;
}

function hideHUD() {
  if (!hudWindow) return;
  hudWindow.webContents.send('hud-hide');

  setTimeout(() => {
    if (!hudWindow) return;
    const { height } = hudWindow.getBounds();
    hudWindow.setPosition(0, -height - 20);
    hudWindow.hide();
    isVisible = false;
  }, 280);
}

function toggleHUD() {
  isVisible ? hideHUD() : showHUD();
}

// ============ TRAY ICON ============
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon = nativeImage.createEmpty();

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'win32') {
      icon = icon.resize({ width: 16, height: 16 });
    }
  }

  tray = new Tray(icon);
  tray.setToolTip('IronNest HUD');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Toggle HUD', click: toggleHUD },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', toggleHUD);
}

// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
  createHUD();
  createTray();

  const registered = globalShortcut.register('F7', () => {
    toggleHUD();
  });

  if (!registered) {
    console.warn('Failed to register global shortcut F7');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // keep running for tray
});

// IPC from renderer
ipcMain.on('toggle-hud', () => toggleHUD());
ipcMain.on('show-hud', () => showHUD());
ipcMain.on('hide-hud', () => hideHUD());

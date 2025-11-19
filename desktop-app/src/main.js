// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ScreenshotCapture = require('./screenshot-capture');
const AuthManager = require('./auth-manager');
const SupabaseClient = require('./supabase-client');

// Initialize electron store for persistent settings
const store = new Store({
  defaults: {
    screenshotInterval: 300, // 5 minutes default
    isTracking: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    atlassianAccessToken: '',
    atlassianRefreshToken: '',
    supabaseJWT: ''
  }
});

let mainWindow = null;
let tray = null;
let screenshotCapture = null;
let authManager = null;
let supabaseClient = null;

// Handle custom protocol for OAuth redirect
const PROTOCOL = 'brd-time-tracker';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  
  // Check if icon exists, if not use a default or skip tray
  try {
    const fs = require('fs');
    if (!fs.existsSync(iconPath)) {
      console.warn('Tray icon not found, creating tray without icon');
      // Create a simple 16x16 transparent icon as fallback
      tray = new Tray(path.join(__dirname, '../assets/icon.png') || app.getAppPath());
    } else {
  tray = new Tray(iconPath);
    }
  } catch (error) {
    console.warn('Could not create tray icon:', error.message);
    // Skip tray creation if icon fails
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Start Tracking',
      id: 'start-tracking',
      click: () => {
        startTracking();
      },
      enabled: !store.get('isTracking')
    },
    {
      label: 'Pause Tracking',
      id: 'pause-tracking',
      click: () => {
        pauseTracking();
      },
      enabled: store.get('isTracking')
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate-to', 'settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('BRD Time Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
  });
}

function updateTrayMenu() {
  const isTracking = store.get('isTracking');
  const contextMenu = tray.getContextMenu();

  contextMenu.items[1].enabled = !isTracking; // Start Tracking
  contextMenu.items[2].enabled = isTracking; // Pause Tracking

  tray.setContextMenu(contextMenu);
}

async function startTracking() {
  try {
    // Initialize Supabase client if not already done
    if (!supabaseClient) {
      const supabaseUrl = store.get('supabaseUrl');
      const supabaseAnonKey = store.get('supabaseAnonKey');

      if (!supabaseUrl || !supabaseAnonKey) {
        mainWindow.webContents.send('error', 'Please configure Supabase settings first');
        return;
      }

      supabaseClient = new SupabaseClient(supabaseUrl, supabaseAnonKey);
      await supabaseClient.setSession(store.get('supabaseJWT'));
    }

    // Initialize screenshot capture
    if (!screenshotCapture) {
      const interval = store.get('screenshotInterval') * 1000; // Convert to milliseconds
      screenshotCapture = new ScreenshotCapture(interval, supabaseClient, store);
    }

    await screenshotCapture.start();
    store.set('isTracking', true);
    updateTrayMenu();
    mainWindow.webContents.send('tracking-status', true);

    tray.setToolTip('BRD Time Tracker - Tracking Active');
  } catch (error) {
    console.error('Error starting tracking:', error);
    mainWindow.webContents.send('error', error.message);
  }
}

function pauseTracking() {
  if (screenshotCapture) {
    screenshotCapture.stop();
  }
  store.set('isTracking', false);
  updateTrayMenu();
  mainWindow.webContents.send('tracking-status', false);

  tray.setToolTip('BRD Time Tracker - Paused');
}

// Register protocol handler BEFORE app is ready (Windows requirement)
// This must be done before requestSingleInstanceLock
if (process.platform === 'win32') {
  // On Windows, we need to register the protocol handler
  // electron-builder will handle this in production builds
  if (process.defaultApp || process.argv[1]) {
    try {
      app.setAsDefaultProtocolClient(PROTOCOL);
      console.log('Protocol handler registered for development:', PROTOCOL);
    } catch (error) {
      console.warn('Could not register protocol handler in development:', error.message);
    }
  }
} else {
  // macOS/Linux
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Ensure single instance (Windows) - MUST be before app.whenReady()
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// Handle protocol URL from command line (Windows - when app is launched via protocol)
console.log('Process argv:', process.argv);
const protocolUrl = process.argv.find(arg => arg && typeof arg === 'string' && arg.startsWith(`${PROTOCOL}://`));
if (protocolUrl) {
  console.log('Protocol URL detected in argv:', protocolUrl.substring(0, 80) + '...');
  // Store URL to process after app is ready
  process.env.PROTOCOL_URL = protocolUrl;
}

// Initialize auth manager early (needed for protocol URL handling)
authManager = new AuthManager(store);

// App lifecycle events
app.whenReady().then(() => {
  // Register custom protocol (additional check)
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    const setAsDefault = app.setAsDefaultProtocolClient(PROTOCOL);
    if (!setAsDefault) {
      console.warn('Could not set as default protocol client. This may affect OAuth redirects.');
    } else {
      console.log('Protocol handler registered:', PROTOCOL);
    }
  } else {
    console.log('Protocol handler already registered:', PROTOCOL);
  }
  
  // Process protocol URL if it was passed via command line
  if (process.env.PROTOCOL_URL && authManager) {
    const url = process.env.PROTOCOL_URL;
    delete process.env.PROTOCOL_URL;
    console.log('Processing OAuth redirect from command line:', url.substring(0, 50) + '...');
    authManager.handleOAuthRedirect(url).catch(error => {
      console.error('OAuth redirect error:', error);
      if (mainWindow) {
        mainWindow.webContents.send('auth-error', error.message);
      }
    });
  }

  // Validate OAuth configuration
  if (!process.env.ATLASSIAN_CLIENT_ID || !process.env.ATLASSIAN_CLIENT_SECRET) {
    console.error('ERROR: Atlassian OAuth credentials not found in environment variables!');
    console.error('Please check your .env file in the desktop-app directory.');
    console.error('Current Client ID:', process.env.ATLASSIAN_CLIENT_ID ? 'SET' : 'NOT SET');
    console.error('Current Client Secret:', process.env.ATLASSIAN_CLIENT_SECRET ? 'SET' : 'NOT SET');
  } else {
    console.log('OAuth credentials loaded successfully');
    console.log('Client ID:', process.env.ATLASSIAN_CLIENT_ID.substring(0, 10) + '...');
  }

  createWindow();
  
  // Create tray with error handling
  try {
  createTray();
  } catch (error) {
    console.warn('Could not create system tray:', error.message);
    // App will still work without tray
  }

  // Auto-start tracking if it was active before
  if (store.get('isTracking')) {
    startTracking();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle custom protocol URLs (OAuth redirect) - macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (authManager) {
    authManager.handleOAuthRedirect(url).catch(error => {
      console.error('OAuth redirect error:', error);
      if (mainWindow) {
        mainWindow.webContents.send('auth-error', error.message);
      }
    });
  }
});

// Handle custom protocol URLs (OAuth redirect) - Windows
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // On Windows, protocol handler opens a new instance
  // We need to handle it in the main instance
  console.log('=== Second instance detected ===');
  console.log('commandLine:', JSON.stringify(commandLine, null, 2));
  console.log('workingDirectory:', workingDirectory);
  
  // Find the protocol URL in command line arguments
  const url = commandLine.find(arg => arg && typeof arg === 'string' && arg.startsWith(`${PROTOCOL}://`));
  
  if (url) {
    console.log('Protocol URL found in second instance:', url.substring(0, 100) + '...');
    if (authManager) {
      console.log('Processing OAuth redirect from second instance...');
      authManager.handleOAuthRedirect(url).catch(error => {
        console.error('OAuth redirect error:', error);
        if (mainWindow) {
          mainWindow.webContents.send('auth-error', error.message);
        }
      });
    } else {
      console.error('AuthManager not initialized yet!');
    }
  } else {
    console.log('No protocol URL found in commandLine');
  }
  
  // Focus the main window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    console.log('Main window not found, creating new window...');
    createWindow();
  }
});

// Single instance lock is now handled above, before app.whenReady()

// IPC event handlers
ipcMain.on('start-tracking', () => {
  startTracking();
});

ipcMain.on('pause-tracking', () => {
  pauseTracking();
});

ipcMain.on('get-settings', (event) => {
  event.reply('settings', {
    screenshotInterval: store.get('screenshotInterval'),
    isTracking: store.get('isTracking'),
    supabaseUrl: store.get('supabaseUrl'),
    hasAuth: !!store.get('supabaseJWT')
  });
});

ipcMain.on('save-settings', (event, settings) => {
  store.set('screenshotInterval', settings.screenshotInterval);
  store.set('supabaseUrl', settings.supabaseUrl);
  store.set('supabaseAnonKey', settings.supabaseAnonKey);

  // Restart tracking if it's active and interval changed
  if (store.get('isTracking') && screenshotCapture) {
    pauseTracking();
    setTimeout(() => startTracking(), 1000);
  }

  event.reply('settings-saved', true);
});

ipcMain.on('start-auth', async (event) => {
  try {
    const authUrl = await authManager.startOAuth();
    shell.openExternal(authUrl);
  } catch (error) {
    event.reply('auth-error', error.message);
  }
});

ipcMain.on('logout', (event) => {
  store.delete('atlassianAccessToken');
  store.delete('atlassianRefreshToken');
  store.delete('supabaseJWT');

  if (screenshotCapture) {
    pauseTracking();
  }

  event.reply('logged-out', true);
});

// Handle app quit
app.on('before-quit', () => {
  if (screenshotCapture) {
    screenshotCapture.stop();
  }
});

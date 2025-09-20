// Jest setup file for macro-keyboard tests

// Mock electron module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name) => {
      switch (name) {
        case 'userData': return '/mock/user/data';
        case 'logs': return '/mock/logs';
        case 'temp': return '/mock/temp';
        default: return '/mock/path';
      }
    }),
    getName: jest.fn(() => 'macro-keyboard'),
    getVersion: jest.fn(() => '1.0.1'),
    on: jest.fn(),
    once: jest.fn(),
    quit: jest.fn(),
    relaunch: jest.fn()
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    },
    on: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false)
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
    removeAllListeners: jest.fn()
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn()
  },
  Tray: jest.fn(() => ({
    setContextMenu: jest.fn(),
    setToolTip: jest.fn(),
    on: jest.fn()
  })),
  shell: {
    openExternal: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
  },
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    on: jest.fn()
  }
}));

global.console = {
  ...console,
  // Suppress console.log during tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
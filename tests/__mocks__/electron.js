// Mock electron module for testing

module.exports = {
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
    relaunch: jest.fn(),
    isReady: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve())
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
      session: {
        clearCache: jest.fn(),
        clearStorageData: jest.fn()
      }
    },
    on: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false),
    setMenu: jest.fn(),
    setIcon: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    removeHandler: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
    removeAllListeners: jest.fn()
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(() => ({
      popup: jest.fn()
    }))
  },
  Tray: jest.fn(() => ({
    setContextMenu: jest.fn(),
    setToolTip: jest.fn(),
    setImage: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn()
  })),
  shell: {
    openExternal: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
    showOpenDialog: jest.fn(() => Promise.resolve({ canceled: false, filePaths: ['/mock/file.txt'] })),
    showSaveDialog: jest.fn(() => Promise.resolve({ canceled: false, filePath: '/mock/saved.txt' }))
  },
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    on: jest.fn(),
    quitAndInstall: jest.fn()
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: jest.fn()
  },
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    })),
    getAllDisplays: jest.fn(() => [])
  }
};
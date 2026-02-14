/**
 * JSDOM Test Environment Setup for UI Components
 * Provides a complete browser-like environment for testing UI components
 */

// Set up TextEncoder/TextDecoder for Node.js environments
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { JSDOM } = require('jsdom');

// Create a comprehensive DOM environment
const createTestDOM = () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Test Environment</title>
      <style>
        .hidden { display: none; }
        .visible { display: block; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; }
        .modal-content { margin: 50px auto; width: 80%; }
        .color-picker { display: inline-block; }
        .button-grid { display: grid; }
        .message { padding: 10px; margin: 5px; }
        .message-error { background-color: #ff0000; }
        .message-success { background-color: #00ff00; }
        .message-info { background-color: #0000ff; }
      </style>
    </head>
    <body>
      <!-- Main container -->
      <div class="container">
        <header>
          <h1>Macro Keyboard Configuration</h1>
          <div class="header-status">
            <div id="connection-status" class="connection-status status-unknown">❓ Unknown</div>
            <div id="validation-status" class="validation-status validation-unknown">⚠️ Validation pending</div>
            <div id="error-status" class="error-status status-ok">✅ No Errors</div>
          </div>
          <div class="header-buttons">
            <button id="validate-config">Validate Config</button>
            <button id="reload-config">Reload Config</button>
            <button id="save-config">Save Config</button>
            <button id="macro-recorder-btn">Macro Recorder</button>
            <button id="context-manager-btn">Context Manager</button>
            <button id="led-manager-btn">LED Manager</button>
            <button id="system-integration-btn">System Integration</button>
            <button id="voice-recognition-btn">Voice Recognition</button>
            <button id="plugin-manager-btn">Plugin Manager</button>
          </div>
        </header>

        <main>
          <div class="section">
            <h2>Device Settings</h2>
            <select id="serial-port">
              <option value="">Select Serial Port</option>
            </select>
            <button id="refresh-ports">🔄</button>
            <button id="test-connection">🔌 Test</button>
          </div>

          <div class="section">
            <h2>Profile Management</h2>
            <select id="profile-select">
              <option value="default">Default</option>
            </select>
          </div>

          <div class="section">
            <h2>Hardware Configuration</h2>
            <div id="hardware-preview"></div>
          </div>

          <div class="section">
            <h2>Button Configuration</h2>
            <div id="button-config" class="config-grid"></div>
          </div>

          <div class="section">
            <h2>Status & Logs</h2>
            <div id="log-output"></div>
          </div>

          <div class="section performance-dashboard">
            <h2>Performance Monitoring</h2>
            <div id="performance-content"></div>
          </div>
        </main>
      </div>

      <!-- Modals -->
      <div id="led-manager-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>LED Management</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="led-controls">
              <div class="brightness-control">
                <label for="led-brightness">Brightness:</label>
                <input type="range" id="led-brightness" min="0" max="255" value="128">
                <span id="brightness-value">128</span>
              </div>
              
              <div class="color-picker-section">
                <h4>Color Selection</h4>
                <input type="color" id="color-picker" value="#323264">
                <div class="color-presets">
                  <button class="color-preset" data-color="#323264" style="background-color: #323264;"></button>
                  <button class="color-preset" data-color="#00ff00" style="background-color: #00ff00;"></button>
                  <button class="color-preset" data-color="#ff0000" style="background-color: #ff0000;"></button>
                </div>
              </div>
              
              <div class="button-grid" id="led-button-grid">
                <!-- Button grid will be populated dynamically -->
              </div>
              
              <div class="led-effects">
                <h4>Effects</h4>
                <select id="effect-select">
                  <option value="">No Effect</option>
                  <option value="RAINBOW">Rainbow</option>
                  <option value="BREATHE">Breathe</option>
                  <option value="WAVE">Wave</option>
                </select>
                <button id="start-effect">Start Effect</button>
                <button id="stop-effect">Stop Effect</button>
              </div>
              
              <div class="led-controls-buttons">
                <button id="test-pattern">Test Pattern</button>
                <button id="clear-all">Clear All</button>
                <button id="apply-all">Apply to All</button>
              </div>
            </div>
            
            <div id="led-messages" class="messages-container"></div>
          </div>
        </div>
      </div>

      <div id="macro-recorder-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Macro Recorder</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="macro-controls">
              <input type="text" id="sequence-name" placeholder="Enter sequence name">
              <button id="start-recording">Start Recording</button>
              <button id="stop-recording">Stop Recording</button>
              <button id="play-sequence">Play Sequence</button>
            </div>
            <div id="macro-messages" class="messages-container"></div>
          </div>
        </div>
      </div>

      <div id="voice-recognition-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Voice Recognition</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="voice-controls">
              <button id="start-listening">Start Listening</button>
              <button id="stop-listening">Stop Listening</button>
              <button id="add-voice-command">Add Command</button>
            </div>
            <div id="voice-messages" class="messages-container"></div>
          </div>
        </div>
      </div>

      <div id="plugin-manager-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Plugin Manager</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="plugin-list"></div>
            <div id="plugin-messages" class="messages-container"></div>
          </div>
        </div>
      </div>

      <div id="system-integration-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>System Integration</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="system-integration-content">
              <div class="shortcuts-section">
                <h4>Global Shortcuts</h4>
                <button id="add-shortcut">Add Shortcut</button>
                <div id="shortcuts-list"></div>
              </div>
              <div class="clipboard-section">
                <h4>Clipboard Management</h4>
                <button id="get-clipboard">Get Clipboard History</button>
                <div id="clipboard-history"></div>
              </div>
            </div>
            <div id="system-integration-messages" class="messages-container"></div>
          </div>
        </div>
      </div>

      <div id="performance-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Performance Monitor</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="performance-metrics">
              <div class="metrics-grid">
                <div class="metric">
                  <label>CPU Usage:</label>
                  <span id="cpu-usage">0%</span>
                </div>
                <div class="metric">
                  <label>Memory Usage:</label>
                  <span id="memory-usage">0MB</span>
                </div>
              </div>
            </div>
            <div id="performance-messages" class="messages-container"></div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `, {
    url: "http://localhost:3000",
    pretendToBeVisual: true,
    resources: "usable"
  });

  // Set up globals
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.MouseEvent = dom.window.MouseEvent;
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;

  // Mock additional browser APIs
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  // Mock fetch API
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob())
    })
  );

  // Mock performance API
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    timing: {}
  };

  // Mock requestAnimationFrame
  global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
  global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

  // Mock ResizeObserver
  global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));

  return dom;
};

// Create DOM for each test
const setupTestEnvironment = () => {
  const dom = createTestDOM();
  
  // Mock electron APIs for renderer
  global.electronAPI = {
    invoke: jest.fn(),
    on: jest.fn(),
    
    // LED Management
    getLedStatus: jest.fn().mockResolvedValue({
      enabled: false,
      buttonCount: 8,
      brightness: 128,
      currentColors: {},
      currentEffect: null
    }),
    setLedBrightness: jest.fn().mockResolvedValue({ success: true }),
    setLedButtonColor: jest.fn().mockResolvedValue({ success: true }),
    setLedAllButtons: jest.fn().mockResolvedValue({ success: true }),
    clearAllLeds: jest.fn().mockResolvedValue({ success: true }),
    startLedEffect: jest.fn().mockResolvedValue({ success: true }),
    stopLedEffect: jest.fn().mockResolvedValue({ success: true }),
    runLedTestPattern: jest.fn().mockResolvedValue({ success: true }),
    
    // Macro Recording
    startMacroRecording: jest.fn().mockResolvedValue({ success: true }),
    stopMacroRecording: jest.fn().mockResolvedValue({ success: true }),
    playMacroSequence: jest.fn().mockResolvedValue({ success: true }),
    getSavedSequences: jest.fn().mockResolvedValue([]),
    
    // Voice Recognition
    getVoiceRecognitionStatus: jest.fn().mockResolvedValue({
      isListening: false,
      isEnabled: true
    }),
    startVoiceListening: jest.fn().mockResolvedValue({ success: true }),
    stopVoiceListening: jest.fn().mockResolvedValue({ success: true }),
    getVoiceCommands: jest.fn().mockResolvedValue([]),
    
    // Plugin Management
    getPlugins: jest.fn().mockResolvedValue([]),
    enablePlugin: jest.fn().mockResolvedValue({ success: true }),
    disablePlugin: jest.fn().mockResolvedValue({ success: true }),
    
    // System Integration
    getSystemIntegrationStatus: jest.fn().mockResolvedValue({
      globalShortcuts: {},
      clipboardHistory: []
    }),
    registerGlobalShortcut: jest.fn().mockResolvedValue({ success: true }),
    getClipboardHistory: jest.fn().mockResolvedValue([]),
    
    // Performance Monitoring
    getPerformanceMetrics: jest.fn().mockResolvedValue({
      cpu: 0,
      memory: { rss: 0, heapTotal: 0, heapUsed: 0 }
    }),
    startPerformanceMonitoring: jest.fn().mockResolvedValue({ success: true }),
    stopPerformanceMonitoring: jest.fn().mockResolvedValue({ success: true })
  };

  return dom;
};

// Cleanup function
const cleanupTestEnvironment = () => {
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.HTMLElement;
  delete global.Element;
  delete global.Event;
  delete global.CustomEvent;
  delete global.KeyboardEvent;
  delete global.MouseEvent;
  delete global.localStorage;
  delete global.sessionStorage;
  delete global.fetch;
  delete global.performance;
  delete global.requestAnimationFrame;
  delete global.cancelAnimationFrame;
  delete global.ResizeObserver;
  delete global.IntersectionObserver;
  delete global.electronAPI;
};

module.exports = {
  createTestDOM,
  setupTestEnvironment,
  cleanupTestEnvironment
};
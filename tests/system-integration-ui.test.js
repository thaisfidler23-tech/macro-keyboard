/**
 * SystemIntegrationUI Test Suite
 * 
 * Tests for the system integration user interface including:
 * - Modal creation and management
 * - Tab switching and navigation
 * - Form handling and validation
 * - Event listeners and user interactions
 * - Data loading and display
 */

const { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Create DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Test</title></head>
    <body></body>
  </html>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Set up global DOM
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

// Mock electronAPI
global.window.electronAPI = {
  getSystemIntegrationStatus: jest.fn(),
  onSystemIntegrationEvent: jest.fn()
};

const SystemIntegrationUI = require('../src/renderer/SystemIntegrationUI');

describe('SystemIntegrationUI', () => {
  let systemIntegrationUI;
  let mockElectronAPI;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock electron API
    mockElectronAPI = {
      getSystemIntegrationStatus: jest.fn().mockResolvedValue({
        initialized: true,
        platform: 'darwin',
        features: {
          globalShortcuts: true,
          clipboardMonitoring: true,
          windowManagement: true,
          systemStateMonitoring: true,
          applicationIntegration: true,
          hardwareInputCapture: true
        },
        shortcuts: 2,
        clipboardHistory: 5,
        focusedApplication: 'Test Application',
        systemState: {
          memoryUsage: 60,
          cpuUsage: 25,
          networkStatus: 'connected'
        }
      }),
      onSystemIntegrationEvent: jest.fn(),
      registerGlobalShortcut: jest.fn().mockResolvedValue({ success: true }),
      unregisterGlobalShortcut: jest.fn().mockResolvedValue({ success: true }),
      getClipboardHistory: jest.fn().mockResolvedValue([]),
      setClipboardContent: jest.fn().mockResolvedValue({ success: true }),
      getActiveWindow: jest.fn().mockResolvedValue({ title: 'Test Window' }),
      getSystemState: jest.fn().mockResolvedValue({
        memoryUsage: 60,
        cpuUsage: 25,
        networkStatus: 'connected'
      })
    };
    
    global.window.electronAPI = mockElectronAPI;
    
    // Create new instance for each test
    systemIntegrationUI = new SystemIntegrationUI();
  });

  afterEach(() => {
    if (systemIntegrationUI && systemIntegrationUI.isVisible) {
      systemIntegrationUI.hide();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      expect(systemIntegrationUI.isVisible).toBe(false);
      expect(systemIntegrationUI.currentTab).toBe('shortcuts');
      expect(systemIntegrationUI.registeredShortcuts).toBeInstanceOf(Map);
      expect(systemIntegrationUI.clipboardHistory).toEqual([]);
    });

    test('should set up event listeners on construction', () => {
      expect(mockElectronAPI.onSystemIntegrationEvent).toHaveBeenCalled();
    });
  });

  describe('Modal Management', () => {
    test('should create modal when shown for first time', async () => {
      await systemIntegrationUI.show();
      
      const modal = document.getElementById('system-integration-modal');
      expect(modal).toBeTruthy();
      expect(modal.style.display).toBe('block');
      expect(systemIntegrationUI.isVisible).toBe(true);
    });

    test('should show existing modal when already created', async () => {
      await systemIntegrationUI.show();
      systemIntegrationUI.hide();
      await systemIntegrationUI.show();
      
      const modals = document.querySelectorAll('#system-integration-modal');
      expect(modals).toHaveLength(1); // Should only have one modal
    });

    test('should hide modal correctly', async () => {
      await systemIntegrationUI.show();
      systemIntegrationUI.hide();
      
      const modal = document.getElementById('system-integration-modal');
      expect(modal.style.display).toBe('none');
      expect(systemIntegrationUI.isVisible).toBe(false);
    });

    test('should remove existing modal before creating new one', async () => {
      // Create a mock existing modal
      const existingModal = document.createElement('div');
      existingModal.id = 'system-integration-modal';
      document.body.appendChild(existingModal);
      
      await systemIntegrationUI.show();
      
      const modals = document.querySelectorAll('#system-integration-modal');
      expect(modals).toHaveLength(1);
    });
  });

  describe('Tab Management', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should switch tabs correctly', () => {
      systemIntegrationUI.switchTab('clipboard');
      
      expect(systemIntegrationUI.currentTab).toBe('clipboard');
      
      const activeTabButton = document.querySelector('.tab-button.active');
      expect(activeTabButton.dataset.tab).toBe('clipboard');
      
      const activeTabContent = document.querySelector('.tab-content.active');
      expect(activeTabContent.id).toBe('clipboard-tab');
    });

    test('should load tab data when switching tabs', () => {
      const loadTabDataSpy = jest.spyOn(systemIntegrationUI, 'loadTabData');
      
      systemIntegrationUI.switchTab('windows');
      
      expect(loadTabDataSpy).toHaveBeenCalledWith('windows');
    });

    test('should handle all tab types', () => {
      const tabs = ['shortcuts', 'clipboard', 'windows', 'automation', 'monitoring'];
      
      tabs.forEach(tab => {
        systemIntegrationUI.switchTab(tab);
        expect(systemIntegrationUI.currentTab).toBe(tab);
      });
    });
  });

  describe('Event Listeners Setup', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should set up close button event listener', () => {
      const closeButton = document.getElementById('close-system-integration');
      expect(closeButton).toBeTruthy();
      
      // Spy on hide method
      const hideSpy = jest.spyOn(systemIntegrationUI, 'hide');
      
      closeButton.click();
      expect(hideSpy).toHaveBeenCalled();
    });

    test('should set up tab button event listeners', () => {
      const tabButtons = document.querySelectorAll('.tab-button');
      expect(tabButtons.length).toBeGreaterThan(0);
      
      const switchTabSpy = jest.spyOn(systemIntegrationUI, 'switchTab');
      
      // Click first tab button
      tabButtons[0].click();
      expect(switchTabSpy).toHaveBeenCalled();
    });

    test('should close modal when clicking outside', () => {
      const hideSpy = jest.spyOn(systemIntegrationUI, 'hide');
      const modal = document.getElementById('system-integration-modal');
      
      // Simulate click on modal background
      const clickEvent = new Event('click');
      Object.defineProperty(clickEvent, 'target', {
        value: modal,
        enumerable: true
      });
      
      modal.dispatchEvent(clickEvent);
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should close modal with ESC key', () => {
      const hideSpy = jest.spyOn(systemIntegrationUI, 'hide');
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      expect(hideSpy).toHaveBeenCalled();
    });

    test('should switch tabs with Ctrl+Number', () => {
      const switchTabSpy = jest.spyOn(systemIntegrationUI, 'switchTab');
      
      const ctrlOneEvent = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true
      });
      document.dispatchEvent(ctrlOneEvent);
      
      expect(switchTabSpy).toHaveBeenCalledWith('shortcuts');
    });

    test('should handle all Ctrl+Number combinations', () => {
      const switchTabSpy = jest.spyOn(systemIntegrationUI, 'switchTab');
      const tabs = ['shortcuts', 'clipboard', 'windows', 'automation', 'monitoring'];
      
      tabs.forEach((tab, index) => {
        const ctrlNumEvent = new KeyboardEvent('keydown', {
          key: (index + 1).toString(),
          ctrlKey: true
        });
        document.dispatchEvent(ctrlNumEvent);
        
        expect(switchTabSpy).toHaveBeenCalledWith(tab);
      });
    });
  });

  describe('Data Loading', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should load system integration status', async () => {
      await systemIntegrationUI.loadSystemIntegrationData();
      
      expect(mockElectronAPI.getSystemIntegrationStatus).toHaveBeenCalled();
    });

    test('should update integration status display', () => {
      const status = {
        initialized: true,
        platform: 'darwin',
        features: { globalShortcuts: true }
      };
      
      systemIntegrationUI.updateIntegrationStatus(status);
      
      const statusElement = document.getElementById('integration-status');
      expect(statusElement.textContent).toBe('System Integration: Active');
      expect(statusElement.className).toBe('status-active');
    });

    test('should handle inactive status', () => {
      const status = {
        initialized: false,
        platform: 'darwin',
        features: {}
      };
      
      systemIntegrationUI.updateIntegrationStatus(status);
      
      const statusElement = document.getElementById('integration-status');
      expect(statusElement.textContent).toBe('System Integration: Inactive');
      expect(statusElement.className).toBe('status-inactive');
    });
  });

  describe('System Integration Events', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should handle shortcut-triggered event', () => {
      const handleShortcutTriggeredSpy = jest.spyOn(systemIntegrationUI, 'handleShortcutTriggered');
      systemIntegrationUI.handleShortcutTriggered = jest.fn();
      
      const eventData = { shortcut: 'Ctrl+Shift+K', timestamp: new Date() };
      systemIntegrationUI.handleSystemIntegrationEvent('shortcut-triggered', eventData);
      
      expect(systemIntegrationUI.handleShortcutTriggered).toHaveBeenCalledWith(eventData);
    });

    test('should handle clipboard-changed event', () => {
      systemIntegrationUI.handleClipboardChanged = jest.fn();
      
      const eventData = { newContent: 'test', oldContent: '' };
      systemIntegrationUI.handleSystemIntegrationEvent('clipboard-changed', eventData);
      
      expect(systemIntegrationUI.handleClipboardChanged).toHaveBeenCalledWith(eventData);
    });

    test('should handle window-focus-changed event', () => {
      systemIntegrationUI.handleWindowFocusChanged = jest.fn();
      
      const eventData = { current: 'New App', previous: 'Old App' };
      systemIntegrationUI.handleSystemIntegrationEvent('window-focus-changed', eventData);
      
      expect(systemIntegrationUI.handleWindowFocusChanged).toHaveBeenCalledWith(eventData);
    });

    test('should handle system-state-changed event', () => {
      systemIntegrationUI.handleSystemStateChanged = jest.fn();
      
      const eventData = { newState: { memoryUsage: 70 }, oldState: { memoryUsage: 60 } };
      systemIntegrationUI.handleSystemIntegrationEvent('system-state-changed', eventData);
      
      expect(systemIntegrationUI.handleSystemStateChanged).toHaveBeenCalledWith(eventData);
    });

    test('should log unknown events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      systemIntegrationUI.handleSystemIntegrationEvent('unknown-event', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown system integration event:',
        'unknown-event',
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Utility Functions', () => {
    test('should debounce function calls correctly', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = systemIntegrationUI.debounce(mockFn, 100);
      
      // Call multiple times quickly
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');
      
      // Function should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();
      
      // Wait for debounce delay
      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('arg3');
        done();
      }, 150);
    });

    test('should show error notifications', () => {
      systemIntegrationUI.showError('Test error message');
      
      const errorDiv = document.getElementById('system-integration-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toBe('Test error message');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.className).toBe('error-notification');
    });

    test('should show success notifications', () => {
      systemIntegrationUI.showSuccess('Test success message');
      
      const successDiv = document.getElementById('system-integration-success');
      expect(successDiv).toBeTruthy();
      expect(successDiv.textContent).toBe('Test success message');
      expect(successDiv.style.display).toBe('block');
      expect(successDiv.className).toBe('success-notification');
    });

    test('should auto-hide notifications after timeout', (done) => {
      systemIntegrationUI.showError('Test error', 100);
      
      const errorDiv = document.getElementById('system-integration-error');
      expect(errorDiv.style.display).toBe('block');
      
      setTimeout(() => {
        expect(errorDiv.style.display).toBe('none');
        done();
      }, 150);
    });
  });

  describe('Tab-Specific Functionality', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should have placeholder methods for tab data loading', () => {
      // These methods should exist even if they're placeholders
      expect(typeof systemIntegrationUI.loadShortcutsData).toBe('function');
      expect(typeof systemIntegrationUI.loadClipboardData).toBe('function');
      expect(typeof systemIntegrationUI.loadWindowsData).toBe('function');
      expect(typeof systemIntegrationUI.loadAutomationData).toBe('function');
      expect(typeof systemIntegrationUI.loadMonitoringData).toBe('function');
    });

    test('should have placeholder methods for form management', () => {
      expect(typeof systemIntegrationUI.showShortcutForm).toBe('function');
      expect(typeof systemIntegrationUI.saveShortcut).toBe('function');
      expect(typeof systemIntegrationUI.clearClipboardHistory).toBe('function');
      expect(typeof systemIntegrationUI.refreshWindowInfo).toBe('function');
    });

    test('should have placeholder methods for settings management', () => {
      expect(typeof systemIntegrationUI.exportSettings).toBe('function');
      expect(typeof systemIntegrationUI.importSettings).toBe('function');
      expect(typeof systemIntegrationUI.resetSettings).toBe('function');
    });
  });

  describe('Modal Structure', () => {
    beforeEach(async () => {
      await systemIntegrationUI.show();
    });

    test('should create modal with correct structure', () => {
      const modal = document.getElementById('system-integration-modal');
      expect(modal).toBeTruthy();
      expect(modal.className).toBe('system-integration-modal');
      
      const content = modal.querySelector('.system-integration-content');
      expect(content).toBeTruthy();
      
      const header = content.querySelector('.system-integration-header');
      expect(header).toBeTruthy();
      
      const tabs = content.querySelector('.system-integration-tabs');
      expect(tabs).toBeTruthy();
      
      const body = content.querySelector('.system-integration-body');
      expect(body).toBeTruthy();
      
      const footer = content.querySelector('.system-integration-footer');
      expect(footer).toBeTruthy();
    });

    test('should create all tab content areas', () => {
      const tabContents = document.querySelectorAll('.tab-content');
      expect(tabContents).toHaveLength(5);
      
      const expectedTabs = ['shortcuts-tab', 'clipboard-tab', 'windows-tab', 'automation-tab', 'monitoring-tab'];
      expectedTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        expect(tab).toBeTruthy();
        expect(tab.classList.contains('tab-content')).toBe(true);
      });
    });

    test('should create all tab buttons', () => {
      const tabButtons = document.querySelectorAll('.tab-button');
      expect(tabButtons).toHaveLength(5);
      
      const expectedTabs = ['shortcuts', 'clipboard', 'windows', 'automation', 'monitoring'];
      tabButtons.forEach((button, index) => {
        expect(button.dataset.tab).toBe(expectedTabs[index]);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle data loading errors gracefully', async () => {
      mockElectronAPI.getSystemIntegrationStatus.mockRejectedValue(new Error('API Error'));
      
      const showErrorSpy = jest.spyOn(systemIntegrationUI, 'showError');
      
      await systemIntegrationUI.loadSystemIntegrationData();
      
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to load system integration data');
    });

    test('should continue functioning after initialization errors', async () => {
      mockElectronAPI.getSystemIntegrationStatus.mockRejectedValue(new Error('Init Error'));
      
      await systemIntegrationUI.show();
      
      // UI should still be created and functional
      const modal = document.getElementById('system-integration-modal');
      expect(modal).toBeTruthy();
      expect(systemIntegrationUI.isVisible).toBe(true);
    });
  });
});

// Clean up after all tests
afterAll(() => {
  dom.window.close();
});
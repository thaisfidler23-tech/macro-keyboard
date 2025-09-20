/**
 * @jest-environment jsdom
 */

const ContextManagerUI = require('../src/renderer/ContextManagerUI');

// Mock electron API
window.electronAPI = {
  invoke: jest.fn(),
  on: jest.fn()
};

// Mock DOM elements and methods
Object.defineProperty(window, 'showNotification', {
  value: jest.fn(),
  writable: true
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('ContextManagerUI', () => {
  let contextManagerUI;
  let mockContainer;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock tab content container
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    document.body.appendChild(tabContent);

    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock initial API responses
    window.electronAPI.invoke.mockImplementation((channel, ...args) => {
      switch (channel) {
        case 'get-context-rules':
          return Promise.resolve([]);
        case 'get-current-context':
          return Promise.resolve({
            application: { name: 'TestApp' },
            timeContext: { hour: 14, dayOfWeek: 1 },
            systemState: { state: 'active' },
            activeProfile: 'default'
          });
        case 'get-profile-switching-status':
          return Promise.resolve({
            isEnabled: false,
            currentMode: 'manual',
            statistics: {}
          });
        case 'get-switch-history':
          return Promise.resolve([]);
        case 'get-profiles':
          return Promise.resolve([
            { name: 'default', displayName: 'Default' },
            { name: 'work', displayName: 'Work Profile' },
            { name: 'gaming', displayName: 'Gaming Profile' }
          ]);
        default:
          return Promise.resolve({});
      }
    });

    contextManagerUI = new ContextManagerUI();
  });

  afterEach(() => {
    if (contextManagerUI) {
      contextManagerUI.destroy();
    }
  });

  describe('Initialization', () => {
    test('should create UI container', () => {
      expect(contextManagerUI.container).toBeTruthy();
      expect(contextManagerUI.container.id).toBe('context-manager-container');
      expect(contextManagerUI.container.classList.contains('context-manager-container')).toBe(true);
    });

    test('should initialize with proper structure', () => {
      const header = contextManagerUI.container.querySelector('.context-manager-header');
      const content = contextManagerUI.container.querySelector('.context-manager-content');
      
      expect(header).toBeTruthy();
      expect(content).toBeTruthy();
      expect(header.querySelector('h3').textContent).toBe('Context-Aware Profiles');
    });

    test('should load initial data', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-context-rules');
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-current-context');
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-profile-switching-status');
    });

    test('should handle initialization errors gracefully', async () => {
      window.electronAPI.invoke.mockRejectedValue(new Error('API Error'));
      
      const errorUI = new ContextManagerUI();
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Current Context Display', () => {
    test('should update current context display', () => {
      const contextData = {
        application: { name: 'Visual Studio Code' },
        timeContext: { hour: 14, dayOfWeek: 1 },
        systemState: { state: 'active' },
        activeProfile: 'development'
      };

      contextManagerUI.currentContext = contextData;
      contextManagerUI.updateCurrentContextDisplay();

      const currentApp = contextManagerUI.container.querySelector('#current-app');
      const currentProfile = contextManagerUI.container.querySelector('#current-profile');

      expect(currentApp.textContent).toBe('Visual Studio Code');
      expect(currentProfile.textContent).toBe('development');
    });

    test('should handle missing context data', () => {
      contextManagerUI.currentContext = null;
      contextManagerUI.updateCurrentContextDisplay();

      // Should not throw error
      expect(contextManagerUI.currentContext).toBeNull();
    });

    test('should update time display dynamically', () => {
      contextManagerUI.updateCurrentContextDisplay();

      const currentTime = contextManagerUI.container.querySelector('#current-time');
      expect(currentTime.textContent).toMatch(/\d{1,2}:\d{2}/); // Time format
    });
  });

  describe('Rules Management', () => {
    test('should display "no rules" message when empty', () => {
      contextManagerUI.contextRules = [];
      contextManagerUI.updateRulesDisplay();

      const noRules = contextManagerUI.container.querySelector('.no-rules');
      expect(noRules).toBeTruthy();
      expect(noRules.textContent).toBe('No context rules configured');
    });

    test('should display rules correctly', () => {
      const testRules = [
        {
          id: 'rule1',
          name: 'Work Hours',
          type: 'time',
          startTime: '09:00',
          endTime: '17:00',
          targetProfile: 'work',
          priority: 'medium'
        },
        {
          id: 'rule2',
          name: 'Slack Rule',
          type: 'application',
          applicationName: 'Slack',
          targetProfile: 'communication',
          priority: 'high'
        }
      ];

      contextManagerUI.contextRules = testRules;
      contextManagerUI.updateRulesDisplay();

      const ruleElements = contextManagerUI.container.querySelectorAll('.rule-item');
      expect(ruleElements).toHaveLength(2);

      const firstRule = ruleElements[0];
      expect(firstRule.querySelector('.rule-name').textContent).toBe('Work Hours');
      expect(firstRule.classList.contains('priority-medium')).toBe(true);
    });

    test('should format rule types correctly', () => {
      const testCases = [
        {
          type: 'application',
          applicationName: 'Chrome',
          expected: 'App: Chrome'
        },
        {
          type: 'time',
          startTime: '09:00',
          endTime: '17:00',
          expected: 'Time: 09:00-17:00'
        },
        {
          type: 'system',
          systemState: 'idle',
          expected: 'System: idle'
        }
      ];

      testCases.forEach(testCase => {
        const formatted = contextManagerUI.formatRuleType(testCase);
        expect(formatted).toBe(testCase.expected);
      });
    });
  });

  describe('Rule Form Management', () => {
    test('should show rule form for adding', () => {
      contextManagerUI.showRuleForm();

      const formContainer = contextManagerUI.container.querySelector('#rule-form-container');
      expect(formContainer.classList.contains('hidden')).toBe(false);
      expect(contextManagerUI.editingRuleId).toBeNull();
    });

    test('should show rule form for editing', () => {
      const testRule = {
        id: 'rule1',
        name: 'Test Rule',
        type: 'application',
        applicationName: 'TestApp',
        targetProfile: 'test',
        priority: 'medium'
      };

      contextManagerUI.showRuleForm(testRule);

      const formContainer = contextManagerUI.container.querySelector('#rule-form-container');
      expect(formContainer.classList.contains('hidden')).toBe(false);
      expect(contextManagerUI.editingRuleId).toBe('rule1');

      const nameInput = contextManagerUI.container.querySelector('#rule-name');
      expect(nameInput.value).toBe('Test Rule');
    });

    test('should hide rule form', () => {
      contextManagerUI.showRuleForm();
      contextManagerUI.hideRuleForm();

      const formContainer = contextManagerUI.container.querySelector('#rule-form-container');
      expect(formContainer.classList.contains('hidden')).toBe(true);
      expect(contextManagerUI.editingRuleId).toBeNull();
    });

    test('should toggle conditional fields based on rule type', () => {
      contextManagerUI.toggleConditionalFields('application');

      const appFields = contextManagerUI.container.querySelector('.application-fields');
      const timeFields = contextManagerUI.container.querySelector('.time-fields');

      expect(appFields.classList.contains('hidden')).toBe(false);
      expect(timeFields.classList.contains('hidden')).toBe(true);
    });

    test('should populate form with existing rule data', () => {
      const rule = {
        id: 'rule1',
        name: 'Work Hours',
        type: 'time',
        startTime: '09:00',
        endTime: '17:00',
        days: ['monday', 'tuesday', 'wednesday'],
        targetProfile: 'work',
        priority: 'high'
      };

      contextManagerUI.populateRuleForm(rule);

      expect(contextManagerUI.container.querySelector('#rule-name').value).toBe('Work Hours');
      expect(contextManagerUI.container.querySelector('#rule-type').value).toBe('time');
      expect(contextManagerUI.container.querySelector('#start-time').value).toBe('09:00');

      const mondayCheck = contextManagerUI.container.querySelector('input[name="days"][value="monday"]');
      expect(mondayCheck.checked).toBe(true);
    });
  });

  describe('Rule Operations', () => {
    test('should save new rule', async () => {
      window.electronAPI.invoke.mockResolvedValue({ success: true });
      
      // Set up form data
      const nameInput = contextManagerUI.container.querySelector('#rule-name');
      const typeSelect = contextManagerUI.container.querySelector('#rule-type');
      const profileSelect = contextManagerUI.container.querySelector('#target-profile');
      
      nameInput.value = 'Test Rule';
      typeSelect.value = 'application';
      profileSelect.value = 'work';

      await contextManagerUI.saveRule();

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('add-context-rule', expect.objectContaining({
        name: 'Test Rule',
        type: 'application',
        targetProfile: 'work'
      }));
    });

    test('should update existing rule', async () => {
      window.electronAPI.invoke.mockResolvedValue({ success: true });
      contextManagerUI.editingRuleId = 'rule1';
      
      const nameInput = contextManagerUI.container.querySelector('#rule-name');
      nameInput.value = 'Updated Rule';

      await contextManagerUI.saveRule();

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('update-context-rule', 'rule1', expect.objectContaining({
        name: 'Updated Rule'
      }));
    });

    test('should handle save errors', async () => {
      window.electronAPI.invoke.mockRejectedValue(new Error('Save failed'));
      
      await contextManagerUI.saveRule();

      expect(console.error).toHaveBeenCalled();
      expect(window.showNotification).toHaveBeenCalledWith('Failed to save rule', 'error');
    });

    test('should delete rule', async () => {
      window.electronAPI.invoke.mockImplementation((channel) => {
        if (channel === 'remove-context-rule') {
          return Promise.resolve({ success: true });
        } else if (channel === 'get-context-rules') {
          return Promise.resolve([]);
        }
        return Promise.resolve({ success: true });
      });
      
      contextManagerUI.contextRules = [{ id: 'rule1', name: 'Test Rule' }];
      
      // Mock confirm dialog
      window.confirm = jest.fn(() => true);

      await contextManagerUI.deleteRule('rule1');

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('remove-context-rule', 'rule1');
      expect(window.showNotification).toHaveBeenCalledWith('Rule deleted successfully', 'success');
    });

    test('should test rule by switching profile', async () => {
      window.electronAPI.invoke.mockResolvedValue({ success: true });
      contextManagerUI.contextRules = [
        { id: 'rule1', name: 'Test Rule', targetProfile: 'work' }
      ];

      await contextManagerUI.testRule('rule1');

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('switch-to-profile', 'work');
      expect(window.showNotification).toHaveBeenCalledWith('Switched to profile: work', 'success');
    });
  });

  describe('Switch History', () => {
    test('should display switch history', () => {
      const history = [
        {
          timestamp: new Date().toISOString(),
          fromProfile: 'default',
          toProfile: 'work',
          trigger: 'manual'
        },
        {
          timestamp: new Date().toISOString(),
          fromProfile: 'work',
          toProfile: 'gaming',
          trigger: 'context-rule'
        }
      ];

      contextManagerUI.switchHistory = history;
      contextManagerUI.updateHistoryDisplay();

      const historyItems = contextManagerUI.container.querySelectorAll('.history-item');
      expect(historyItems).toHaveLength(2);

      const firstItem = historyItems[0];
      expect(firstItem.querySelector('.to-profile').textContent).toBe('work');
    });

    test('should display "no history" message when empty', () => {
      contextManagerUI.switchHistory = [];
      contextManagerUI.updateHistoryDisplay();

      const noHistory = contextManagerUI.container.querySelector('.no-history');
      expect(noHistory).toBeTruthy();
      expect(noHistory.textContent).toBe('No recent switches');
    });

    test('should format history timestamps correctly', () => {
      const testDate = new Date('2024-01-15T14:30:00');
      const element = contextManagerUI.createHistoryElement({
        timestamp: testDate.toISOString(),
        fromProfile: 'default',
        toProfile: 'work'
      });

      const timeElement = element.querySelector('.history-time');
      expect(timeElement.textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('Event Handling', () => {
    test('should handle automatic switching toggle', async () => {
      window.electronAPI.invoke.mockResolvedValue({ success: true });
      
      const toggle = contextManagerUI.container.querySelector('#automatic-switching-toggle');
      toggle.checked = true;

      const event = new Event('change');
      toggle.dispatchEvent(event);

      expect(window.electronAPI.invoke).toHaveBeenCalledWith('enable-automatic-switching');
    });

    test('should handle add rule button click', () => {
      const showFormSpy = jest.spyOn(contextManagerUI, 'showRuleForm');
      
      const addButton = contextManagerUI.container.querySelector('#add-rule-btn');
      addButton.click();

      expect(showFormSpy).toHaveBeenCalled();
    });

    test('should handle form submission', async () => {
      const saveRuleSpy = jest.spyOn(contextManagerUI, 'saveRule').mockResolvedValue();
      
      const form = contextManagerUI.container.querySelector('#context-rule-form');
      const event = new Event('submit');
      form.dispatchEvent(event);

      expect(saveRuleSpy).toHaveBeenCalled();
    });
  });

  describe('IPC Event Listeners', () => {
    test('should set up IPC listeners', () => {
      expect(window.electronAPI.on).toHaveBeenCalledWith('context-changed', expect.any(Function));
      expect(window.electronAPI.on).toHaveBeenCalledWith('application-changed', expect.any(Function));
      expect(window.electronAPI.on).toHaveBeenCalledWith('profile-switched', expect.any(Function));
    });

    test('should update context on context-changed event', () => {
      const updateSpy = jest.spyOn(contextManagerUI, 'updateCurrentContextDisplay');
      
      // Find the context-changed callback
      const onCall = window.electronAPI.on.mock.calls.find(call => call[0] === 'context-changed');
      const callback = onCall[1];
      
      const contextData = { application: { name: 'NewApp' } };
      callback(contextData);

      expect(contextManagerUI.currentContext).toEqual(contextData);
      expect(updateSpy).toHaveBeenCalled();
    });

    test('should add to history on profile-switched event', () => {
      const updateHistorySpy = jest.spyOn(contextManagerUI, 'updateHistoryDisplay');
      
      // Find the profile-switched callback
      const onCall = window.electronAPI.on.mock.calls.find(call => call[0] === 'profile-switched');
      const callback = onCall[1];
      
      const switchData = {
        fromProfile: 'default',
        toProfile: 'work',
        trigger: 'manual'
      };
      callback(switchData);

      expect(contextManagerUI.switchHistory).toHaveLength(1);
      expect(updateHistorySpy).toHaveBeenCalled();
    });
  });

  describe('Show/Hide Functionality', () => {
    test('should show context manager', () => {
      contextManagerUI.hide();
      contextManagerUI.show();

      expect(contextManagerUI.container.classList.contains('hidden')).toBe(false);
    });

    test('should hide context manager', () => {
      contextManagerUI.show();
      contextManagerUI.hide();

      expect(contextManagerUI.container.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should destroy component properly', () => {
      const container = contextManagerUI.container;
      const parent = container.parentNode;
      
      contextManagerUI.destroy();

      expect(parent.contains(container)).toBe(false);
      expect(contextManagerUI.isInitialized).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      window.electronAPI.invoke.mockRejectedValue(new Error('API Error'));
      
      await contextManagerUI.saveRule();

      expect(console.error).toHaveBeenCalled();
      expect(window.showNotification).toHaveBeenCalledWith('Failed to save rule', 'error');
    });

    test('should display error messages', () => {
      contextManagerUI.showError('Test error message');

      expect(window.showNotification).toHaveBeenCalledWith('Test error message', 'error');
    });

    test('should display success messages', () => {
      contextManagerUI.showSuccess('Test success message');

      expect(window.showNotification).toHaveBeenCalledWith('Test success message', 'success');
    });
  });

  describe('Profile Loading', () => {
    test('should load available profiles into dropdown', async () => {
      await contextManagerUI.loadAvailableProfiles();

      const profileSelect = contextManagerUI.container.querySelector('#target-profile');
      const options = profileSelect.querySelectorAll('option');

      expect(options).toHaveLength(4); // Including the default option
      expect(options[1].value).toBe('default');
      expect(options[2].value).toBe('work');
      expect(options[3].value).toBe('gaming');
    });

    test('should handle profile loading errors', async () => {
      window.electronAPI.invoke.mockRejectedValue(new Error('Profile loading failed'));
      
      await contextManagerUI.loadAvailableProfiles();

      expect(console.error).toHaveBeenCalled();
    });
  });
});
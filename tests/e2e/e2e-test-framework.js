/**
 * End-to-End Test Framework for Macro Keyboard Application
 * 
 * This framework provides comprehensive E2E testing capabilities for Electron applications
 * with hardware integration, focusing on real user workflows and business processes.
 */

const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const { EventEmitter } = require('events');

/**
 * E2E Test Framework Configuration
 */
class E2ETestFramework {
    constructor(options = {}) {
        this.config = {
            appPath: path.join(__dirname, '../../src/main.js'),
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            screenshotOnFailure: options.screenshotOnFailure !== false,
            videoRecording: options.videoRecording || false,
            parallelExecution: options.parallelExecution || false,
            ...options
        };

        this.electronApp = null;
        this.mainWindow = null;
        this.testData = new Map();
        this.screenshots = [];
        this.testStartTime = null;
        this.mockHardware = null;
    }

    /**
     * Initialize the test environment and application
     */
    async initialize() {
        this.testStartTime = Date.now();
        
        // Initialize mock hardware simulation
        this.mockHardware = new MockHardwareSimulator();
        await this.mockHardware.initialize();

        // Launch Electron application
        this.electronApp = await electron.launch({
            args: [this.config.appPath, '--test-mode', '--no-sandbox'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                ELECTRON_ENABLE_LOGGING: 'true',
                MOCK_HARDWARE: 'true'
            },
            timeout: this.config.timeout
        });

        // Get the main window
        this.mainWindow = await this.electronApp.firstWindow();
        
        // Wait for application to be ready
        await this.waitForApplicationReady();
        
        // Setup test data and configuration
        await this.setupTestEnvironment();

        return this.electronApp;
    }

    /**
     * Wait for the application to be fully loaded and ready
     */
    async waitForApplicationReady() {
        // Wait for core UI elements to be present
        await this.mainWindow.waitForSelector('header h1', { timeout: this.config.timeout });
        await this.mainWindow.waitForSelector('#connection-status', { timeout: this.config.timeout });
        await this.mainWindow.waitForSelector('#serial-port', { timeout: this.config.timeout });

        // Wait for application initialization to complete
        await this.mainWindow.waitForTimeout(2000);
    }

    /**
     * Setup test environment with mock data and configurations
     */
    async setupTestEnvironment() {
        // Create test configuration
        const testConfig = {
            serial: {
                port: 'MOCK_PORT',
                baudRate: 115200
            },
            hardware: {
                buttons: 16,
                encoders: 2
            },
            profiles: {
                test_profile_1: {
                    name: "Test Profile 1",
                    buttons: {
                        1: { type: 'keyboard', value: 'ctrl+c' },
                        2: { type: 'text', value: 'Hello World' },
                        3: { type: 'command', value: 'echo "test"' }
                    }
                }
            },
            security: {
                enabled: true,
                mode: 'allowlist',
                allowedCommands: ['echo', 'ls', 'pwd']
            }
        };

        // Setup mock serial ports
        await this.mockHardware.createMockSerialPort('MOCK_PORT', {
            manufacturer: 'Arduino',
            productId: '0043',
            vendorId: '2341'
        });

        // Load test configuration into application
        await this.loadTestConfiguration(testConfig);
    }

    /**
     * Load test configuration into the application
     */
    async loadTestConfiguration(config) {
        await this.mainWindow.evaluate((config) => {
            return window.electronAPI.invoke('load-test-config', config);
        }, config);
    }

    /**
     * Cleanup and close the application
     */
    async cleanup() {
        // Take final screenshot if enabled
        if (this.config.screenshotOnFailure) {
            await this.takeScreenshot('cleanup');
        }

        // Stop mock hardware
        if (this.mockHardware) {
            await this.mockHardware.cleanup();
        }

        // Close application
        if (this.electronApp) {
            await this.electronApp.close();
        }

        // Generate test report
        await this.generateTestReport();
    }

    /**
     * Take a screenshot for debugging
     */
    async takeScreenshot(name = 'screenshot') {
        if (!this.mainWindow) {
            return null;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}-${timestamp}.png`;
        const filepath = path.join(__dirname, '../screenshots', filename);

        try {
            // Ensure screenshots directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            // Capture screenshot
            await this.mainWindow.screenshot({ path: filepath, fullPage: true });

            this.screenshots.push({
                name,
                filename,
                filepath,
                timestamp: new Date().toISOString()
            });

            return filepath;
        } catch (error) {
            console.warn('Failed to take screenshot:', error.message);
            return null;
        }
    }

    /**
     * Wait for element to be visible and interactable
     */
    async waitForElement(selector, options = {}) {
        const timeout = options.timeout || this.config.timeout;
        const visible = options.visible !== false;

        if (visible) {
            await this.mainWindow.waitForSelector(selector, { timeout, state: 'visible' });
        } else {
            await this.mainWindow.waitForSelector(selector, { timeout });
        }

        return this.mainWindow.locator(selector);
    }

    /**
     * Click element with retry logic
     */
    async clickElement(selector, options = {}) {
        const retryAttempts = options.retryAttempts || this.config.retryAttempts;
        
        for (let i = 0; i < retryAttempts; i++) {
            try {
                await this.waitForElement(selector, { visible: true, timeout: 5000 });
                await this.mainWindow.click(selector);
                await this.mainWindow.waitForTimeout(500); // Wait for click to process
                return;
            } catch (error) {
                if (i === retryAttempts - 1) {
                    await this.takeScreenshot(`click-failed-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
                    throw new Error(`Failed to click element ${selector} after ${retryAttempts} attempts: ${error.message}`);
                }
                await this.mainWindow.waitForTimeout(1000);
            }
        }
    }

    /**
     * Fill form field with validation
     */
    async fillFormField(selector, value, options = {}) {
        await this.waitForElement(selector, { visible: true });
        
        // Clear existing value and set new value
        await this.mainWindow.fill(selector, value);
        
        // Verify value was set correctly
        if (options.verify !== false) {
            const actualValue = await this.mainWindow.inputValue(selector);
            if (actualValue !== value) {
                throw new Error(`Form field ${selector} value mismatch. Expected: ${value}, Actual: ${actualValue}`);
            }
        }
    }

    /**
     * Select option from dropdown
     */
    async selectDropdownOption(selector, value) {
        await this.waitForElement(selector, { visible: true });
        await this.mainWindow.selectOption(selector, value);
        
        // Verify selection
        const selectedValue = await this.mainWindow.inputValue(selector);
        if (selectedValue !== value) {
            throw new Error(`Dropdown ${selector} selection failed. Expected: ${value}, Actual: ${selectedValue}`);
        }
    }

    /**
     * Wait for text content to appear
     */
    async waitForText(selector, expectedText, options = {}) {
        const timeout = options.timeout || this.config.timeout;
        const partial = options.partial || false;

        await this.mainWindow.waitForFunction(
            ({ selector, expectedText, partial }) => {
                const element = document.querySelector(selector);
                if (!element) return false;
                
                const text = element.textContent || element.innerText || '';
                return partial ? text.includes(expectedText) : text === expectedText;
            },
            { selector, expectedText, partial },
            { timeout }
        );
    }

    /**
     * Verify element state
     */
    async verifyElementState(selector, expectedState) {
        const element = this.mainWindow.locator(selector);
        
        for (const [state, expected] of Object.entries(expectedState)) {
            switch (state) {
                case 'visible':
                    if (expected) {
                        await expect(element).toBeVisible();
                    } else {
                        await expect(element).toBeHidden();
                    }
                    break;
                case 'enabled':
                    if (expected) {
                        await expect(element).toBeEnabled();
                    } else {
                        await expect(element).toBeDisabled();
                    }
                    break;
                case 'text':
                    await expect(element).toHaveText(expected);
                    break;
                case 'value':
                    await expect(element).toHaveValue(expected);
                    break;
                case 'class':
                    await expect(element).toHaveClass(new RegExp(expected));
                    break;
                default:
                    throw new Error(`Unknown state check: ${state}`);
            }
        }
    }

    /**
     * Simulate hardware button press
     */
    async simulateButtonPress(buttonId) {
        await this.mockHardware.simulateButtonPress(buttonId);
        
        // Wait for UI to update
        await this.mainWindow.waitForTimeout(500);
    }

    /**
     * Simulate hardware encoder rotation
     */
    async simulateEncoderRotation(encoderId, direction) {
        await this.mockHardware.simulateEncoderRotation(encoderId, direction);
        
        // Wait for UI to update
        await this.mainWindow.waitForTimeout(500);
    }

    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        const endTime = Date.now();
        const duration = endTime - this.testStartTime;

        const report = {
            testRun: {
                startTime: new Date(this.testStartTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
                duration: `${duration}ms`,
                screenshots: this.screenshots.length,
                framework: 'E2E Test Framework v1.0'
            },
            application: {
                version: await this.getApplicationVersion(),
                platform: process.platform,
                electronVersion: process.versions.electron
            },
            screenshots: this.screenshots,
            mockHardware: this.mockHardware ? this.mockHardware.getReport() : null
        };

        const reportPath = path.join(__dirname, '../reports', `e2e-report-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        return report;
    }

    /**
     * Get application version
     */
    async getApplicationVersion() {
        try {
            const packagePath = path.join(__dirname, '../../package.json');
            const packageContent = await fs.readFile(packagePath, 'utf8');
            return JSON.parse(packageContent).version;
        } catch (error) {
            return 'unknown';
        }
    }
}

/**
 * Mock Hardware Simulator for testing hardware interactions
 */
class MockHardwareSimulator {
    constructor() {
        this.mockPorts = new Map();
        this.buttonStates = new Map();
        this.encoderStates = new Map();
        this.eventLog = [];
        this.serialEmitter = new EventEmitter();
    }

    async initialize() {
        // Initialize mock hardware state
        for (let i = 1; i <= 32; i++) {
            this.buttonStates.set(i, false);
        }
        
        for (let i = 1; i <= 8; i++) {
            this.encoderStates.set(i, 0);
        }

        // Set up global mock serial emitter
        global.mockSerialEmitter = this.serialEmitter;
    }

    async createMockSerialPort(portName, properties) {
        this.mockPorts.set(portName, {
            name: portName,
            connected: true,
            ...properties
        });
    }

    async simulateButtonPress(buttonId) {
        const currentState = this.buttonStates.get(buttonId) || false;
        this.buttonStates.set(buttonId, !currentState);
        
        const event = {
            type: 'button',
            buttonId,
            state: !currentState,
            timestamp: Date.now()
        };
        
        this.eventLog.push(event);
        
        // Simulate serial message to application
        this.serialEmitter.emit('data', `BTN:${buttonId}\n`);
    }

    async simulateEncoderRotation(encoderId, direction) {
        const currentValue = this.encoderStates.get(encoderId) || 0;
        const newValue = direction === 'CW' ? currentValue + 1 : currentValue - 1;
        this.encoderStates.set(encoderId, newValue);
        
        const event = {
            type: 'encoder',
            encoderId,
            direction,
            value: newValue,
            timestamp: Date.now()
        };
        
        this.eventLog.push(event);
        
        // Simulate serial message to application
        this.serialEmitter.emit('data', `ENC:${encoderId}:${direction}\n`);
    }

    getReport() {
        return {
            mockPorts: Array.from(this.mockPorts.entries()),
            buttonStates: Array.from(this.buttonStates.entries()),
            encoderStates: Array.from(this.encoderStates.entries()),
            eventLog: this.eventLog
        };
    }

    async cleanup() {
        this.mockPorts.clear();
        this.buttonStates.clear();
        this.encoderStates.clear();
        this.eventLog = [];
        this.serialEmitter.removeAllListeners();
    }
}

module.exports = {
    E2ETestFramework,
    MockHardwareSimulator
};
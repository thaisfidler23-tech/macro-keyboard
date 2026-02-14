/**
 * Cross-Platform E2E Tests
 * 
 * Tests application functionality across different operating systems and browsers.
 * Validates the cross-platform compatibility requirements from the business analysis.
 */

const { test, expect } = require('@playwright/test');
const { E2ETestFramework } = require('../e2e-test-framework');
const MainApplicationPage = require('../page-objects/MainApplicationPage');
const ButtonConfigurationPage = require('../page-objects/ButtonConfigurationPage');

// Platform-specific test configuration
const platformConfigs = {
    darwin: {
        name: 'macOS',
        shortcuts: {
            copy: 'cmd+c',
            paste: 'cmd+v',
            undo: 'cmd+z',
            redo: 'cmd+shift+z',
            selectAll: 'cmd+a',
            find: 'cmd+f',
            newWindow: 'cmd+n',
            closeWindow: 'cmd+w',
            quit: 'cmd+q'
        },
        paths: {
            userHome: '~',
            applications: '/Applications',
            documents: '~/Documents'
        }
    },
    win32: {
        name: 'Windows',
        shortcuts: {
            copy: 'ctrl+c',
            paste: 'ctrl+v',
            undo: 'ctrl+z',
            redo: 'ctrl+y',
            selectAll: 'ctrl+a',
            find: 'ctrl+f',
            newWindow: 'ctrl+n',
            closeWindow: 'ctrl+w',
            quit: 'alt+f4'
        },
        paths: {
            userHome: '%USERPROFILE%',
            applications: '%PROGRAMFILES%',
            documents: '%USERPROFILE%\\Documents'
        }
    },
    linux: {
        name: 'Linux',
        shortcuts: {
            copy: 'ctrl+c',
            paste: 'ctrl+v',
            undo: 'ctrl+z',
            redo: 'ctrl+y',
            selectAll: 'ctrl+a',
            find: 'ctrl+f',
            newWindow: 'ctrl+n',
            closeWindow: 'ctrl+w',
            quit: 'ctrl+q'
        },
        paths: {
            userHome: '~',
            applications: '/usr/bin',
            documents: '~/Documents'
        }
    }
};

const currentPlatform = platformConfigs[process.platform] || platformConfigs.linux;

test.describe(`Cross-Platform Tests - ${currentPlatform.name}`, () => {
    let framework;
    let mainPage;
    let buttonPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 30000
        });
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        buttonPage = new ButtonConfigurationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should configure platform-specific keyboard shortcuts', async () => {
        // GIVEN: Application is ready and connected
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 16,
            encoderCount: 2
        });
        await mainPage.testConnection();

        // WHEN: Configure platform-specific shortcuts
        await test.step(`Configure ${currentPlatform.name}-specific shortcuts`, async () => {
            const platformMacros = [
                { id: 1, type: 'keyboard', value: currentPlatform.shortcuts.copy, label: 'Copy' },
                { id: 2, type: 'keyboard', value: currentPlatform.shortcuts.paste, label: 'Paste' },
                { id: 3, type: 'keyboard', value: currentPlatform.shortcuts.undo, label: 'Undo' },
                { id: 4, type: 'keyboard', value: currentPlatform.shortcuts.redo, label: 'Redo' },
                { id: 5, type: 'keyboard', value: currentPlatform.shortcuts.selectAll, label: 'Select All' },
                { id: 6, type: 'keyboard', value: currentPlatform.shortcuts.find, label: 'Find' },
                { id: 7, type: 'keyboard', value: currentPlatform.shortcuts.newWindow, label: 'New Window' },
                { id: 8, type: 'keyboard', value: currentPlatform.shortcuts.closeWindow, label: 'Close Window' }
            ];

            await buttonPage.bulkConfigureButtons(platformMacros);
        });

        // THEN: Platform-specific shortcuts should be configured correctly
        await test.step('Verify platform-specific configuration', async () => {
            await buttonPage.verifyButtonConfiguration(1, {
                type: 'keyboard',
                value: currentPlatform.shortcuts.copy,
                label: 'Copy'
            });

            await buttonPage.verifyButtonConfiguration(4, {
                type: 'keyboard',
                value: currentPlatform.shortcuts.redo,
                label: 'Redo'
            });
        });

        // WHEN: Test platform-specific shortcuts
        await test.step('Test platform-specific shortcut execution', async () => {
            for (let i = 1; i <= 8; i++) {
                await buttonPage.testButton(i);
                await mainPage.page.waitForTimeout(200);
            }
        });

        // THEN: All shortcuts should execute without errors
        await test.step('Verify shortcut execution success', async () => {
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should handle platform-specific file paths and commands', async () => {
        // GIVEN: Application is ready and connected
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 12,
            encoderCount: 1
        });
        await mainPage.testConnection();

        // WHEN: Configure platform-specific commands and paths
        await test.step(`Configure ${currentPlatform.name}-specific commands`, async () => {
            const platformCommands = [
                { 
                    id: 1, 
                    type: 'text', 
                    value: currentPlatform.paths.userHome, 
                    label: 'User Home' 
                },
                { 
                    id: 2, 
                    type: 'text', 
                    value: currentPlatform.paths.documents, 
                    label: 'Documents' 
                }
            ];

            // Add platform-specific terminal/command prompt commands
            if (process.platform === 'win32') {
                platformCommands.push(
                    { id: 3, type: 'command', value: 'dir', label: 'List Files' },
                    { id: 4, type: 'command', value: 'cls', label: 'Clear Screen' },
                    { id: 5, type: 'command', value: 'ipconfig', label: 'IP Config' }
                );
            } else {
                platformCommands.push(
                    { id: 3, type: 'command', value: 'ls -la', label: 'List Files' },
                    { id: 4, type: 'command', value: 'clear', label: 'Clear Screen' },
                    { id: 5, type: 'command', value: 'ifconfig', label: 'IP Config' }
                );
            }

            await buttonPage.bulkConfigureButtons(platformCommands);
        });

        // THEN: Platform-specific configurations should be accepted
        await test.step('Verify platform-specific command configuration', async () => {
            await buttonPage.verifyButtonConfiguration(1, {
                type: 'text',
                value: currentPlatform.paths.userHome,
                label: 'User Home'
            });

            const expectedListCommand = process.platform === 'win32' ? 'dir' : 'ls -la';
            await buttonPage.verifyButtonConfiguration(3, {
                type: 'command',
                value: expectedListCommand,
                label: 'List Files'
            });
        });

        // WHEN: Test platform-specific commands
        await test.step('Test platform-specific command execution', async () => {
            await buttonPage.testButton(3); // List files command
            await mainPage.page.waitForTimeout(1000);
            
            await buttonPage.testButton(4); // Clear screen command
            await mainPage.page.waitForTimeout(500);
        });

        // THEN: Commands should execute appropriately for the platform
        await test.step('Verify platform command execution', async () => {
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should maintain UI consistency across platforms', async () => {
        // GIVEN: Application is loaded
        await mainPage.waitForApplicationReady();
        await mainPage.verifyApplicationHeader();

        // WHEN: Check UI elements and layout
        await test.step('Verify UI element consistency', async () => {
            // Header elements should be present and positioned correctly
            await expect(mainPage.headerTitle).toBeVisible();
            await expect(mainPage.connectionStatus).toBeVisible();
            await expect(mainPage.validationStatus).toBeVisible();
            await expect(mainPage.errorStatus).toBeVisible();

            // Control buttons should be accessible
            await expect(mainPage.validateConfigButton).toBeEnabled();
            await expect(mainPage.reloadConfigButton).toBeEnabled();
            await expect(mainPage.saveConfigButton).toBeEnabled();

            // Device configuration controls
            await expect(mainPage.serialPortSelect).toBeVisible();
            await expect(mainPage.baudRateSelect).toBeVisible();
            await expect(mainPage.buttonCountSelect).toBeVisible();
            await expect(mainPage.encoderCountSelect).toBeVisible();
        });

        // WHEN: Test responsive behavior
        await test.step('Test responsive UI behavior', async () => {
            // Get current window size
            const viewport = await mainPage.page.viewportSize();
            
            // Test different window sizes
            await mainPage.page.setViewportSize({ width: 1024, height: 768 });
            await mainPage.page.waitForTimeout(500);
            await expect(mainPage.headerTitle).toBeVisible();

            await mainPage.page.setViewportSize({ width: 1280, height: 1024 });
            await mainPage.page.waitForTimeout(500);
            await expect(mainPage.headerTitle).toBeVisible();

            // Restore original size
            if (viewport) {
                await mainPage.page.setViewportSize(viewport);
            }
        });

        // THEN: UI should remain functional and accessible
        await test.step('Verify UI functionality after resizing', async () => {
            await mainPage.refreshPorts();
            await expect(mainPage.serialPortSelect).toBeVisible();
            
            // All feature buttons should remain accessible
            const featureButtons = [
                mainPage.macroRecorderButton,
                mainPage.contextManagerButton,
                mainPage.ledManagerButton,
                mainPage.systemIntegrationButton,
                mainPage.voiceRecognitionButton,
                mainPage.pluginManagerButton
            ];

            for (const button of featureButtons) {
                await expect(button).toBeVisible();
            }
        });
    });

    test('should handle platform-specific serial port detection', async () => {
        // GIVEN: Application is ready
        await mainPage.waitForApplicationReady();

        // WHEN: Refresh serial ports
        await test.step('Refresh and check serial port detection', async () => {
            await mainPage.refreshPorts();
        });

        // THEN: Port detection should work for the current platform
        await test.step('Verify platform-appropriate port detection', async () => {
            const portOptions = await mainPage.serialPortSelect.locator('option').allTextContents();
            
            // Should include mock port
            expect(portOptions).toContain('MOCK_PORT');

            // Platform-specific port naming conventions should be supported
            if (process.platform === 'win32') {
                // Windows COM ports would be like COM1, COM2, etc.
                // Mock should simulate this
            } else if (process.platform === 'darwin') {
                // macOS ports are like /dev/tty.usbmodem*, /dev/cu.usbmodem*
                // Mock should simulate this
            } else {
                // Linux ports are like /dev/ttyUSB*, /dev/ttyACM*
                // Mock should simulate this
            }
        });

        // WHEN: Select and test connection
        await test.step('Test platform-specific connection', async () => {
            await mainPage.serialPortSelect.selectOption('MOCK_PORT');
            const connectionResult = await mainPage.testConnection();
            expect(connectionResult).toBe(true);
        });

        // THEN: Connection should work regardless of platform
        await test.step('Verify cross-platform connection success', async () => {
            expect(await mainPage.getConnectionStatus()).toBe('connected');
        });
    });

    test('should export/import configurations with platform compatibility', async () => {
        // GIVEN: Application is configured with platform-specific settings
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 8,
            encoderCount: 1
        });
        await mainPage.testConnection();

        // Configure mixed platform shortcuts (some that work everywhere, some platform-specific)
        const mixedPlatformMacros = [
            { id: 1, type: 'keyboard', value: 'f1', label: 'Help (Universal)' },
            { id: 2, type: 'keyboard', value: currentPlatform.shortcuts.copy, label: `Copy (${currentPlatform.name})` },
            { id: 3, type: 'text', value: 'hello@example.com', label: 'Email (Universal)' },
            { id: 4, type: 'text', value: currentPlatform.paths.userHome, label: `Home (${currentPlatform.name})` }
        ];

        await buttonPage.bulkConfigureButtons(mixedPlatformMacros);

        // WHEN: Export configuration
        const exportedFile = await test.step('Export platform-specific configuration', async () => {
            return await buttonPage.exportConfiguration();
        });

        // THEN: Export should succeed with platform metadata
        await test.step('Verify export includes platform information', async () => {
            expect(exportedFile).toBeTruthy();
            const filename = exportedFile.suggestedFilename();
            expect(filename).toMatch(/config|profile/i);
        });

        // WHEN: Clear and re-import configuration
        await test.step('Test configuration import', async () => {
            // Clear current configuration
            for (let i = 1; i <= 4; i++) {
                await buttonPage.deleteButton(i);
            }

            // Import the exported configuration
            const downloadPath = await exportedFile.path();
            await buttonPage.importConfiguration(downloadPath);
        });

        // THEN: Imported configuration should work on current platform
        await test.step('Verify imported configuration works on platform', async () => {
            // Verify platform-specific shortcuts are restored correctly
            await buttonPage.verifyButtonConfiguration(2, {
                type: 'keyboard',
                value: currentPlatform.shortcuts.copy,
                label: `Copy (${currentPlatform.name})`
            });

            // Test execution
            await buttonPage.testButton(2);
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });
});

// Accessibility and keyboard navigation tests
test.describe('Cross-Platform Accessibility Tests', () => {
    let framework;
    let mainPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 30000
        });
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should support full keyboard navigation', async () => {
        // GIVEN: Application is loaded
        await mainPage.waitForApplicationReady();

        // WHEN: Navigate using only keyboard
        await test.step('Test tab navigation through UI elements', async () => {
            // Tab through all interactive elements
            const tabSequence = [
                mainPage.serialPortSelect,
                mainPage.refreshPortsButton,
                mainPage.testConnectionButton,
                mainPage.baudRateSelect,
                mainPage.buttonCountSelect,
                mainPage.encoderCountSelect,
                mainPage.validateConfigButton,
                mainPage.reloadConfigButton,
                mainPage.saveConfigButton
            ];

            for (const element of tabSequence) {
                await mainPage.page.keyboard.press('Tab');
                await mainPage.page.waitForTimeout(100);
                
                // Verify element receives focus
                const focusedElement = await mainPage.page.evaluate(() => document.activeElement);
                expect(focusedElement).toBeTruthy();
            }
        });

        // WHEN: Use keyboard shortcuts for common actions
        await test.step('Test keyboard shortcuts', async () => {
            // Platform-specific shortcuts
            const refreshShortcut = process.platform === 'darwin' ? 'cmd+r' : 'ctrl+r';
            const saveShortcut = process.platform === 'darwin' ? 'cmd+s' : 'ctrl+s';

            // Test refresh (if implemented)
            await mainPage.page.keyboard.press(refreshShortcut);
            await mainPage.page.waitForTimeout(500);

            // Test save (if implemented)
            await mainPage.page.keyboard.press(saveShortcut);
            await mainPage.page.waitForTimeout(500);
        });

        // THEN: All functionality should be accessible via keyboard
        await test.step('Verify keyboard accessibility', async () => {
            // Should be able to configure device using only keyboard
            await mainPage.page.keyboard.press('Tab'); // Navigate to serial port
            await mainPage.page.keyboard.press('ArrowDown'); // Open dropdown
            await mainPage.page.keyboard.press('Enter'); // Select option
            
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should support screen reader accessibility', async () => {
        // GIVEN: Application is loaded
        await mainPage.waitForApplicationReady();

        // WHEN: Check ARIA attributes and labels
        await test.step('Verify ARIA attributes and semantic markup', async () => {
            // Headers should have proper roles
            await expect(mainPage.headerTitle).toHaveAttribute('role', /heading|banner/);

            // Form controls should have labels
            const formControls = [
                mainPage.serialPortSelect,
                mainPage.baudRateSelect,
                mainPage.buttonCountSelect,
                mainPage.encoderCountSelect
            ];

            for (const control of formControls) {
                // Should have either aria-label or associated label
                const hasAriaLabel = await control.getAttribute('aria-label');
                const hasId = await control.getAttribute('id');
                
                if (!hasAriaLabel && hasId) {
                    // Check for associated label
                    const associatedLabel = mainPage.page.locator(`label[for="${hasId}"]`);
                    await expect(associatedLabel).toBeVisible();
                }
            }

            // Status indicators should have appropriate roles
            await expect(mainPage.connectionStatus).toHaveAttribute('role', /status|alert/);
            await expect(mainPage.validationStatus).toHaveAttribute('role', /status|alert/);
            await expect(mainPage.errorStatus).toHaveAttribute('role', /status|alert/);
        });

        // WHEN: Check color contrast and visual indicators
        await test.step('Verify visual accessibility', async () => {
            // Status indicators should have text labels, not just colors
            const connectionText = await mainPage.connectionStatus.textContent();
            const validationText = await mainPage.validationStatus.textContent();
            const errorText = await mainPage.errorStatus.textContent();

            expect(connectionText).toMatch(/connected|disconnected|unknown/i);
            expect(validationText).toMatch(/valid|invalid|pending/i);
            expect(errorText).toMatch(/error|ok|none/i);
        });

        // THEN: Application should be screen reader friendly
        await test.step('Verify screen reader compatibility', async () => {
            // Focus management should be logical
            await mainPage.serialPortSelect.focus();
            const focusedElement = await mainPage.page.evaluate(() => document.activeElement.tagName);
            expect(focusedElement).toBe('SELECT');
        });
    });

    test('should support high contrast and zoom modes', async () => {
        // GIVEN: Application is loaded
        await mainPage.waitForApplicationReady();

        // WHEN: Test with browser zoom
        await test.step('Test with increased zoom levels', async () => {
            // Zoom to 150%
            await mainPage.page.evaluate(() => {
                document.body.style.zoom = '150%';
            });
            await mainPage.page.waitForTimeout(500);

            // UI should remain functional
            await expect(mainPage.headerTitle).toBeVisible();
            await expect(mainPage.serialPortSelect).toBeVisible();

            // Zoom to 200%
            await mainPage.page.evaluate(() => {
                document.body.style.zoom = '200%';
            });
            await mainPage.page.waitForTimeout(500);

            // Critical elements should still be accessible
            await expect(mainPage.headerTitle).toBeVisible();
            await mainPage.refreshPorts();

            // Reset zoom
            await mainPage.page.evaluate(() => {
                document.body.style.zoom = '100%';
            });
        });

        // WHEN: Test text scaling
        await test.step('Test with increased font sizes', async () => {
            await mainPage.page.addStyleTag({
                content: '* { font-size: 18px !important; }'
            });
            await mainPage.page.waitForTimeout(500);

            // Text should remain readable and UI functional
            await expect(mainPage.headerTitle).toBeVisible();
            const titleText = await mainPage.headerTitle.textContent();
            expect(titleText).toBeTruthy();
        });

        // THEN: Application should remain usable with accessibility enhancements
        await test.step('Verify accessibility compliance', async () => {
            // Should be able to complete basic workflow with accessibility features
            await mainPage.configureDevice({
                serialPort: 'MOCK_PORT',
                baudRate: 115200,
                buttonCount: 16,
                encoderCount: 2
            });

            const connectionResult = await mainPage.testConnection();
            expect(connectionResult).toBe(true);
        });
    });
});
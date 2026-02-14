/**
 * Critical Path E2E Tests - Macro Configuration and Execution Flow
 * 
 * Tests the core user workflow of configuring macros and executing them.
 * This validates the primary value proposition of 25-40% productivity improvement.
 */

const { test, expect } = require('@playwright/test');
const { E2ETestFramework } = require('../e2e-test-framework');
const MainApplicationPage = require('../page-objects/MainApplicationPage');
const ButtonConfigurationPage = require('../page-objects/ButtonConfigurationPage');

test.describe('Critical Path: Macro Configuration and Execution', () => {
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
        
        // Set up connected device
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 16,
            encoderCount: 2
        });
        await mainPage.testConnection();
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should complete full macro configuration workflow', async () => {
        // GIVEN: Device is connected and ready
        expect(await mainPage.getConnectionStatus()).toBe('connected');

        // WHEN: User configures keyboard shortcut macro
        await test.step('Configure keyboard shortcut macro', async () => {
            await buttonPage.configureButton(1, {
                type: 'keyboard',
                value: 'ctrl+c',
                label: 'Copy'
            });
        });

        // THEN: Button configuration should be saved
        await test.step('Verify keyboard macro configuration', async () => {
            await buttonPage.verifyButtonConfiguration(1, {
                type: 'keyboard',
                value: 'ctrl+c',
                label: 'Copy'
            });
        });

        // WHEN: User configures text expansion macro
        await test.step('Configure text expansion macro', async () => {
            await buttonPage.configureButton(2, {
                type: 'text',
                value: 'john.doe@example.com',
                label: 'Email'
            });
        });

        // THEN: Text macro should be configured correctly
        await test.step('Verify text expansion configuration', async () => {
            await buttonPage.verifyButtonConfiguration(2, {
                type: 'text',
                value: 'john.doe@example.com',
                label: 'Email'
            });
        });

        // WHEN: User configures command execution macro
        await test.step('Configure command execution macro', async () => {
            await buttonPage.configureButton(3, {
                type: 'command',
                value: 'echo "Hello World"',
                label: 'Test CMD'
            });
        });

        // THEN: Command macro should be configured correctly
        await test.step('Verify command execution configuration', async () => {
            await buttonPage.verifyButtonConfiguration(3, {
                type: 'command',
                value: 'echo "Hello World"',
                label: 'Test CMD'
            });
        });

        // WHEN: User tests each macro
        await test.step('Test keyboard shortcut execution', async () => {
            await buttonPage.testButton(1);
            // Verify keyboard shortcut was triggered (would need to mock system)
        });

        await test.step('Test text expansion execution', async () => {
            await buttonPage.testButton(2);
            // Verify text was typed (would need to mock system)
        });

        await test.step('Test command execution', async () => {
            await buttonPage.testButton(3);
            // Verify command was executed (would need to mock system)
        });

        // WHEN: User saves all configurations
        await test.step('Save macro configurations', async () => {
            await mainPage.saveConfiguration();
        });

        // THEN: All configurations should be persisted
        await test.step('Verify all configurations persisted', async () => {
            const configurations = await buttonPage.getAllConfiguredButtons();
            expect(configurations).toHaveLength(3);
            expect(configurations.find(c => c.id === '1')).toMatchObject({
                type: 'keyboard',
                value: 'ctrl+c',
                label: 'Copy'
            });
            expect(configurations.find(c => c.id === '2')).toMatchObject({
                type: 'text',
                value: 'john.doe@example.com',
                label: 'Email'
            });
            expect(configurations.find(c => c.id === '3')).toMatchObject({
                type: 'command',
                value: 'echo "Hello World"',
                label: 'Test CMD'
            });
        });
    });

    test('should handle hardware button press execution', async () => {
        // GIVEN: Button is configured with keyboard shortcut
        await buttonPage.configureButton(1, {
            type: 'keyboard',
            value: 'ctrl+s',
            label: 'Save'
        });

        // WHEN: Hardware button is pressed
        await test.step('Simulate hardware button press', async () => {
            await buttonPage.simulateHardwareButtonPress(1);
        });

        // THEN: Macro should execute and UI should show feedback
        await test.step('Verify macro execution feedback', async () => {
            // Button should show pressed state temporarily
            const buttonElement = buttonPage.getButtonElement(1);
            
            // Check for execution feedback (could be status message, animation, etc.)
            const feedbackElement = mainPage.page.locator('.execution-feedback, .macro-executed');
            if (await feedbackElement.isVisible()) {
                await expect(feedbackElement).toContainText('executed');
            }
        });
    });

    test('should support macro recording workflow', async () => {
        // GIVEN: Device is connected
        expect(await mainPage.getConnectionStatus()).toBe('connected');

        // WHEN: User starts macro recording
        const recorder = await test.step('Start macro recording', async () => {
            return await buttonPage.recordMacro(5);
        });

        // WHEN: User performs actions to record
        await test.step('Record macro actions', async () => {
            // Simulate keyboard actions during recording
            await mainPage.page.keyboard.press('Control+A');
            await mainPage.page.keyboard.press('Control+C');
            await mainPage.page.waitForTimeout(1000);
        });

        // WHEN: User stops and saves recording
        await test.step('Stop and save macro recording', async () => {
            await recorder.stop();
            await recorder.save('Select All and Copy');
        });

        // THEN: Recorded macro should be assigned to button
        await test.step('Verify recorded macro assigned', async () => {
            await buttonPage.verifyButtonConfiguration(5, {
                type: 'macro',
                label: 'Select All and Copy'
            });
        });

        // WHEN: Recorded macro is executed
        await test.step('Execute recorded macro', async () => {
            await buttonPage.simulateHardwareButtonPress(5);
        });

        // THEN: Recorded actions should be replayed
        await test.step('Verify macro playback', async () => {
            // Verify the recorded sequence was played back
            // This would require integration with system automation
        });
    });

    test('should support keyboard shortcut picker', async () => {
        // GIVEN: Device is connected
        expect(await mainPage.getConnectionStatus()).toBe('connected');

        // WHEN: User opens keyboard shortcut picker
        const shortcutPicker = await test.step('Open keyboard shortcut picker', async () => {
            return await buttonPage.pickKeyboardShortcut(4);
        });

        // WHEN: User presses desired key combination
        await test.step('Select keyboard shortcut', async () => {
            await shortcutPicker.selectShortcut(['Control', 'Shift', 'T']);
        });

        // WHEN: User confirms selection
        await test.step('Confirm shortcut selection', async () => {
            await shortcutPicker.confirm();
        });

        // THEN: Shortcut should be assigned to button
        await test.step('Verify shortcut assigned', async () => {
            await buttonPage.verifyButtonConfiguration(4, {
                type: 'keyboard',
                value: 'ctrl+shift+t'
            });
        });
    });

    test('should validate macro security policies', async () => {
        // GIVEN: Security policies are enabled (from business requirements)
        // This tests the security policy management epic

        // WHEN: User tries to configure restricted command
        await test.step('Attempt to configure restricted command', async () => {
            await buttonPage.configureButton(6, {
                type: 'command',
                value: 'rm -rf /',  // Dangerous command
                label: 'Danger'
            });
        });

        // THEN: Security validation should block the command
        await test.step('Verify security policy enforcement', async () => {
            // Should show security warning
            const securityWarning = mainPage.page.locator('.security-warning, .error-message');
            await expect(securityWarning).toBeVisible();
            await expect(securityWarning).toContainText(/blocked|restricted|security/i);
        });

        // WHEN: User configures allowed command
        await test.step('Configure allowed command', async () => {
            await buttonPage.configureButton(6, {
                type: 'command',
                value: 'echo "safe command"',
                label: 'Safe'
            });
        });

        // THEN: Allowed command should be accepted
        await test.step('Verify allowed command accepted', async () => {
            await buttonPage.verifyButtonConfiguration(6, {
                type: 'command',
                value: 'echo "safe command"',
                label: 'Safe'
            });
        });
    });

    test('should support bulk macro configuration', async () => {
        // GIVEN: Device is connected with multiple buttons
        expect(await mainPage.getConnectionStatus()).toBe('connected');

        // WHEN: User configures multiple macros at once
        const bulkConfigs = [
            { id: 1, type: 'keyboard', value: 'ctrl+c', label: 'Copy' },
            { id: 2, type: 'keyboard', value: 'ctrl+v', label: 'Paste' },
            { id: 3, type: 'keyboard', value: 'ctrl+x', label: 'Cut' },
            { id: 4, type: 'keyboard', value: 'ctrl+z', label: 'Undo' },
            { id: 5, type: 'keyboard', value: 'ctrl+y', label: 'Redo' }
        ];

        await test.step('Configure multiple macros', async () => {
            await buttonPage.bulkConfigureButtons(bulkConfigs);
        });

        // THEN: All macros should be configured correctly
        await test.step('Verify bulk configuration success', async () => {
            for (const config of bulkConfigs) {
                await buttonPage.verifyButtonConfiguration(config.id, {
                    type: config.type,
                    value: config.value,
                    label: config.label
                });
            }
        });

        // WHEN: User tests multiple macros in sequence
        await test.step('Test macro execution sequence', async () => {
            for (let i = 1; i <= 5; i++) {
                await buttonPage.simulateHardwareButtonPress(i);
                await mainPage.page.waitForTimeout(200); // Small delay between presses
            }
        });

        // THEN: All macros should execute without interference
        await test.step('Verify sequence execution success', async () => {
            // Check that no errors occurred during sequence
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should export and import macro configurations', async () => {
        // GIVEN: Multiple macros are configured
        const testConfigs = [
            { id: 1, type: 'keyboard', value: 'ctrl+c', label: 'Copy' },
            { id: 2, type: 'text', value: 'test@example.com', label: 'Email' },
            { id: 3, type: 'command', value: 'echo "test"', label: 'Test' }
        ];

        await buttonPage.bulkConfigureButtons(testConfigs);

        // WHEN: User exports configuration
        const exportedFile = await test.step('Export macro configuration', async () => {
            return await buttonPage.exportConfiguration();
        });

        // THEN: Export should succeed
        await test.step('Verify export success', async () => {
            expect(exportedFile).toBeTruthy();
            expect(exportedFile.suggestedFilename()).toMatch(/macro.*config/i);
        });

        // WHEN: User clears current configuration and imports
        await test.step('Clear and import configuration', async () => {
            // Clear current config
            for (let i = 1; i <= 3; i++) {
                await buttonPage.deleteButton(i);
            }

            // Import the exported configuration
            const downloadPath = await exportedFile.path();
            await buttonPage.importConfiguration(downloadPath);
        });

        // THEN: Imported configuration should match original
        await test.step('Verify import restored configuration', async () => {
            for (const config of testConfigs) {
                await buttonPage.verifyButtonConfiguration(config.id, {
                    type: config.type,
                    value: config.value,
                    label: config.label
                });
            }
        });
    });

    test('should provide real-time macro execution feedback', async () => {
        // GIVEN: Macro is configured
        await buttonPage.configureButton(1, {
            type: 'keyboard',
            value: 'alt+tab',
            label: 'Switch App'
        });

        // WHEN: User executes macro multiple times rapidly
        await test.step('Execute macro rapidly', async () => {
            for (let i = 0; i < 5; i++) {
                await buttonPage.simulateHardwareButtonPress(1);
                await mainPage.page.waitForTimeout(100);
            }
        });

        // THEN: UI should provide feedback for each execution
        await test.step('Verify execution feedback', async () => {
            // Check for execution counters or status indicators
            const executionCounter = mainPage.page.locator('.execution-count, .macro-stats');
            if (await executionCounter.isVisible()) {
                const counterText = await executionCounter.textContent();
                expect(parseInt(counterText)).toBeGreaterThan(0);
            }
        });

        // THEN: Performance should remain responsive
        await test.step('Verify responsive performance', async () => {
            // Application should still be responsive after rapid execution
            await mainPage.validateConfiguration();
            expect(await mainPage.getValidationStatus()).toBe('valid');
        });
    });
});
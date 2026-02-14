/**
 * Critical Path E2E Tests - Device Setup and Connection Flow
 * 
 * Tests the fundamental user workflow of setting up and connecting to hardware device.
 * This is the most critical path as it must work for any user to use the application.
 */

const { test, expect } = require('@playwright/test');
const { E2ETestFramework } = require('../e2e-test-framework');
const MainApplicationPage = require('../page-objects/MainApplicationPage');

test.describe('Critical Path: Device Setup and Connection', () => {
    let framework;
    let mainPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 30000
        });
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        await mainPage.waitForApplicationReady();
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should complete full device setup workflow', async () => {
        // GIVEN: Application is loaded and ready
        await mainPage.verifyApplicationHeader();

        // WHEN: User configures device settings
        await test.step('Configure device settings', async () => {
            await mainPage.configureDevice({
                serialPort: 'MOCK_PORT',
                baudRate: 115200,
                buttonCount: 16,
                encoderCount: 2
            });
        });

        // THEN: Configuration should be applied
        await test.step('Verify configuration applied', async () => {
            expect(await mainPage.serialPortSelect.inputValue()).toBe('MOCK_PORT');
            expect(await mainPage.baudRateSelect.inputValue()).toBe('115200');
            expect(await mainPage.buttonCountSelect.inputValue()).toBe('16');
            expect(await mainPage.encoderCountSelect.inputValue()).toBe('2');
        });

        // WHEN: User tests connection
        const connectionSuccess = await test.step('Test hardware connection', async () => {
            return await mainPage.testConnection();
        });

        // THEN: Connection should be successful
        await test.step('Verify successful connection', async () => {
            expect(connectionSuccess).toBe(true);
            expect(await mainPage.getConnectionStatus()).toBe('connected');
        });

        // WHEN: User validates configuration
        const validationSuccess = await test.step('Validate configuration', async () => {
            return await mainPage.validateConfiguration();
        });

        // THEN: Configuration should be valid
        await test.step('Verify valid configuration', async () => {
            expect(validationSuccess).toBe(true);
            expect(await mainPage.getValidationStatus()).toBe('valid');
        });

        // WHEN: User saves configuration
        await test.step('Save configuration', async () => {
            await mainPage.saveConfiguration();
        });

        // THEN: No errors should be present
        await test.step('Verify no errors after save', async () => {
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should handle connection failure gracefully', async () => {
        // GIVEN: Application is ready with invalid port
        await mainPage.waitForApplicationReady();

        // WHEN: User tries to connect to invalid port
        await test.step('Configure invalid port', async () => {
            await mainPage.configureDevice({
                serialPort: 'INVALID_PORT',
                baudRate: 115200,
                buttonCount: 16,
                encoderCount: 2
            });
        });

        // WHEN: User tests connection
        const connectionResult = await test.step('Test invalid connection', async () => {
            return await mainPage.testConnection();
        });

        // THEN: Connection should fail with clear error
        await test.step('Verify connection failure handled', async () => {
            expect(connectionResult).toBe(false);
            expect(await mainPage.getConnectionStatus()).toBe('disconnected');
            
            // Error status should indicate the issue
            const errorStatus = await mainPage.getErrorStatus();
            expect(errorStatus).toBe('has-errors');
        });

        // WHEN: User corrects the port and retries
        await test.step('Correct port configuration', async () => {
            await mainPage.configureDevice({ serialPort: 'MOCK_PORT' });
        });

        const retryConnection = await test.step('Retry connection with valid port', async () => {
            return await mainPage.testConnection();
        });

        // THEN: Connection should now succeed
        await test.step('Verify recovery after correction', async () => {
            expect(retryConnection).toBe(true);
            expect(await mainPage.getConnectionStatus()).toBe('connected');
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });

    test('should refresh and detect available serial ports', async () => {
        // GIVEN: Application is ready
        await mainPage.waitForApplicationReady();

        // WHEN: User refreshes port list
        await test.step('Refresh serial ports', async () => {
            await mainPage.refreshPorts();
        });

        // THEN: Mock port should be available in dropdown
        await test.step('Verify mock port is available', async () => {
            const portOptions = await mainPage.serialPortSelect.locator('option').allTextContents();
            expect(portOptions).toContain('MOCK_PORT');
        });

        // WHEN: User selects the mock port
        await test.step('Select mock port', async () => {
            await mainPage.serialPortSelect.selectOption('MOCK_PORT');
        });

        // THEN: Port details should be displayed
        await test.step('Verify port details shown', async () => {
            await mainPage.verifyPortDetails({
                manufacturer: 'Arduino',
                productId: '0043',
                vendorId: '2341'
            });
        });
    });

    test('should validate configuration before saving', async () => {
        // GIVEN: Application is ready with device configured
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 16,
            encoderCount: 2
        });

        // WHEN: User validates configuration before connecting
        const validationResult = await test.step('Validate before connection', async () => {
            return await mainPage.validateConfiguration();
        });

        // THEN: Validation should indicate connection needed
        await test.step('Verify validation requires connection', async () => {
            const validationStatus = await mainPage.getValidationStatus();
            expect(validationStatus).toBeOneOf(['pending', 'invalid']);
        });

        // WHEN: User establishes connection and re-validates
        await test.step('Connect and re-validate', async () => {
            await mainPage.testConnection();
            return await mainPage.validateConfiguration();
        });

        // THEN: Configuration should now be fully valid
        await test.step('Verify complete validation success', async () => {
            expect(await mainPage.getValidationStatus()).toBe('valid');
        });
    });

    test('should maintain configuration across app restart', async () => {
        // GIVEN: Application is configured and connected
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 16,
            encoderCount: 2
        });
        await mainPage.testConnection();
        await mainPage.saveConfiguration();

        // WHEN: Application is restarted
        await test.step('Restart application', async () => {
            await framework.cleanup();
            framework = new E2ETestFramework({ screenshotOnFailure: true });
            await framework.initialize();
            mainPage = new MainApplicationPage(framework);
            await mainPage.waitForApplicationReady();
        });

        // THEN: Previous configuration should be restored
        await test.step('Verify configuration persisted', async () => {
            expect(await mainPage.serialPortSelect.inputValue()).toBe('MOCK_PORT');
            expect(await mainPage.baudRateSelect.inputValue()).toBe('115200');
            expect(await mainPage.buttonCountSelect.inputValue()).toBe('16');
            expect(await mainPage.encoderCountSelect.inputValue()).toBe('2');
        });

        // WHEN: User tests connection with restored config
        const connectionResult = await test.step('Test connection after restart', async () => {
            return await mainPage.testConnection();
        });

        // THEN: Connection should work immediately
        await test.step('Verify connection works with persisted config', async () => {
            expect(connectionResult).toBe(true);
            expect(await mainPage.getConnectionStatus()).toBe('connected');
        });
    });

    test('should handle different hardware configurations', async () => {
        const hardwareConfigs = [
            { buttons: 8, encoders: 0 },
            { buttons: 12, encoders: 1 },
            { buttons: 16, encoders: 2 },
            { buttons: 24, encoders: 4 },
            { buttons: 32, encoders: 8 }
        ];

        for (const config of hardwareConfigs) {
            await test.step(`Test configuration: ${config.buttons} buttons, ${config.encoders} encoders`, async () => {
                // Configure hardware
                await mainPage.configureDevice({
                    serialPort: 'MOCK_PORT',
                    baudRate: 115200,
                    buttonCount: config.buttons,
                    encoderCount: config.encoders
                });

                // Test connection
                const connectionResult = await mainPage.testConnection();
                expect(connectionResult).toBe(true);

                // Validate configuration
                const validationResult = await mainPage.validateConfiguration();
                expect(validationResult).toBe(true);
            });
        }
    });
});

test.describe('Critical Path: First-Time User Onboarding', () => {
    let framework;
    let mainPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 30000
        });
        
        // Simulate first-time user by clearing any existing config
        process.env.SIMULATE_FIRST_TIME_USER = 'true';
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
    });

    test.afterEach(async () => {
        delete process.env.SIMULATE_FIRST_TIME_USER;
        await framework.cleanup();
    });

    test('should guide new user through complete setup process', async () => {
        // GIVEN: First-time user opens application
        await test.step('Wait for onboarding to start', async () => {
            // Check if onboarding wizard appears
            const onboardingWizard = mainPage.page.locator('.onboarding-wizard');
            if (await onboardingWizard.isVisible()) {
                // If onboarding exists, complete it
                await test.step('Complete onboarding wizard', async () => {
                    // Step 1: Welcome
                    await expect(onboardingWizard.locator('.step-welcome')).toBeVisible();
                    await onboardingWizard.locator('#next-step').click();

                    // Step 2: Hardware Connection
                    await expect(onboardingWizard.locator('.step-hardware')).toBeVisible();
                    await onboardingWizard.locator('#serial-port').selectOption('MOCK_PORT');
                    await onboardingWizard.locator('#next-step').click();

                    // Step 3: Configuration
                    await expect(onboardingWizard.locator('.step-config')).toBeVisible();
                    await onboardingWizard.locator('#button-count').selectOption('16');
                    await onboardingWizard.locator('#encoder-count').selectOption('2');
                    await onboardingWizard.locator('#next-step').click();

                    // Step 4: Test Connection
                    await expect(onboardingWizard.locator('.step-test')).toBeVisible();
                    await onboardingWizard.locator('#test-connection').click();
                    await onboardingWizard.locator('#finish-setup').click();
                });
            }
        });

        // WHEN: Onboarding completes
        await test.step('Verify main application is ready', async () => {
            await mainPage.waitForApplicationReady();
            await mainPage.verifyApplicationHeader();
        });

        // THEN: User should have functional configuration
        await test.step('Verify working configuration after onboarding', async () => {
            expect(await mainPage.getConnectionStatus()).toBe('connected');
            expect(await mainPage.getValidationStatus()).toBe('valid');
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // WHEN: User performs first macro configuration
        await test.step('Guide user through first macro', async () => {
            // This would typically be part of the onboarding or help system
            const helpBubble = mainPage.page.locator('.help-bubble, .tutorial-tip');
            if (await helpBubble.isVisible()) {
                await helpBubble.locator('.got-it, .next').click();
            }
        });

        // THEN: User should achieve 90%+ completion rate (target from business analysis)
        await test.step('Verify onboarding completion criteria met', async () => {
            // Check all critical setup elements are configured
            expect(await mainPage.serialPortSelect.inputValue()).toBeTruthy();
            expect(await mainPage.buttonCountSelect.inputValue()).toBeTruthy();
            expect(await mainPage.getConnectionStatus()).toBe('connected');
            
            // User should be able to proceed to button configuration
            await mainPage.openFeature('macro-recorder');
            const modalVisible = await mainPage.page.locator('.modal, .dialog').isVisible();
            expect(modalVisible).toBe(true);
        });
    });
});
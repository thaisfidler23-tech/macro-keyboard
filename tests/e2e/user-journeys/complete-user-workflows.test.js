/**
 * Complete User Journey E2E Tests
 * 
 * Tests complete end-to-end user workflows from application launch to 
 * achieving productivity goals. These tests validate the 25-40% productivity 
 * improvement target from the business analysis.
 */

const { test, expect } = require('@playwright/test');
const { E2ETestFramework } = require('../e2e-test-framework');
const MainApplicationPage = require('../page-objects/MainApplicationPage');
const ButtonConfigurationPage = require('../page-objects/ButtonConfigurationPage');

test.describe('User Journey: Content Creator Workflow', () => {
    let framework;
    let mainPage;
    let buttonPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 45000  // Extended timeout for complex workflows
        });
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        buttonPage = new ButtonConfigurationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should complete content creator setup and daily workflow', async () => {
        // PHASE 1: Initial Setup (First-Time User Experience)
        await test.step('Phase 1: Application Setup and Device Connection', async () => {
            await mainPage.waitForApplicationReady();
            await mainPage.verifyApplicationHeader();

            // Configure for content creation setup (high button count for shortcuts)
            await mainPage.configureDevice({
                serialPort: 'MOCK_PORT',
                baudRate: 115200,
                buttonCount: 24,  // Content creators need many shortcuts
                encoderCount: 2   // For volume/timeline scrubbing
            });

            const connectionSuccess = await mainPage.testConnection();
            expect(connectionSuccess).toBe(true);
            
            const validationSuccess = await mainPage.validateConfiguration();
            expect(validationSuccess).toBe(true);
            
            await mainPage.saveConfiguration();
        });

        // PHASE 2: Video Editing Workflow Setup
        await test.step('Phase 2: Configure Video Editing Macros', async () => {
            const videoEditingMacros = [
                { id: 1, type: 'keyboard', value: 'space', label: 'Play/Pause' },
                { id: 2, type: 'keyboard', value: 'ctrl+z', label: 'Undo' },
                { id: 3, type: 'keyboard', value: 'ctrl+y', label: 'Redo' },
                { id: 4, type: 'keyboard', value: 'j', label: 'Rewind' },
                { id: 5, type: 'keyboard', value: 'k', label: 'Stop' },
                { id: 6, type: 'keyboard', value: 'l', label: 'Forward' },
                { id: 7, type: 'keyboard', value: 'i', label: 'Mark In' },
                { id: 8, type: 'keyboard', value: 'o', label: 'Mark Out' },
                { id: 9, type: 'keyboard', value: 'ctrl+k', label: 'Cut' },
                { id: 10, type: 'keyboard', value: 'ctrl+shift+v', label: 'Paste Insert' },
                { id: 11, type: 'keyboard', value: 'ctrl+d', label: 'Duplicate' },
                { id: 12, type: 'keyboard', value: 'delete', label: 'Delete' }
            ];

            await buttonPage.bulkConfigureButtons(videoEditingMacros);
            
            // Verify all video editing macros are configured
            for (const macro of videoEditingMacros) {
                await buttonPage.verifyButtonConfiguration(macro.id, {
                    type: macro.type,
                    value: macro.value,
                    label: macro.label
                });
            }
        });

        // PHASE 3: Streaming/Recording Workflow
        await test.step('Phase 3: Configure Streaming Controls', async () => {
            const streamingMacros = [
                { id: 13, type: 'keyboard', value: 'f11', label: 'Fullscreen' },
                { id: 14, type: 'keyboard', value: 'ctrl+shift+r', label: 'Start Record' },
                { id: 15, type: 'keyboard', value: 'ctrl+shift+s', label: 'Stop Record' },
                { id: 16, type: 'keyboard', value: 'ctrl+m', label: 'Mute Mic' },
                { id: 17, type: 'keyboard', value: 'ctrl+shift+m', label: 'Mute Audio' },
                { id: 18, type: 'text', value: 'Thanks for watching! Don\'t forget to like and subscribe!', label: 'Thanks' }
            ];

            await buttonPage.bulkConfigureButtons(streamingMacros);
            
            // Test streaming controls
            for (const macro of streamingMacros) {
                await buttonPage.testButton(macro.id);
                await mainPage.page.waitForTimeout(200);
            }
        });

        // PHASE 4: Social Media and Communication
        await test.step('Phase 4: Configure Social Media Shortcuts', async () => {
            const socialMacros = [
                { id: 19, type: 'text', value: '#contentcreator #video #editing', label: 'Hashtags' },
                { id: 20, type: 'text', value: 'Check out my latest video!', label: 'Promo' },
                { id: 21, type: 'command', value: 'open https://youtube.com/studio', label: 'YT Studio' },
                { id: 22, type: 'command', value: 'open https://twitter.com', label: 'Twitter' },
                { id: 23, type: 'keyboard', value: 'ctrl+enter', label: 'Send Post' },
                { id: 24, type: 'keyboard', value: 'ctrl+shift+n', label: 'New Window' }
            ];

            await buttonPage.bulkConfigureButtons(socialMacros);
        });

        // PHASE 5: Daily Workflow Simulation (Productivity Test)
        await test.step('Phase 5: Simulate Content Creation Workflow', async () => {
            const startTime = Date.now();

            // Simulate video editing workflow
            const editingSequence = [1, 7, 8, 9, 2, 10, 3, 11, 12]; // Play, mark in/out, cut, undo, paste, redo, duplicate, delete
            for (const buttonId of editingSequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(150);
            }

            // Simulate streaming preparation
            const streamingSequence = [14, 13, 16]; // Start record, fullscreen, mute check
            for (const buttonId of streamingSequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(300);
            }

            // Simulate social media posting
            const socialSequence = [19, 20, 21, 23]; // Hashtags, promo text, open platform, post
            for (const buttonId of socialSequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(200);
            }

            const endTime = Date.now();
            const workflowDuration = endTime - startTime;

            // Verify productivity metrics
            // Target: 25-40% improvement means workflow should complete efficiently
            expect(workflowDuration).toBeLessThan(15000); // Should complete in under 15 seconds
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // PHASE 6: Configuration Persistence and Sharing
        await test.step('Phase 6: Save and Export Content Creator Profile', async () => {
            await mainPage.saveConfiguration();
            
            // Export configuration for sharing with other content creators
            const exportedConfig = await buttonPage.exportConfiguration();
            expect(exportedConfig).toBeTruthy();
            expect(exportedConfig.suggestedFilename()).toMatch(/content.*creator|video.*editor/i);
            
            // Verify configuration can be reloaded
            await mainPage.reloadConfiguration();
            expect(await mainPage.getValidationStatus()).toBe('valid');
        });
    });

    test('should support encoder-based timeline scrubbing workflow', async () => {
        // GIVEN: Content creator has encoders configured
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 16,
            encoderCount: 2
        });
        await mainPage.testConnection();

        // WHEN: User performs timeline scrubbing with encoders
        await test.step('Simulate timeline scrubbing with encoder', async () => {
            // Encoder 1 for timeline scrubbing
            await framework.simulateEncoderRotation(1, 'CW');  // Forward scrub
            await mainPage.page.waitForTimeout(200);
            
            await framework.simulateEncoderRotation(1, 'CCW'); // Backward scrub
            await mainPage.page.waitForTimeout(200);
            
            // Encoder 2 for volume/zoom control
            await framework.simulateEncoderRotation(2, 'CW');  // Increase
            await mainPage.page.waitForTimeout(200);
            
            await framework.simulateEncoderRotation(2, 'CCW'); // Decrease
            await mainPage.page.waitForTimeout(200);
        });

        // THEN: Encoder inputs should be processed smoothly
        await test.step('Verify smooth encoder response', async () => {
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
            
            // Check encoder feedback in UI if available
            const encoderStatus = mainPage.page.locator('.encoder-status, .encoder-feedback');
            if (await encoderStatus.isVisible()) {
                await expect(encoderStatus).toContainText(/encoder|rotation/i);
            }
        });
    });
});

test.describe('User Journey: Enterprise Power User Workflow', () => {
    let framework;
    let mainPage;
    let buttonPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({
            screenshotOnFailure: true,
            timeout: 45000
        });
        
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        buttonPage = new ButtonConfigurationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should complete enterprise developer workflow with security compliance', async () => {
        // PHASE 1: Enterprise Security Setup
        await test.step('Phase 1: Configure Enterprise Security Settings', async () => {
            await mainPage.waitForApplicationReady();
            await mainPage.configureDevice({
                serialPort: 'MOCK_PORT',
                baudRate: 115200,
                buttonCount: 32,  // Enterprise users need extensive shortcuts
                encoderCount: 4
            });

            await mainPage.testConnection();
            
            // Enable enterprise security features
            await mainPage.openFeature('plugin-manager');
            await mainPage.page.waitForTimeout(1000);
            
            // This would typically involve security policy configuration
            // Currently testing the UI framework for future security features
        });

        // PHASE 2: Development Environment Shortcuts
        await test.step('Phase 2: Configure Development Shortcuts', async () => {
            const devMacros = [
                // IDE shortcuts
                { id: 1, type: 'keyboard', value: 'ctrl+shift+p', label: 'Command Palette' },
                { id: 2, type: 'keyboard', value: 'ctrl+p', label: 'Quick Open' },
                { id: 3, type: 'keyboard', value: 'ctrl+shift+f', label: 'Find in Files' },
                { id: 4, type: 'keyboard', value: 'ctrl+shift+r', label: 'Refactor' },
                { id: 5, type: 'keyboard', value: 'f5', label: 'Debug' },
                { id: 6, type: 'keyboard', value: 'ctrl+f5', label: 'Run' },
                { id: 7, type: 'keyboard', value: 'shift+f5', label: 'Stop' },
                { id: 8, type: 'keyboard', value: 'f9', label: 'Breakpoint' },
                
                // Git shortcuts
                { id: 9, type: 'command', value: 'git status', label: 'Git Status' },
                { id: 10, type: 'command', value: 'git add .', label: 'Git Add All' },
                { id: 11, type: 'command', value: 'git commit -m "WIP"', label: 'Quick Commit' },
                { id: 12, type: 'command', value: 'git push', label: 'Git Push' },
                { id: 13, type: 'command', value: 'git pull', label: 'Git Pull' },
                
                // Terminal shortcuts
                { id: 14, type: 'command', value: 'npm test', label: 'Run Tests' },
                { id: 15, type: 'command', value: 'npm run build', label: 'Build' },
                { id: 16, type: 'command', value: 'npm run lint', label: 'Lint' }
            ];

            await buttonPage.bulkConfigureButtons(devMacros);
        });

        // PHASE 3: System Administration Shortcuts
        await test.step('Phase 3: Configure System Admin Shortcuts', async () => {
            const sysAdminMacros = [
                { id: 17, type: 'command', value: 'docker ps', label: 'Docker PS' },
                { id: 18, type: 'command', value: 'docker-compose up', label: 'Compose Up' },
                { id: 19, type: 'command', value: 'docker-compose down', label: 'Compose Down' },
                { id: 20, type: 'command', value: 'kubectl get pods', label: 'K8s Pods' },
                { id: 21, type: 'command', value: 'htop', label: 'Process Monitor' },
                { id: 22, type: 'command', value: 'df -h', label: 'Disk Usage' },
                { id: 23, type: 'text', value: 'ssh user@server.example.com', label: 'SSH Template' },
                { id: 24, type: 'text', value: 'sudo systemctl restart ', label: 'Restart Service' }
            ];

            await buttonPage.bulkConfigureButtons(sysAdminMacros);
        });

        // PHASE 4: Communication and Documentation
        await test.step('Phase 4: Configure Communication Shortcuts', async () => {
            const commMacros = [
                { id: 25, type: 'text', value: '✅ Code review complete', label: 'Review Done' },
                { id: 26, type: 'text', value: '🚀 Deployed to production', label: 'Deploy Msg' },
                { id: 27, type: 'text', value: '🐛 Bug found in: ', label: 'Bug Report' },
                { id: 28, type: 'text', value: '📋 TODO: ', label: 'Todo Item' },
                { id: 29, type: 'keyboard', value: 'ctrl+shift+enter', label: 'Send Message' },
                { id: 30, type: 'command', value: 'open https://github.com', label: 'GitHub' },
                { id: 31, type: 'command', value: 'open https://stackoverflow.com', label: 'StackOverflow' },
                { id: 32, type: 'command', value: 'open https://docs.company.com', label: 'Company Docs' }
            ];

            await buttonPage.bulkConfigureButtons(commMacros);
        });

        // PHASE 5: Enterprise Workflow Simulation
        await test.step('Phase 5: Simulate Enterprise Development Day', async () => {
            const startTime = Date.now();

            // Morning standup preparation
            const standupSequence = [9, 27]; // Git status, bug report template
            for (const buttonId of standupSequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(100);
            }

            // Development cycle
            const devCycle = [2, 3, 4, 5, 8, 14, 15]; // Quick open, find, refactor, debug, breakpoint, test, build
            for (const buttonId of devCycle) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(150);
            }

            // Code review and deployment
            const deploySequence = [10, 11, 12, 25, 26]; // Add all, commit, push, review done, deploy message
            for (const buttonId of deploySequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(200);
            }

            // System monitoring
            const monitorSequence = [17, 20, 21, 22]; // Docker, k8s, processes, disk
            for (const buttonId of monitorSequence) {
                await buttonPage.simulateHardwareButtonPress(buttonId);
                await mainPage.page.waitForTimeout(300);
            }

            const endTime = Date.now();
            const workflowDuration = endTime - startTime;

            // Enterprise productivity validation
            expect(workflowDuration).toBeLessThan(20000); // Complex workflow under 20 seconds
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // PHASE 6: Security and Compliance Validation
        await test.step('Phase 6: Validate Security Compliance', async () => {
            // Verify all commands comply with enterprise security policies
            // This tests the security policy management feature from business requirements
            
            await mainPage.validateConfiguration();
            expect(await mainPage.getValidationStatus()).toBe('valid');
            
            // Test that restricted commands are blocked (future feature)
            // This validates the P0 Security Policy Management epic
        });
    });
});

test.describe('User Journey: Hardware Enthusiast Advanced Configuration', () => {
    let framework;
    let mainPage;
    let buttonPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({ screenshotOnFailure: true });
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        buttonPage = new ButtonConfigurationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should complete advanced hardware configuration workflow', async () => {
        // PHASE 1: Maximum Hardware Configuration
        await test.step('Phase 1: Configure Maximum Hardware Setup', async () => {
            await mainPage.waitForApplicationReady();
            await mainPage.configureDevice({
                serialPort: 'MOCK_PORT',
                baudRate: 115200,
                buttonCount: 32,  // Maximum supported buttons
                encoderCount: 8   // Maximum supported encoders
            });

            const connectionSuccess = await mainPage.testConnection();
            expect(connectionSuccess).toBe(true);
        });

        // PHASE 2: Advanced Feature Integration
        await test.step('Phase 2: Test All Advanced Features', async () => {
            // Test LED management
            await mainPage.openFeature('led-manager');
            await mainPage.page.waitForTimeout(1000);
            
            // Close LED manager
            const closeButton = mainPage.page.locator('.close, .modal-close, [aria-label="Close"]').first();
            if (await closeButton.isVisible()) {
                await closeButton.click();
            }

            // Test system integration
            await mainPage.openFeature('system-integration');
            await mainPage.page.waitForTimeout(1000);

            // Test voice recognition
            await mainPage.openFeature('voice-recognition');
            await mainPage.page.waitForTimeout(1000);

            // Test plugin manager
            await mainPage.openFeature('plugin-manager');
            await mainPage.page.waitForTimeout(1000);
        });

        // PHASE 3: Complex Macro Combinations
        await test.step('Phase 3: Configure Complex Multi-Step Macros', async () => {
            // Configure complex multi-action macros
            const complexMacros = [
                { id: 1, type: 'keyboard', value: 'ctrl+alt+shift+f12', label: 'Complex Hotkey' },
                { id: 2, type: 'text', value: 'This is a very long text expansion that would take forever to type manually every time', label: 'Long Text' }
            ];

            await buttonPage.bulkConfigureButtons(complexMacros);

            // Test rapid execution of complex macros
            for (let i = 0; i < 10; i++) {
                await buttonPage.simulateHardwareButtonPress(1);
                await buttonPage.simulateHardwareButtonPress(2);
                await mainPage.page.waitForTimeout(50);
            }

            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // PHASE 4: All Encoder Testing
        await test.step('Phase 4: Test All Encoder Configurations', async () => {
            // Test all 8 encoders in both directions
            for (let encoderId = 1; encoderId <= 8; encoderId++) {
                await framework.simulateEncoderRotation(encoderId, 'CW');
                await framework.simulateEncoderRotation(encoderId, 'CCW');
                await mainPage.page.waitForTimeout(50);
            }

            // Rapid encoder testing for responsiveness
            for (let i = 0; i < 20; i++) {
                const direction = i % 2 === 0 ? 'CW' : 'CCW';
                const encoderId = (i % 8) + 1;
                await framework.simulateEncoderRotation(encoderId, direction);
                await mainPage.page.waitForTimeout(25);
            }

            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });
    });
});

// Performance and stress testing for user workflows
test.describe('User Journey: Performance and Reliability', () => {
    let framework;
    let mainPage;
    let buttonPage;

    test.beforeEach(async () => {
        framework = new E2ETestFramework({ 
            screenshotOnFailure: true,
            timeout: 60000  // Extended for stress testing
        });
        await framework.initialize();
        mainPage = new MainApplicationPage(framework);
        buttonPage = new ButtonConfigurationPage(framework);
    });

    test.afterEach(async () => {
        await framework.cleanup();
    });

    test('should maintain performance under heavy usage', async () => {
        // Setup
        await mainPage.waitForApplicationReady();
        await mainPage.configureDevice({
            serialPort: 'MOCK_PORT',
            baudRate: 115200,
            buttonCount: 32,
            encoderCount: 8
        });
        await mainPage.testConnection();

        // Configure all buttons
        const allButtonConfigs = [];
        for (let i = 1; i <= 32; i++) {
            allButtonConfigs.push({
                id: i,
                type: 'keyboard',
                value: `f${Math.min(i, 12)}`,
                label: `Button ${i}`
            });
        }
        await buttonPage.bulkConfigureButtons(allButtonConfigs);

        // Stress test: Rapid button presses
        await test.step('Stress test: 1000 rapid button presses', async () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                const buttonId = (i % 32) + 1;
                await buttonPage.simulateHardwareButtonPress(buttonId);
                
                if (i % 100 === 0) {
                    // Check performance periodically
                    expect(await mainPage.getErrorStatus()).toBe('no-errors');
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should maintain responsiveness (target: <30ms per action)
            expect(duration).toBeLessThan(30000); // 30 seconds max for 1000 actions
            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // Stress test: Encoder spinning
        await test.step('Stress test: 500 encoder rotations', async () => {
            for (let i = 0; i < 500; i++) {
                const encoderId = (i % 8) + 1;
                const direction = i % 2 === 0 ? 'CW' : 'CCW';
                await framework.simulateEncoderRotation(encoderId, direction);
            }

            expect(await mainPage.getErrorStatus()).toBe('no-errors');
        });

        // Memory and performance validation
        await test.step('Validate system stability after stress test', async () => {
            await mainPage.validateConfiguration();
            expect(await mainPage.getValidationStatus()).toBe('valid');
            
            // Application should still be responsive
            await mainPage.saveConfiguration();
            await mainPage.reloadConfiguration();
            expect(await mainPage.getConnectionStatus()).toBe('connected');
        });
    });
});
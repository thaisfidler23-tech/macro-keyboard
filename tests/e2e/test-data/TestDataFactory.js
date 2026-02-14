/**
 * Test Data Factory for E2E Tests
 * 
 * Provides consistent test data generation for different user scenarios and workflows.
 * Supports the various user personas identified in the business analysis.
 */

class E2ETestDataFactory {
    constructor() {
        this.userProfiles = {
            contentCreator: this.createContentCreatorProfile(),
            powerUser: this.createPowerUserProfile(),
            enterpriseUser: this.createEnterpriseUserProfile(),
            hardwareEnthusiast: this.createHardwareEnthusiastProfile(),
            basicUser: this.createBasicUserProfile()
        };
    }

    /**
     * Content Creator Profile - Video editors, streamers (75% satisfaction target)
     */
    createContentCreatorProfile() {
        return {
            userType: 'content_creator',
            hardwareConfig: {
                buttonCount: 24,  // Need many shortcuts for editing
                encoderCount: 2,  // Timeline scrubbing, volume control
                serialPort: 'MOCK_PORT',
                baudRate: 115200
            },
            macroConfigurations: [
                // Video Editing Controls
                { id: 1, type: 'keyboard', value: 'space', label: 'Play/Pause', category: 'playback' },
                { id: 2, type: 'keyboard', value: 'j', label: 'Rewind', category: 'playback' },
                { id: 3, type: 'keyboard', value: 'k', label: 'Stop', category: 'playback' },
                { id: 4, type: 'keyboard', value: 'l', label: 'Fast Forward', category: 'playback' },
                { id: 5, type: 'keyboard', value: 'i', label: 'Mark In', category: 'editing' },
                { id: 6, type: 'keyboard', value: 'o', label: 'Mark Out', category: 'editing' },
                { id: 7, type: 'keyboard', value: 'ctrl+k', label: 'Cut/Razor', category: 'editing' },
                { id: 8, type: 'keyboard', value: 'delete', label: 'Delete', category: 'editing' },
                { id: 9, type: 'keyboard', value: 'ctrl+z', label: 'Undo', category: 'editing' },
                { id: 10, type: 'keyboard', value: 'ctrl+y', label: 'Redo', category: 'editing' },
                
                // Streaming Controls
                { id: 11, type: 'keyboard', value: 'f11', label: 'Fullscreen', category: 'streaming' },
                { id: 12, type: 'keyboard', value: 'ctrl+shift+r', label: 'Start Record', category: 'streaming' },
                { id: 13, type: 'keyboard', value: 'ctrl+shift+s', label: 'Stop Record', category: 'streaming' },
                { id: 14, type: 'keyboard', value: 'ctrl+m', label: 'Mute Mic', category: 'streaming' },
                
                // Social Media
                { id: 15, type: 'text', value: '#contentcreator #video #streaming', label: 'Hashtags', category: 'social' },
                { id: 16, type: 'text', value: 'Thanks for watching! Like and subscribe!', label: 'Thank You', category: 'social' },
                { id: 17, type: 'text', value: 'New video is live!', label: 'Announcement', category: 'social' },
                
                // Productivity Shortcuts
                { id: 18, type: 'keyboard', value: 'ctrl+s', label: 'Save Project', category: 'productivity' },
                { id: 19, type: 'keyboard', value: 'ctrl+shift+e', label: 'Export', category: 'productivity' },
                { id: 20, type: 'keyboard', value: 'ctrl+alt+n', label: 'New Sequence', category: 'productivity' }
            ],
            expectedProductivityGain: 35, // 35% improvement target
            testScenarios: [
                'video_editing_workflow',
                'streaming_session',
                'social_media_posting',
                'project_management'
            ]
        };
    }

    /**
     * Power User Profile - Technical professionals (85% satisfaction, highest current)
     */
    createPowerUserProfile() {
        return {
            userType: 'power_user',
            hardwareConfig: {
                buttonCount: 32,  // Maximum buttons for complex workflows
                encoderCount: 4,  // Multiple parameter controls
                serialPort: 'MOCK_PORT',
                baudRate: 115200
            },
            macroConfigurations: [
                // Development Shortcuts
                { id: 1, type: 'keyboard', value: 'ctrl+shift+p', label: 'Command Palette', category: 'dev' },
                { id: 2, type: 'keyboard', value: 'ctrl+p', label: 'Quick Open', category: 'dev' },
                { id: 3, type: 'keyboard', value: 'ctrl+shift+f', label: 'Global Search', category: 'dev' },
                { id: 4, type: 'keyboard', value: 'f5', label: 'Debug', category: 'dev' },
                { id: 5, type: 'keyboard', value: 'shift+f5', label: 'Stop Debug', category: 'dev' },
                { id: 6, type: 'keyboard', value: 'f9', label: 'Toggle Breakpoint', category: 'dev' },
                
                // Git Commands
                { id: 7, type: 'command', value: 'git status', label: 'Git Status', category: 'git' },
                { id: 8, type: 'command', value: 'git add .', label: 'Git Add All', category: 'git' },
                { id: 9, type: 'command', value: 'git commit -m "WIP"', label: 'Quick Commit', category: 'git' },
                { id: 10, type: 'command', value: 'git push', label: 'Git Push', category: 'git' },
                { id: 11, type: 'command', value: 'git pull', label: 'Git Pull', category: 'git' },
                
                // System Commands
                { id: 12, type: 'command', value: 'npm test', label: 'Run Tests', category: 'build' },
                { id: 13, type: 'command', value: 'npm run build', label: 'Build', category: 'build' },
                { id: 14, type: 'command', value: 'npm run lint', label: 'Lint Code', category: 'build' },
                
                // Text Expansions
                { id: 15, type: 'text', value: 'TODO: ', label: 'Todo', category: 'productivity' },
                { id: 16, type: 'text', value: 'FIXME: ', label: 'Fixme', category: 'productivity' },
                { id: 17, type: 'text', value: 'console.log(', label: 'Debug Log', category: 'productivity' },
                
                // Advanced Workflows
                { id: 18, type: 'keyboard', value: 'ctrl+shift+r', label: 'Refactor', category: 'advanced' },
                { id: 19, type: 'keyboard', value: 'alt+shift+f', label: 'Format Document', category: 'advanced' },
                { id: 20, type: 'keyboard', value: 'ctrl+shift+i', label: 'Dev Tools', category: 'advanced' }
            ],
            expectedProductivityGain: 40, // 40% improvement target (highest)
            testScenarios: [
                'development_workflow',
                'debugging_session',
                'code_review_process',
                'deployment_pipeline'
            ]
        };
    }

    /**
     * Enterprise User Profile - Corporate environment (65% satisfaction, needs improvement)
     */
    createEnterpriseUserProfile() {
        return {
            userType: 'enterprise_user',
            hardwareConfig: {
                buttonCount: 16,  // Moderate complexity for corporate use
                encoderCount: 2,
                serialPort: 'MOCK_PORT',
                baudRate: 115200
            },
            securityRequirements: {
                enableSecurityPolicies: true,
                mode: 'allowlist',
                allowedCommands: ['echo', 'ls', 'pwd', 'cd', 'cat', 'grep'],
                blockedCommands: ['rm', 'del', 'format', 'fdisk', 'shutdown'],
                auditLogging: true,
                complianceMode: 'SOC2'
            },
            macroConfigurations: [
                // Safe Corporate Commands
                { id: 1, type: 'command', value: 'echo "Status: Working"', label: 'Status Check', category: 'safe' },
                { id: 2, type: 'command', value: 'pwd', label: 'Current Dir', category: 'safe' },
                { id: 3, type: 'text', value: 'Best regards,\nJohn Smith\nSenior Developer', label: 'Email Sig', category: 'text' },
                
                // Office Shortcuts
                { id: 4, type: 'keyboard', value: 'ctrl+c', label: 'Copy', category: 'office' },
                { id: 5, type: 'keyboard', value: 'ctrl+v', label: 'Paste', category: 'office' },
                { id: 6, type: 'keyboard', value: 'ctrl+z', label: 'Undo', category: 'office' },
                { id: 7, type: 'keyboard', value: 'ctrl+s', label: 'Save', category: 'office' },
                { id: 8, type: 'keyboard', value: 'alt+tab', label: 'Switch App', category: 'office' },
                
                // Communication Templates
                { id: 9, type: 'text', value: 'Thank you for your email. I will review and respond shortly.', label: 'Email Response', category: 'comm' },
                { id: 10, type: 'text', value: 'Meeting scheduled for ', label: 'Meeting', category: 'comm' },
                { id: 11, type: 'text', value: 'Please see attached document for details.', label: 'Attachment', category: 'comm' },
                
                // Compliance and Security
                { id: 12, type: 'text', value: 'CONFIDENTIAL - Internal Use Only', label: 'Confidential', category: 'security' },
                { id: 13, type: 'text', value: 'This information is subject to NDA terms.', label: 'NDA Notice', category: 'security' }
            ],
            expectedProductivityGain: 25, // 25% improvement target
            testScenarios: [
                'email_workflow',
                'document_preparation',
                'meeting_management',
                'compliance_reporting'
            ]
        };
    }

    /**
     * Hardware Enthusiast Profile - Early adopters (90% satisfaction)
     */
    createHardwareEnthusiastProfile() {
        return {
            userType: 'hardware_enthusiast',
            hardwareConfig: {
                buttonCount: 32,  // Maximum configuration
                encoderCount: 8,  // All encoders
                serialPort: 'MOCK_PORT',
                baudRate: 115200
            },
            advancedFeatures: {
                enableLEDControl: true,
                customFirmware: true,
                hardwareDebugging: true,
                performanceMonitoring: true
            },
            macroConfigurations: [
                // Hardware Testing
                { id: 1, type: 'command', value: 'arduino-cli board list', label: 'List Boards', category: 'hardware' },
                { id: 2, type: 'command', value: 'arduino-cli compile', label: 'Compile', category: 'hardware' },
                { id: 3, type: 'command', value: 'arduino-cli upload', label: 'Upload', category: 'hardware' },
                
                // System Monitoring
                { id: 4, type: 'command', value: 'htop', label: 'Process Monitor', category: 'system' },
                { id: 5, type: 'command', value: 'iostat', label: 'IO Stats', category: 'system' },
                { id: 6, type: 'command', value: 'lsusb', label: 'USB Devices', category: 'system' },
                
                // Development Tools
                { id: 7, type: 'keyboard', value: 'ctrl+shift+i', label: 'DevTools', category: 'dev' },
                { id: 8, type: 'keyboard', value: 'f12', label: 'Debug Console', category: 'dev' },
                
                // Custom Complex Macros
                { id: 9, type: 'keyboard', value: 'ctrl+alt+shift+f12', label: 'Complex Combo', category: 'advanced' },
                { id: 10, type: 'text', value: 'function complexOperation() {\n  // Implementation here\n}', label: 'Function Template', category: 'advanced' }
            ],
            expectedProductivityGain: 30, // 30% improvement (they already optimize heavily)
            testScenarios: [
                'hardware_debugging',
                'firmware_development',
                'performance_optimization',
                'custom_configuration'
            ]
        };
    }

    /**
     * Basic User Profile - Mainstream adoption target
     */
    createBasicUserProfile() {
        return {
            userType: 'basic_user',
            hardwareConfig: {
                buttonCount: 8,   // Simple configuration
                encoderCount: 1,  // Minimal encoders
                serialPort: 'MOCK_PORT',
                baudRate: 115200
            },
            macroConfigurations: [
                { id: 1, type: 'keyboard', value: 'ctrl+c', label: 'Copy', category: 'basic' },
                { id: 2, type: 'keyboard', value: 'ctrl+v', label: 'Paste', category: 'basic' },
                { id: 3, type: 'keyboard', value: 'ctrl+z', label: 'Undo', category: 'basic' },
                { id: 4, type: 'keyboard', value: 'ctrl+s', label: 'Save', category: 'basic' },
                { id: 5, type: 'text', value: 'Hello, how are you?', label: 'Greeting', category: 'text' },
                { id: 6, type: 'text', value: 'Thank you!', label: 'Thanks', category: 'text' },
                { id: 7, type: 'keyboard', value: 'alt+tab', label: 'Switch Apps', category: 'basic' },
                { id: 8, type: 'keyboard', value: 'ctrl+w', label: 'Close Tab', category: 'basic' }
            ],
            expectedProductivityGain: 20, // 20% improvement target
            testScenarios: [
                'first_time_setup',
                'basic_daily_usage',
                'simple_text_expansion'
            ]
        };
    }

    /**
     * Get profile by user type
     */
    getProfile(userType) {
        return this.userProfiles[userType] || this.userProfiles.basicUser;
    }

    /**
     * Create test workflow data for specific scenarios
     */
    createWorkflowData(scenarioName) {
        const workflows = {
            'video_editing_workflow': {
                name: 'Video Editing Workflow',
                steps: [
                    { action: 'button_press', buttonId: 1, expectedResult: 'play_pause_toggle' },
                    { action: 'button_press', buttonId: 5, expectedResult: 'mark_in_set' },
                    { action: 'button_press', buttonId: 6, expectedResult: 'mark_out_set' },
                    { action: 'button_press', buttonId: 7, expectedResult: 'cut_performed' },
                    { action: 'button_press', buttonId: 18, expectedResult: 'project_saved' }
                ],
                expectedDuration: 5000, // 5 seconds
                successCriteria: ['no_errors', 'all_actions_executed', 'ui_responsive']
            },
            
            'development_workflow': {
                name: 'Development Workflow',
                steps: [
                    { action: 'button_press', buttonId: 7, expectedResult: 'git_status_shown' },
                    { action: 'button_press', buttonId: 8, expectedResult: 'files_added' },
                    { action: 'button_press', buttonId: 9, expectedResult: 'commit_created' },
                    { action: 'button_press', buttonId: 12, expectedResult: 'tests_running' },
                    { action: 'button_press', buttonId: 13, expectedResult: 'build_started' }
                ],
                expectedDuration: 10000, // 10 seconds
                successCriteria: ['no_errors', 'commands_executed', 'feedback_shown']
            },
            
            'first_time_setup': {
                name: 'First Time User Setup',
                steps: [
                    { action: 'device_connection', expectedResult: 'device_connected' },
                    { action: 'button_configuration', buttonId: 1, expectedResult: 'button_configured' },
                    { action: 'test_execution', buttonId: 1, expectedResult: 'macro_executed' },
                    { action: 'save_configuration', expectedResult: 'config_saved' }
                ],
                expectedDuration: 15000, // 15 seconds (includes learning time)
                successCriteria: ['setup_completed', 'user_successful', 'no_confusion']
            }
        };

        return workflows[scenarioName];
    }

    /**
     * Generate test data for error scenarios
     */
    createErrorScenarios() {
        return {
            'connection_failure': {
                setup: { serialPort: 'INVALID_PORT' },
                expectedError: 'connection_failed',
                recoveryAction: 'select_valid_port'
            },
            'invalid_command': {
                setup: { 
                    macro: { type: 'command', value: 'dangerous_command --delete-all' }
                },
                expectedError: 'security_blocked',
                recoveryAction: 'use_safe_command'
            },
            'hardware_disconnection': {
                setup: { simulateDisconnection: true },
                expectedError: 'device_disconnected',
                recoveryAction: 'reconnect_device'
            }
        };
    }

    /**
     * Generate performance test data
     */
    createPerformanceTestData() {
        return {
            'rapid_button_presses': {
                count: 1000,
                interval: 10, // 10ms between presses
                expectedResponseTime: 30, // 30ms max response time
                acceptableDrops: 0 // No dropped events acceptable
            },
            'encoder_spinning': {
                count: 500,
                direction: 'alternating',
                interval: 20, // 20ms between rotations
                expectedResponseTime: 50, // 50ms max response time
            },
            'bulk_configuration': {
                buttonCount: 32,
                configurationTime: 5000, // 5 seconds max
                validationTime: 2000 // 2 seconds max
            }
        };
    }

    /**
     * Generate cross-platform test data
     */
    createCrossPlatformData() {
        return {
            'platform_shortcuts': {
                'darwin': {
                    copy: 'cmd+c',
                    paste: 'cmd+v',
                    undo: 'cmd+z',
                    redo: 'cmd+shift+z'
                },
                'win32': {
                    copy: 'ctrl+c',
                    paste: 'ctrl+v',
                    undo: 'ctrl+z',
                    redo: 'ctrl+y'
                },
                'linux': {
                    copy: 'ctrl+c',
                    paste: 'ctrl+v',
                    undo: 'ctrl+z',
                    redo: 'ctrl+y'
                }
            },
            'platform_commands': {
                'darwin': ['ls -la', 'pwd', 'open'],
                'win32': ['dir', 'cd', 'start'],
                'linux': ['ls -la', 'pwd', 'xdg-open']
            },
            'platform_paths': {
                'darwin': '~/Documents',
                'win32': '%USERPROFILE%\\Documents',
                'linux': '~/Documents'
            }
        };
    }

    /**
     * Generate accessibility test data
     */
    createAccessibilityTestData() {
        return {
            'keyboard_navigation': {
                tabOrder: [
                    '#serial-port',
                    '#refresh-ports',
                    '#test-connection',
                    '#baud-rate',
                    '#button-count',
                    '#encoder-count',
                    '#validate-config',
                    '#save-config'
                ],
                shortcuts: {
                    'save': process.platform === 'darwin' ? 'cmd+s' : 'ctrl+s',
                    'refresh': process.platform === 'darwin' ? 'cmd+r' : 'ctrl+r'
                }
            },
            'screen_reader': {
                requiredAriaLabels: [
                    'connection-status',
                    'validation-status',
                    'error-status'
                ],
                requiredRoles: [
                    { selector: 'header h1', role: 'heading' },
                    { selector: '.status', role: 'status' }
                ]
            },
            'visual_accessibility': {
                zoomLevels: [100, 125, 150, 200],
                fontSizes: [16, 18, 20, 24],
                highContrast: true
            }
        };
    }
}

module.exports = E2ETestDataFactory;
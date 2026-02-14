/**
 * Button Configuration Page Object
 * Handles button configuration and macro assignment functionality
 */

class ButtonConfigurationPage {
    constructor(framework) {
        this.framework = framework;
        this.page = framework.mainWindow;
    }

    // Button grid elements
    get buttonGrid() { return this.page.locator('.button-grid'); }
    get buttonPreview() { return this.page.locator('.button-preview'); }
    
    // Configuration form elements
    get buttonIdInput() { return this.page.locator('#button-id'); }
    get actionTypeSelect() { return this.page.locator('#action-type'); }
    get actionValueInput() { return this.page.locator('#action-value'); }
    get buttonLabelInput() { return this.page.locator('#button-label'); }
    get buttonColorPicker() { return this.page.locator('#button-color'); }
    
    // Action buttons
    get addButtonButton() { return this.page.locator('#add-button'); }
    get updateButtonButton() { return this.page.locator('#update-button'); }
    get deleteButtonButton() { return this.page.locator('#delete-button'); }
    get testButtonButton() { return this.page.locator('#test-button'); }
    
    // Modal elements
    get macroRecorderModal() { return this.page.locator('.macro-recorder-modal'); }
    get keyboardShortcutModal() { return this.page.locator('.keyboard-shortcut-modal'); }

    /**
     * Get button element by ID
     */
    getButtonElement(buttonId) {
        return this.page.locator(`[data-button-id="${buttonId}"]`);
    }

    /**
     * Configure a button with specific action
     */
    async configureButton(buttonId, actionConfig) {
        // Select the button
        await this.getButtonElement(buttonId).click();
        
        // Fill in the configuration form
        if (actionConfig.type) {
            await this.actionTypeSelect.selectOption(actionConfig.type);
        }
        
        if (actionConfig.value) {
            await this.actionValueInput.fill(actionConfig.value);
        }
        
        if (actionConfig.label) {
            await this.buttonLabelInput.fill(actionConfig.label);
        }
        
        if (actionConfig.color) {
            await this.buttonColorPicker.fill(actionConfig.color);
        }
        
        // Save the configuration
        await this.updateButtonButton.click();
        
        // Wait for configuration to be saved
        await this.page.waitForTimeout(1000);
    }

    /**
     * Test button functionality
     */
    async testButton(buttonId) {
        await this.getButtonElement(buttonId).click();
        await this.testButtonButton.click();
        
        // Wait for test execution
        await this.page.waitForTimeout(2000);
    }

    /**
     * Delete button configuration
     */
    async deleteButton(buttonId) {
        await this.getButtonElement(buttonId).click();
        await this.deleteButtonButton.click();
        
        // Confirm deletion if dialog appears
        const confirmDialog = this.page.locator('.confirm-dialog');
        if (await confirmDialog.isVisible()) {
            await confirmDialog.locator('button.confirm').click();
        }
        
        await this.page.waitForTimeout(1000);
    }

    /**
     * Record macro for button
     */
    async recordMacro(buttonId) {
        await this.getButtonElement(buttonId).click();
        
        // Open macro recorder
        await this.page.locator('#record-macro-btn').click();
        await this.macroRecorderModal.waitFor({ state: 'visible' });
        
        // Start recording
        await this.macroRecorderModal.locator('#start-recording').click();
        
        // Wait for recording to start
        await this.page.waitForTimeout(1000);
        
        return {
            stop: async () => {
                await this.macroRecorderModal.locator('#stop-recording').click();
                await this.page.waitForTimeout(500);
            },
            save: async (name) => {
                await this.macroRecorderModal.locator('#macro-name').fill(name);
                await this.macroRecorderModal.locator('#save-macro').click();
                await this.macroRecorderModal.waitFor({ state: 'hidden' });
            }
        };
    }

    /**
     * Open keyboard shortcut picker
     */
    async pickKeyboardShortcut(buttonId) {
        await this.getButtonElement(buttonId).click();
        await this.page.locator('#pick-shortcut-btn').click();
        
        await this.keyboardShortcutModal.waitFor({ state: 'visible' });
        
        return {
            selectShortcut: async (keys) => {
                // Simulate key combination
                for (const key of keys) {
                    await this.page.keyboard.press(key);
                }
            },
            confirm: async () => {
                await this.keyboardShortcutModal.locator('#confirm-shortcut').click();
                await this.keyboardShortcutModal.waitFor({ state: 'hidden' });
            },
            cancel: async () => {
                await this.keyboardShortcutModal.locator('#cancel-shortcut').click();
                await this.keyboardShortcutModal.waitFor({ state: 'hidden' });
            }
        };
    }

    /**
     * Verify button configuration
     */
    async verifyButtonConfiguration(buttonId, expectedConfig) {
        const buttonElement = this.getButtonElement(buttonId);
        await buttonElement.click();
        
        // Wait for form to populate
        await this.page.waitForTimeout(500);
        
        if (expectedConfig.type) {
            const actionType = await this.actionTypeSelect.inputValue();
            expect(actionType).toBe(expectedConfig.type);
        }
        
        if (expectedConfig.value) {
            const actionValue = await this.actionValueInput.inputValue();
            expect(actionValue).toBe(expectedConfig.value);
        }
        
        if (expectedConfig.label) {
            const buttonLabel = await this.buttonLabelInput.inputValue();
            expect(buttonLabel).toBe(expectedConfig.label);
        }
        
        // Verify visual representation
        if (expectedConfig.label) {
            await expect(buttonElement.locator('.button-label')).toHaveText(expectedConfig.label);
        }
    }

    /**
     * Get all configured buttons
     */
    async getAllConfiguredButtons() {
        const buttons = await this.page.locator('[data-button-id]').all();
        const configurations = [];
        
        for (const button of buttons) {
            const buttonId = await button.getAttribute('data-button-id');
            await button.click();
            await this.page.waitForTimeout(200);
            
            const config = {
                id: buttonId,
                type: await this.actionTypeSelect.inputValue(),
                value: await this.actionValueInput.inputValue(),
                label: await this.buttonLabelInput.inputValue()
            };
            
            configurations.push(config);
        }
        
        return configurations;
    }

    /**
     * Simulate button press from hardware
     */
    async simulateHardwareButtonPress(buttonId) {
        await this.framework.simulateButtonPress(buttonId);
        
        // Verify UI feedback
        const buttonElement = this.getButtonElement(buttonId);
        await expect(buttonElement).toHaveClass(/pressed|active/);
        
        // Wait for button release
        await this.page.waitForTimeout(500);
        await expect(buttonElement).not.toHaveClass(/pressed|active/);
    }

    /**
     * Bulk configure multiple buttons
     */
    async bulkConfigureButtons(buttonConfigs) {
        for (const config of buttonConfigs) {
            await this.configureButton(config.id, {
                type: config.type,
                value: config.value,
                label: config.label,
                color: config.color
            });
        }
    }

    /**
     * Export button configuration
     */
    async exportConfiguration() {
        await this.page.locator('#export-buttons').click();
        
        // Handle file save dialog
        const [download] = await Promise.all([
            this.page.waitForEvent('download'),
            this.page.locator('#confirm-export').click()
        ]);
        
        return download;
    }

    /**
     * Import button configuration
     */
    async importConfiguration(filePath) {
        await this.page.locator('#import-buttons').click();
        
        // Handle file open dialog
        const fileInputPromise = this.page.waitForEvent('filechooser');
        await this.page.locator('#choose-file').click();
        
        const fileChooser = await fileInputPromise;
        await fileChooser.setFiles(filePath);
        
        await this.page.locator('#confirm-import').click();
        await this.page.waitForTimeout(2000);
    }
}

module.exports = ButtonConfigurationPage;
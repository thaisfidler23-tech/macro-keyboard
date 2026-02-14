/**
 * Main Application Page Object
 * Represents the main application window and provides methods for interacting with core UI elements
 */

class MainApplicationPage {
    constructor(framework) {
        this.framework = framework;
        this.page = framework.mainWindow;
    }

    // Header Elements
    get headerTitle() { return this.page.locator('header h1'); }
    get connectionStatus() { return this.page.locator('#connection-status'); }
    get validationStatus() { return this.page.locator('#validation-status'); }
    get errorStatus() { return this.page.locator('#error-status'); }
    
    // Header Buttons
    get validateConfigButton() { return this.page.locator('#validate-config'); }
    get reloadConfigButton() { return this.page.locator('#reload-config'); }
    get saveConfigButton() { return this.page.locator('#save-config'); }
    get macroRecorderButton() { return this.page.locator('#macro-recorder-btn'); }
    get contextManagerButton() { return this.page.locator('#context-manager-btn'); }
    get ledManagerButton() { return this.page.locator('#led-manager-btn'); }
    get systemIntegrationButton() { return this.page.locator('#system-integration-btn'); }
    get voiceRecognitionButton() { return this.page.locator('#voice-recognition-btn'); }
    get pluginManagerButton() { return this.page.locator('#plugin-manager-btn'); }

    // Device Settings
    get serialPortSelect() { return this.page.locator('#serial-port'); }
    get refreshPortsButton() { return this.page.locator('#refresh-ports'); }
    get testConnectionButton() { return this.page.locator('#test-connection'); }
    get baudRateSelect() { return this.page.locator('#baud-rate'); }
    get buttonCountSelect() { return this.page.locator('#button-count'); }
    get encoderCountSelect() { return this.page.locator('#encoder-count'); }

    // Port Details
    get portDetails() { return this.page.locator('#port-details'); }
    get portPath() { return this.page.locator('#port-path'); }
    get portManufacturer() { return this.page.locator('#port-manufacturer'); }
    get portProductId() { return this.page.locator('#port-product-id'); }
    get portVendorId() { return this.page.locator('#port-vendor-id'); }
    get portSerialNumber() { return this.page.locator('#port-serial-number'); }
    get portStatus() { return this.page.locator('#port-status'); }

    /**
     * Wait for the application to be fully loaded
     */
    async waitForApplicationReady() {
        await this.headerTitle.waitFor({ state: 'visible' });
        await this.connectionStatus.waitFor({ state: 'visible' });
        await this.serialPortSelect.waitFor({ state: 'visible' });
    }

    /**
     * Verify the application header and status indicators
     */
    async verifyApplicationHeader() {
        await expect(this.headerTitle).toHaveText('Macro Keyboard Configuration');
        await expect(this.connectionStatus).toBeVisible();
        await expect(this.validationStatus).toBeVisible();
        await expect(this.errorStatus).toBeVisible();
    }

    /**
     * Configure device settings
     */
    async configureDevice(settings) {
        if (settings.serialPort) {
            await this.serialPortSelect.selectOption(settings.serialPort);
        }
        
        if (settings.baudRate) {
            await this.baudRateSelect.selectOption(settings.baudRate.toString());
        }
        
        if (settings.buttonCount) {
            await this.buttonCountSelect.selectOption(settings.buttonCount.toString());
        }
        
        if (settings.encoderCount) {
            await this.encoderCountSelect.selectOption(settings.encoderCount.toString());
        }
    }

    /**
     * Test hardware connection
     */
    async testConnection() {
        await this.testConnectionButton.click();
        
        // Wait for connection test to complete
        await this.page.waitForTimeout(2000);
        
        // Return connection status
        const statusText = await this.connectionStatus.textContent();
        return statusText.includes('Connected');
    }

    /**
     * Refresh available serial ports
     */
    async refreshPorts() {
        await this.refreshPortsButton.click();
        await this.page.waitForTimeout(1000);
    }

    /**
     * Validate configuration
     */
    async validateConfiguration() {
        await this.validateConfigButton.click();
        
        // Wait for validation to complete
        await this.page.waitForTimeout(2000);
        
        // Check validation status
        const validationText = await this.validationStatus.textContent();
        return validationText.includes('Valid') || validationText.includes('✅');
    }

    /**
     * Save configuration
     */
    async saveConfiguration() {
        await this.saveConfigButton.click();
        await this.page.waitForTimeout(1000);
    }

    /**
     * Reload configuration
     */
    async reloadConfiguration() {
        await this.reloadConfigButton.click();
        await this.page.waitForTimeout(1000);
    }

    /**
     * Open feature modal/dialog
     */
    async openFeature(featureName) {
        const buttonMap = {
            'macro-recorder': this.macroRecorderButton,
            'context-manager': this.contextManagerButton,
            'led-manager': this.ledManagerButton,
            'system-integration': this.systemIntegrationButton,
            'voice-recognition': this.voiceRecognitionButton,
            'plugin-manager': this.pluginManagerButton
        };

        const button = buttonMap[featureName];
        if (!button) {
            throw new Error(`Unknown feature: ${featureName}`);
        }

        await button.click();
        await this.page.waitForTimeout(1000);
    }

    /**
     * Get current connection status
     */
    async getConnectionStatus() {
        const statusElement = await this.connectionStatus;
        const statusText = await statusElement.textContent();
        
        if (statusText.includes('Connected') || statusText.includes('✅')) {
            return 'connected';
        } else if (statusText.includes('Disconnected') || statusText.includes('❌')) {
            return 'disconnected';
        } else {
            return 'unknown';
        }
    }

    /**
     * Get validation status
     */
    async getValidationStatus() {
        const statusElement = await this.validationStatus;
        const statusText = await statusElement.textContent();
        
        if (statusText.includes('Valid') || statusText.includes('✅')) {
            return 'valid';
        } else if (statusText.includes('Invalid') || statusText.includes('❌')) {
            return 'invalid';
        } else {
            return 'pending';
        }
    }

    /**
     * Get error status
     */
    async getErrorStatus() {
        const statusElement = await this.errorStatus;
        const statusText = await statusElement.textContent();
        
        if (statusText.includes('No Errors') || statusText.includes('✅')) {
            return 'no-errors';
        } else if (statusText.includes('Error') || statusText.includes('❌')) {
            return 'has-errors';
        } else {
            return 'unknown';
        }
    }

    /**
     * Verify port details are displayed
     */
    async verifyPortDetails(expectedDetails) {
        await expect(this.portDetails).toBeVisible();
        
        if (expectedDetails.path) {
            await expect(this.portPath).toHaveText(expectedDetails.path);
        }
        
        if (expectedDetails.manufacturer) {
            await expect(this.portManufacturer).toHaveText(expectedDetails.manufacturer);
        }
        
        if (expectedDetails.productId) {
            await expect(this.portProductId).toHaveText(expectedDetails.productId);
        }
        
        if (expectedDetails.vendorId) {
            await expect(this.portVendorId).toHaveText(expectedDetails.vendorId);
        }
    }
}

module.exports = MainApplicationPage;
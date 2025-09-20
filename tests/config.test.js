const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

describe('Configuration Tests', () => {
  let defaultConfig;

  beforeAll(() => {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    defaultConfig = yaml.load(configFile);
  });

  test('default config loads successfully', () => {
    expect(defaultConfig).toBeDefined();
    expect(typeof defaultConfig).toBe('object');
  });

  test('default config has required structure', () => {
    expect(defaultConfig).toHaveProperty('device');
    expect(defaultConfig).toHaveProperty('buttons');
    expect(defaultConfig).toHaveProperty('encoders');
    expect(defaultConfig).toHaveProperty('logging');
    expect(defaultConfig).toHaveProperty('security');
  });

  test('security config has required structure', () => {
    expect(defaultConfig.security).toHaveProperty('commandExecution');
    expect(defaultConfig.security).toHaveProperty('applicationExecution');
    expect(defaultConfig.security).toHaveProperty('keypressValidation');
  });

  test('command execution security config is valid', () => {
    const cmdSec = defaultConfig.security.commandExecution;
    
    expect(cmdSec).toHaveProperty('mode');
    expect(['allowlist', 'blacklist', 'disabled']).toContain(cmdSec.mode);
    expect(cmdSec).toHaveProperty('timeout');
    expect(typeof cmdSec.timeout).toBe('number');
    expect(cmdSec.timeout).toBeGreaterThan(0);
    expect(cmdSec).toHaveProperty('maxLength');
    expect(typeof cmdSec.maxLength).toBe('number');
    expect(cmdSec.maxLength).toBeGreaterThan(0);
    
    if (cmdSec.allowedCommands) {
      expect(Array.isArray(cmdSec.allowedCommands)).toBe(true);
    }
    if (cmdSec.blockedCommands) {
      expect(Array.isArray(cmdSec.blockedCommands)).toBe(true);
    }
  });

  test('application execution security config is valid', () => {
    const appSec = defaultConfig.security.applicationExecution;
    
    expect(appSec).toHaveProperty('mode');
    expect(['allowlist', 'blacklist', 'disabled']).toContain(appSec.mode);
    expect(appSec).toHaveProperty('maxPathLength');
    expect(typeof appSec.maxPathLength).toBe('number');
    expect(appSec.maxPathLength).toBeGreaterThan(0);
    
    if (appSec.allowedApplications) {
      expect(Array.isArray(appSec.allowedApplications)).toBe(true);
    }
    if (appSec.blockedApplications) {
      expect(Array.isArray(appSec.blockedApplications)).toBe(true);
    }
  });

  test('keypress validation security config is valid', () => {
    const keySec = defaultConfig.security.keypressValidation;
    
    expect(keySec).toHaveProperty('enabled');
    expect(typeof keySec.enabled).toBe('boolean');
    expect(keySec).toHaveProperty('maxKeyCombinations');
    expect(typeof keySec.maxKeyCombinations).toBe('number');
    expect(keySec.maxKeyCombinations).toBeGreaterThan(0);
    
    if (keySec.blockedKeys) {
      expect(Array.isArray(keySec.blockedKeys)).toBe(true);
    }
  });

  test('device config has required fields', () => {
    expect(defaultConfig.device).toHaveProperty('serialPort');
    expect(defaultConfig.device).toHaveProperty('baudRate');
    expect(defaultConfig.device).toHaveProperty('buttons');
    expect(defaultConfig.device).toHaveProperty('encoders');
  });

  test('button count is valid', () => {
    const validButtonCounts = [8, 12, 16, 24, 32];
    expect(validButtonCounts).toContain(defaultConfig.device.buttons);
  });

  test('encoder count is valid', () => {
    expect(defaultConfig.device.encoders).toBeGreaterThanOrEqual(0);
    expect(defaultConfig.device.encoders).toBeLessThanOrEqual(8);
  });

  test('baud rate is valid', () => {
    const validBaudRates = [9600, 19200, 38400, 57600, 115200];
    expect(validBaudRates).toContain(defaultConfig.device.baudRate);
  });
});
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
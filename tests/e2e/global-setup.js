/**
 * Global Setup for E2E Tests
 * Prepares the test environment for all end-to-end test suites
 */

const fs = require('fs').promises;
const path = require('path');

async function globalSetup() {
  console.log('🚀 Setting up E2E test environment...');
  
  try {
    // Create necessary directories
    await createTestDirectories();
    
    // Initialize test data
    await initializeTestData();
    
    // Setup mock hardware simulation
    await setupMockHardware();
    
    // Verify application can be launched
    await verifyApplicationSetup();
    
    console.log('✅ E2E test environment setup complete');
    
  } catch (error) {
    console.error('❌ E2E test environment setup failed:', error);
    process.exit(1);
  }
}

async function createTestDirectories() {
  const directories = [
    'tests/e2e/reports',
    'tests/e2e/screenshots',
    'tests/e2e/test-results',
    'tests/e2e/temp'
  ];
  
  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function initializeTestData() {
  const testDataPath = path.join(__dirname, 'temp', 'test-config.yaml');
  const testConfig = `
# Test Configuration for E2E Tests
serial:
  mockPort: 'MOCK_PORT'
  baudRate: 115200

hardware:
  buttons: 16
  encoders: 2
  mockHardware: true

profiles:
  test_profile:
    name: "E2E Test Profile"
    buttons:
      1: { type: 'keyboard', value: 'ctrl+c', label: 'Copy' }
      2: { type: 'keyboard', value: 'ctrl+v', label: 'Paste' }
      3: { type: 'text', value: 'Hello E2E Test', label: 'Test Text' }

security:
  enabled: true
  mode: 'allowlist'
  allowedCommands: ['echo', 'ls', 'pwd', 'cat']
  
testing:
  enableMocking: true
  captureScreenshots: true
  recordVideo: false
`;
  
  await fs.writeFile(testDataPath, testConfig);
}

async function setupMockHardware() {
  // Create mock hardware state file
  const mockHardwarePath = path.join(__dirname, 'temp', 'mock-hardware.json');
  const mockHardwareState = {
    serialPorts: [
      {
        name: 'MOCK_PORT',
        manufacturer: 'Arduino',
        productId: '0043',
        vendorId: '2341',
        connected: true
      }
    ],
    buttons: Array.from({ length: 32 }, (_, i) => ({
      id: i + 1,
      pressed: false,
      lastPressed: null
    })),
    encoders: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      value: 0,
      direction: 'CW'
    }))
  };
  
  await fs.writeFile(mockHardwarePath, JSON.stringify(mockHardwareState, null, 2));
}

async function verifyApplicationSetup() {
  // Verify that the main application file exists
  const mainAppPath = path.join(__dirname, '../../src/main.js');
  
  try {
    await fs.access(mainAppPath);
  } catch (error) {
    throw new Error(`Main application file not found at ${mainAppPath}`);
  }
  
  // Verify that package.json exists and has required dependencies
  const packagePath = path.join(__dirname, '../../package.json');
  const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  
  const requiredDependencies = ['electron', 'serialport', 'js-yaml'];
  const missingDeps = requiredDependencies.filter(dep => 
    !packageContent.dependencies[dep] && !packageContent.devDependencies[dep]
  );
  
  if (missingDeps.length > 0) {
    throw new Error(`Missing required dependencies: ${missingDeps.join(', ')}`);
  }
}

module.exports = globalSetup;
const fs = require('fs');
const path = require('path');

describe('Version Automation Tests', () => {
  let packageJson;

  beforeAll(() => {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageFile = fs.readFileSync(packagePath, 'utf8');
    packageJson = JSON.parse(packageFile);
  });

  test('package.json has version field', () => {
    expect(packageJson).toHaveProperty('version');
    expect(typeof packageJson.version).toBe('string');
  });

  test('version follows semantic versioning format', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect(packageJson.version).toMatch(semverRegex);
  });

  test('version parsing works correctly', () => {
    const versionParts = packageJson.version.split('.');
    expect(versionParts).toHaveLength(3);
    expect(parseInt(versionParts[0])).toBeGreaterThanOrEqual(0);
    expect(parseInt(versionParts[1])).toBeGreaterThanOrEqual(0);
    expect(parseInt(versionParts[2])).toBeGreaterThanOrEqual(0);
  });

  test('ci workflow file exists and has auto-release job', () => {
    const ciPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    
    const ciContent = fs.readFileSync(ciPath, 'utf8');
    expect(ciContent).toContain('auto-release:');
    expect(ciContent).toContain('Automatic Release');
    expect(ciContent).toContain('npm version');
  });
});
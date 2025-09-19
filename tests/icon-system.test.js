/**
 * Icon System Tests
 * 
 * Tests for application icon generation, validation, and integration
 */

const fs = require('fs');
const path = require('path');
const { generateIcons, validateIconSetup } = require('../scripts/generate-icons');

describe('Icon System', () => {
  const assetsPath = path.join(__dirname, '..', 'src', 'assets');
  
  describe('Icon Generation', () => {
    beforeAll(async () => {
      // Ensure test environment has proper setup
      if (!fs.existsSync(path.join(__dirname, '..', 'scripts'))) {
        fs.mkdirSync(path.join(__dirname, '..', 'scripts'), { recursive: true });
      }
    });

    test('should have SVG source files', () => {
      const iconSourcePath = path.join(assetsPath, 'icon-source.svg');
      const trayIconPath = path.join(assetsPath, 'tray-icon.svg');
      
      expect(fs.existsSync(iconSourcePath)).toBe(true);
      expect(fs.existsSync(trayIconPath)).toBe(true);
    });

    test('should validate SVG file structure', () => {
      const iconSourcePath = path.join(assetsPath, 'icon-source.svg');
      const iconContent = fs.readFileSync(iconSourcePath, 'utf8');
      
      // Check for basic SVG structure
      expect(iconContent).toContain('<svg');
      expect(iconContent).toContain('viewBox="0 0 512 512"');
      expect(iconContent).toContain('</svg>');
    });

    test('should generate all required icon formats', async () => {
      await generateIcons();
      
      const requiredFiles = [
        'icon.png',
        'icon.ico',
        'icon-16x16.png',
        'icon-32x32.png',
        'icon-48x48.png',
        'icon-64x64.png',
        'icon-128x128.png',
        'icon-256x256.png',
        'icon-512x512.png',
        'tray-16x16.png',
        'tray-32x32.png'
      ];
      
      requiredFiles.forEach(file => {
        const filepath = path.join(assetsPath, file);
        expect(fs.existsSync(filepath)).toBe(true);
      });
    });

    test('should validate icon setup', () => {
      const isValid = validateIconSetup();
      expect(isValid).toBe(true);
    });
  });

  describe('Package Configuration', () => {
    test('should have icon configuration in package.json', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check build configuration
      expect(packageJson.build).toBeDefined();
      expect(packageJson.build.icon).toBe('src/assets/icon.png');
      
      // Platform-specific icons
      expect(packageJson.build.mac.icon).toBe('src/assets/icon.png');
      expect(packageJson.build.win.icon).toBe('src/assets/icon.ico');
      expect(packageJson.build.linux.icon).toBe('src/assets/icon.png');
    });

    test('should have icon generation scripts', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageJson.scripts['icons:generate']).toBeDefined();
      expect(packageJson.scripts['icons:validate']).toBeDefined();
      expect(packageJson.scripts.prebuild).toContain('npm run icons:generate');
    });

    test('should have sharp dependency', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageJson.devDependencies.sharp).toBeDefined();
    });
  });

  describe('Main Process Integration', () => {
    test('should configure tray icons correctly', () => {
      const mainPath = path.join(__dirname, '..', 'src', 'main.js');
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      
      // Check for proper tray icon paths in tray creation methods
      expect(mainContent).toContain('tray-32x32.png');
      expect(mainContent).toContain('createMacTray()');
      expect(mainContent).toContain('createWindowsTray()');
      
      // Ensure tray uses specific tray icons, not main app icon
      const createMacTraySection = mainContent.match(/createMacTray\(\)\s*{[^}]*}/s);
      const createWindowsTraySection = mainContent.match(/createWindowsTray\(\)\s*{[^}]*}/s);
      
      if (createMacTraySection) {
        expect(createMacTraySection[0]).toContain('tray-32x32.png');
      }
      if (createWindowsTraySection) {
        expect(createWindowsTraySection[0]).toContain('tray-32x32.png');
      }
    });

    test('should handle cross-platform icon paths', () => {
      const mainPath = path.join(__dirname, '..', 'src', 'main.js');
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      
      // Check for path.join usage (cross-platform)
      expect(mainContent).toContain('path.join(__dirname, \'assets\'');
    });
  });

  describe('Icon Quality Standards', () => {
    test('should have appropriate icon sizes', () => {
      const iconSizes = [16, 32, 48, 64, 128, 256, 512];
      
      iconSizes.forEach(size => {
        const iconPath = path.join(assetsPath, `icon-${size}x${size}.png`);
        expect(fs.existsSync(iconPath)).toBe(true);
      });
    });

    test('should have system tray icons', () => {
      const trayIconPath16 = path.join(assetsPath, 'tray-16x16.png');
      const trayIconPath32 = path.join(assetsPath, 'tray-32x32.png');
      
      expect(fs.existsSync(trayIconPath16)).toBe(true);
      expect(fs.existsSync(trayIconPath32)).toBe(true);
    });

    test('should have Windows ICO file', () => {
      const icoPath = path.join(assetsPath, 'icon.ico');
      expect(fs.existsSync(icoPath)).toBe(true);
    });
  });

  describe('Production Readiness', () => {
    test('should be ready for electron-builder', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check electron-builder can find icons
      const iconPath = packageJson.build.icon;
      const fullIconPath = path.join(__dirname, '..', iconPath);
      expect(fs.existsSync(fullIconPath)).toBe(true);
    });

    test('should support prebuild hook', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      expect(packageJson.scripts.prebuild).toBe('npm run icons:generate');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing SVG sources gracefully', async () => {
      // Mock missing files scenario
      const originalExists = fs.existsSync;
      const mockExists = jest.spyOn(fs, 'existsSync');
      
      mockExists.mockImplementation((path) => {
        if (path.includes('icon-source.svg')) return false;
        return originalExists(path);
      });
      
      await expect(generateIcons()).rejects.toThrow('Icon source not found');
      
      mockExists.mockRestore();
    });

    test('should validate required files exist', () => {
      // This test ensures validateIconSetup works correctly
      const isValid = validateIconSetup();
      expect(typeof isValid).toBe('boolean');
    });
  });
});
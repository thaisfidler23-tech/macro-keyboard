/**
 * macOS Application Detector
 * macOS-specific implementation for detecting active applications and window information
 */

const ApplicationDetector = require('./ApplicationDetector');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class MacOSApplicationDetector extends ApplicationDetector {
  constructor(logger) {
    super(logger);
    this.platform = 'darwin';

    // AppleScript commands for application detection
    this.commands = {
      // Get frontmost application with detailed information
      activeApplication: `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set frontAppName to name of frontApp
          set frontAppPID to unix id of frontApp
          set frontAppBundle to bundle identifier of frontApp

          try
            set windowTitle to title of front window of frontApp
          on error
            set windowTitle to ""
          end try

          return "{" & quote & "processName" & quote & ":" & quote & frontAppName & quote & "," & ¬
                      quote & "processId" & quote & ":" & frontAppPID & "," & ¬
                      quote & "windowTitle" & quote & ":" & quote & windowTitle & quote & "," & ¬
                      quote & "bundleId" & quote & ":" & quote & frontAppBundle & quote & "}"
        end tell
      `,

      // Alternative method using NSWorkspace (requires different approach)
      activeApplicationAlt: `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          return frontApp
        end tell
      `,

      // Get window title of active application
      activeWindowTitle: `
        tell application "System Events"
          tell process (name of first application process whose frontmost is true)
            try
              set windowTitle to title of front window
              return windowTitle
            on error
              return ""
            end try
          end tell
        end tell
      `,

      // Get all applications with windows
      allApplicationsWithWindows: `
        tell application "System Events"
          set appList to {}
          set allProcesses to every application process whose visible is true
          repeat with proc in allProcesses
            try
              set procName to name of proc
              set procPID to unix id of proc
              set windowTitles to {}
              try
                set windowTitles to title of every window of proc
              end try
              if length of windowTitles > 0 then
                set appList to appList & {procName & "|" & procPID & "|" & (item 1 of windowTitles)}
              end if
            end try
          end repeat
          return appList
        end tell
      `
    };

    this.initialized = false;
  }

  /**
   * Initialize macOS-specific detection capabilities
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Test AppleScript availability
      await this.testAppleScriptCapabilities();
      this.initialized = true;
      this.logger.info('macOS application detector initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize macOS application detector:', error);
      throw error;
    }
  }

  /**
   * Test AppleScript capabilities and accessibility permissions
   */
  async testAppleScriptCapabilities() {
    try {
      // Test basic AppleScript execution
      await execAsync('osascript -e "tell application \\"System Events\\" to get name of first application process whose frontmost is true"');

      // Test if we can access window information (requires accessibility permissions)
      try {
        await execAsync('osascript -e "tell application \\"System Events\\" to tell process (name of first application process whose frontmost is true) to get title of front window"', { timeout: 3000 });
      } catch (error) {
        this.logger.warn('Window title access may require accessibility permissions:', error.message);
      }

      return true;
    } catch (error) {
      throw new Error(`AppleScript test failed: ${error.message}. You may need to grant accessibility permissions.`);
    }
  }

  /**
   * Execute AppleScript and return result
   */
  async executeAppleScript(script) {
    try {
      const { stdout, stderr } = await execAsync(`osascript -e "${script}"`, { timeout: 5000 });

      if (stderr) {
        this.logger.warn('AppleScript stderr output:', stderr);
      }

      return stdout.trim();
    } catch (error) {
      this.logger.error('AppleScript execution failed:', error);
      throw error;
    }
  }

  /**
   * Get current active application information
   */
  async getCurrentApplication() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Try to get detailed information using custom AppleScript
      const result = await this.executeAppleScript(this.commands.activeApplication);

      if (!result) {
        return null;
      }

      // Parse the JSON-like result from AppleScript
      let applicationInfo;
      try {
        applicationInfo = JSON.parse(result);
      } catch (parseError) {
        // Fallback to simpler method if JSON parsing fails
        this.logger.warn('Failed to parse AppleScript JSON, using fallback method');
        return await this.getApplicationFallback();
      }

      // Get additional information using system commands
      const additionalInfo = await this.getAdditionalAppInfo(applicationInfo.processId, applicationInfo.bundleId);

      const normalizedInfo = {
        processName: applicationInfo.processName || 'Unknown',
        processId: parseInt(applicationInfo.processId, 10) || 0,
        windowTitle: applicationInfo.windowTitle || '',
        bundleId: applicationInfo.bundleId || '',
        executablePath: additionalInfo.executablePath || '',
        version: additionalInfo.version || '',
        startTime: additionalInfo.startTime || '',
        memoryUsage: additionalInfo.memoryUsage || 0,
        cpuUsage: additionalInfo.cpuUsage || 0,
        platform: 'darwin',
        timestamp: Date.now()
      };

      this.logger.debug('Detected macOS application:', normalizedInfo);
      return normalizedInfo;
    } catch (error) {
      this.logger.error('Error detecting macOS application:', error);

      // Fallback to simpler method
      try {
        return await this.getApplicationFallback();
      } catch (fallbackError) {
        this.logger.error('Fallback detection also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Get additional application information using system commands
   */
  async getAdditionalAppInfo(processId, bundleId) {
    const info = {
      executablePath: '',
      version: '',
      startTime: '',
      memoryUsage: 0,
      cpuUsage: 0
    };

    try {
      // Get process information using ps
      const { stdout: psOutput } = await execAsync(`ps -p ${processId} -o pid,ppid,etime,pcpu,rss,comm`);
      const lines = psOutput.trim().split('\n');
      if (lines.length > 1) {
        const processLine = lines[1].trim().split(/\s+/);
        if (processLine.length >= 5) {
          info.cpuUsage = parseFloat(processLine[3]) || 0;
          info.memoryUsage = parseInt(processLine[4], 10) * 1024 || 0; // Convert KB to bytes
          info.startTime = processLine[2] || '';
        }
      }
    } catch (error) {
      this.logger.debug('Error getting ps information:', error);
    }

    try {
      // Get application bundle information
      if (bundleId) {
        const { stdout: bundleOutput } = await execAsync(`mdfind "kMDItemCFBundleIdentifier == '${bundleId}'" | head -1`);
        const bundlePath = bundleOutput.trim();

        if (bundlePath) {
          info.executablePath = bundlePath;

          // Get version information from Info.plist
          try {
            const { stdout: versionOutput } = await execAsync(`defaults read "${bundlePath}/Contents/Info" CFBundleShortVersionString 2>/dev/null || defaults read "${bundlePath}/Contents/Info" CFBundleVersion`);
            info.version = versionOutput.trim();
          } catch (versionError) {
            this.logger.debug('Error getting version info:', versionError);
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error getting bundle information:', error);
    }

    return info;
  }

  /**
   * Fallback method using simpler AppleScript
   */
  async getApplicationFallback() {
    try {
      const appName = await this.executeAppleScript(this.commands.activeApplicationAlt);

      if (!appName) {
        return null;
      }

      // Get additional information
      let windowTitle = '';
      let processId = 0;
      let bundleId = '';

      try {
        windowTitle = await this.executeAppleScript(this.commands.activeWindowTitle);
      } catch (error) {
        this.logger.debug('Could not get window title:', error);
      }

      try {
        const pidResult = await this.executeAppleScript(`tell application "System Events" to get unix id of first application process whose name is "${appName}"`);
        processId = parseInt(pidResult, 10) || 0;
      } catch (error) {
        this.logger.debug('Could not get process ID:', error);
      }

      try {
        bundleId = await this.executeAppleScript(`tell application "System Events" to get bundle identifier of first application process whose name is "${appName}"`);
      } catch (error) {
        this.logger.debug('Could not get bundle ID:', error);
      }

      return {
        processName: appName,
        processId,
        windowTitle,
        bundleId,
        executablePath: '',
        platform: 'darwin',
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Fallback detection failed:', error);
      return null;
    }
  }

  /**
   * Get list of all applications with windows
   */
  async getAllApplicationsWithWindows() {
    try {
      const result = await this.executeAppleScript(this.commands.allApplicationsWithWindows);

      if (!result) {
        return [];
      }

      // Parse the result (format: "AppName|PID|WindowTitle")
      const appLines = result.split(',').map(line => line.trim());
      const applications = [];

      for (const line of appLines) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          applications.push({
            processName: parts[0],
            processId: parseInt(parts[1], 10) || 0,
            windowTitle: parts[2] || '',
            platform: 'darwin'
          });
        }
      }

      return applications;
    } catch (error) {
      this.logger.error('Error getting all applications with windows:', error);
      return [];
    }
  }

  /**
   * Check if a specific application is running
   */
  async isApplicationRunning(processName) {
    try {
      const script = `tell application "System Events" to exists application process "${processName}"`;
      const result = await this.executeAppleScript(script);

      return result === 'true';
    } catch (error) {
      this.logger.error(`Error checking if ${processName} is running:`, error);
      return false;
    }
  }

  /**
   * Get detailed process information
   */
  async getProcessInfo(processId) {
    try {
      const { stdout } = await execAsync(`ps -p ${processId} -o pid,ppid,etime,pcpu,rss,comm,args`);
      const lines = stdout.trim().split('\n');

      if (lines.length > 1) {
        const processLine = lines[1].trim();
        const parts = processLine.split(/\s+/);

        if (parts.length >= 6) {
          return {
            processId: parseInt(parts[0], 10) || 0,
            parentProcessId: parseInt(parts[1], 10) || 0,
            elapsedTime: parts[2] || '',
            cpuUsage: parseFloat(parts[3]) || 0,
            memoryUsage: parseInt(parts[4], 10) * 1024 || 0, // Convert KB to bytes
            processName: parts[5] || 'Unknown',
            commandLine: parts.slice(6).join(' ') || '',
            platform: 'darwin'
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting process info for PID ${processId}:`, error);
      return null;
    }
  }

  /**
   * Get application bundle information
   */
  async getBundleInfo(bundleId) {
    try {
      const { stdout } = await execAsync(`mdfind "kMDItemCFBundleIdentifier == '${bundleId}'" | head -1`);
      const bundlePath = stdout.trim();

      if (!bundlePath) {
        return null;
      }

      const bundleInfo = {
        bundleId,
        bundlePath,
        version: '',
        displayName: ''
      };

      // Get version information
      try {
        const { stdout: versionOutput } = await execAsync(`defaults read "${bundlePath}/Contents/Info" CFBundleShortVersionString 2>/dev/null || defaults read "${bundlePath}/Contents/Info" CFBundleVersion`);
        bundleInfo.version = versionOutput.trim();
      } catch (error) {
        this.logger.debug('Could not get version info:', error);
      }

      // Get display name
      try {
        const { stdout: nameOutput } = await execAsync(`defaults read "${bundlePath}/Contents/Info" CFBundleDisplayName 2>/dev/null || defaults read "${bundlePath}/Contents/Info" CFBundleName`);
        bundleInfo.displayName = nameOutput.trim();
      } catch (error) {
        this.logger.debug('Could not get display name:', error);
      }

      return bundleInfo;
    } catch (error) {
      this.logger.error(`Error getting bundle info for ${bundleId}:`, error);
      return null;
    }
  }
}

module.exports = MacOSApplicationDetector;

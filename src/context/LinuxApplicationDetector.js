/**
 * Linux Application Detector
 * Linux-specific implementation for detecting active applications and window information
 */

const ApplicationDetector = require('./ApplicationDetector');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class LinuxApplicationDetector extends ApplicationDetector {
  constructor(logger) {
    super(logger);
    this.platform = 'linux';

    this.detectionMethod = null;
    this.availableMethods = [];

    this.initialized = false;
  }

  /**
   * Initialize Linux-specific detection capabilities
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.detectAvailableMethods();
      await this.selectBestDetectionMethod();

      this.initialized = true;
      this.logger.info(`Linux application detector initialized with method: ${this.detectionMethod}`);
    } catch (error) {
      this.logger.error('Failed to initialize Linux application detector:', error);
      throw error;
    }
  }

  /**
   * Detect available detection methods on this Linux system
   */
  async detectAvailableMethods() {
    const methods = [];

    // Test X11-based methods
    try {
      await execAsync('which xdotool', { timeout: 2000 });
      methods.push('xdotool');
    } catch (error) {
      // xdotool not available
    }

    try {
      await execAsync('which xprop', { timeout: 2000 });
      methods.push('xprop');
    } catch (error) {
      // xprop not available
    }

    try {
      await execAsync('which wmctrl', { timeout: 2000 });
      methods.push('wmctrl');
    } catch (error) {
      // wmctrl not available
    }

    // Test Wayland-based methods
    try {
      if (process.env.WAYLAND_DISPLAY) {
        // Check for Wayland-specific tools
        try {
          await execAsync('which swaymsg', { timeout: 2000 });
          methods.push('sway');
        } catch (error) {
          // sway not available
        }

        try {
          await execAsync('gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "null"', { timeout: 2000 });
          methods.push('gnome-shell');
        } catch (error) {
          // GNOME Shell D-Bus interface not available
        }
      }
    } catch (error) {
      // Wayland detection failed
    }

    // Fallback method using /proc filesystem
    methods.push('proc-fallback');

    this.availableMethods = methods;
    this.logger.debug('Available detection methods:', methods);
  }

  /**
   * Select the best detection method based on available tools and environment
   */
  async selectBestDetectionMethod() {
    // Priority order for detection methods
    const methodPriority = ['xdotool', 'wmctrl', 'xprop', 'sway', 'gnome-shell', 'proc-fallback'];

    for (const method of methodPriority) {
      if (this.availableMethods.includes(method)) {
        this.detectionMethod = method;
        return;
      }
    }

    throw new Error('No suitable detection method available');
  }

  /**
   * Get current active application information
   */
  async getCurrentApplication() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let applicationInfo = null;

      switch (this.detectionMethod) {
      case 'xdotool':
        applicationInfo = await this.getApplicationXdotool();
        break;
      case 'wmctrl':
        applicationInfo = await this.getApplicationWmctrl();
        break;
      case 'xprop':
        applicationInfo = await this.getApplicationXprop();
        break;
      case 'sway':
        applicationInfo = await this.getApplicationSway();
        break;
      case 'gnome-shell':
        applicationInfo = await this.getApplicationGnomeShell();
        break;
      case 'proc-fallback':
        applicationInfo = await this.getApplicationProcFallback();
        break;
      default:
        throw new Error(`Unknown detection method: ${this.detectionMethod}`);
      }

      if (applicationInfo) {
        applicationInfo.platform = 'linux';
        applicationInfo.timestamp = Date.now();
        this.logger.debug('Detected Linux application:', applicationInfo);
      }

      return applicationInfo;
    } catch (error) {
      this.logger.error('Error detecting Linux application:', error);
      return null;
    }
  }

  /**
   * Get application information using xdotool
   */
  async getApplicationXdotool() {
    try {
      // Get active window ID
      const { stdout: windowId } = await execAsync('xdotool getactivewindow', { timeout: 3000 });
      const activeWindowId = windowId.trim();

      if (!activeWindowId) {
        return null;
      }

      // Get window information
      const { stdout: windowInfo } = await execAsync(`xdotool getwindowname ${activeWindowId}`, { timeout: 3000 });
      const windowTitle = windowInfo.trim();

      // Get process ID
      const { stdout: pidInfo } = await execAsync(`xdotool getwindowpid ${activeWindowId}`, { timeout: 3000 });
      const processId = parseInt(pidInfo.trim(), 10) || 0;

      // Get process information
      const processInfo = await this.getProcessInfoFromPID(processId);

      return {
        processName: processInfo?.name || 'Unknown',
        processId,
        windowTitle,
        windowId: activeWindowId,
        executablePath: processInfo?.executable || '',
        commandLine: processInfo?.commandLine || '',
        startTime: processInfo?.startTime || '',
        memoryUsage: processInfo?.memoryUsage || 0,
        cpuTime: processInfo?.cpuTime || 0
      };
    } catch (error) {
      this.logger.error('xdotool detection failed:', error);
      return null;
    }
  }

  /**
   * Get application information using wmctrl
   */
  async getApplicationWmctrl() {
    try {
      // Get list of windows and find the active one
      const { stdout: windowList } = await execAsync('wmctrl -l -p', { timeout: 3000 });
      const lines = windowList.trim().split('\n');

      // Get active window ID using xprop
      const { stdout: activeWindowOutput } = await execAsync('xprop -root _NET_ACTIVE_WINDOW', { timeout: 3000 });
      const activeWindowMatch = activeWindowOutput.match(/0x[0-9a-fA-F]+/);

      if (!activeWindowMatch) {
        return null;
      }

      const activeWindowId = activeWindowMatch[0];
      const activeWindowIdDecimal = parseInt(activeWindowId, 16);

      // Find the active window in the list
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const windowIdDecimal = parseInt(parts[0], 16);

          if (windowIdDecimal === activeWindowIdDecimal) {
            const processId = parseInt(parts[2], 10) || 0;
            const windowTitle = parts.slice(4).join(' ');

            // Get process information
            const processInfo = await this.getProcessInfoFromPID(processId);

            return {
              processName: processInfo?.name || 'Unknown',
              processId,
              windowTitle,
              windowId: parts[0],
              executablePath: processInfo?.executable || '',
              commandLine: processInfo?.commandLine || '',
              startTime: processInfo?.startTime || '',
              memoryUsage: processInfo?.memoryUsage || 0,
              cpuTime: processInfo?.cpuTime || 0
            };
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('wmctrl detection failed:', error);
      return null;
    }
  }

  /**
   * Get application information using xprop
   */
  async getApplicationXprop() {
    try {
      // Get active window ID
      const { stdout: activeWindowOutput } = await execAsync('xprop -root _NET_ACTIVE_WINDOW', { timeout: 3000 });
      const windowIdMatch = activeWindowOutput.match(/0x[0-9a-fA-F]+/);

      if (!windowIdMatch) {
        return null;
      }

      const windowId = windowIdMatch[0];

      // Get window properties
      const { stdout: windowProps } = await execAsync(`xprop -id ${windowId} WM_NAME _NET_WM_NAME _NET_WM_PID`, { timeout: 3000 });

      // Parse window title
      let windowTitle = '';
      const nameMatch = windowProps.match(/_NET_WM_NAME\(UTF8_STRING\) = "(.*)"/);
      if (nameMatch) {
        windowTitle = nameMatch[1];
      } else {
        const wmNameMatch = windowProps.match(/WM_NAME\(STRING\) = "(.*)"/);
        if (wmNameMatch) {
          windowTitle = wmNameMatch[1];
        }
      }

      // Parse process ID
      const pidMatch = windowProps.match(/_NET_WM_PID\(CARDINAL\) = (\d+)/);
      const processId = pidMatch ? parseInt(pidMatch[1], 10) : 0;

      // Get process information
      const processInfo = await this.getProcessInfoFromPID(processId);

      return {
        processName: processInfo?.name || 'Unknown',
        processId,
        windowTitle,
        windowId,
        executablePath: processInfo?.executable || '',
        commandLine: processInfo?.commandLine || '',
        startTime: processInfo?.startTime || '',
        memoryUsage: processInfo?.memoryUsage || 0,
        cpuTime: processInfo?.cpuTime || 0
      };
    } catch (error) {
      this.logger.error('xprop detection failed:', error);
      return null;
    }
  }

  /**
   * Get application information using Sway (Wayland)
   */
  async getApplicationSway() {
    try {
      const { stdout: treeOutput } = await execAsync('swaymsg -t get_tree', { timeout: 3000 });
      const tree = JSON.parse(treeOutput);

      // Find focused window
      const focusedWindow = this.findFocusedWindow(tree);

      if (!focusedWindow || !focusedWindow.pid) {
        return null;
      }

      // Get process information
      const processInfo = await this.getProcessInfoFromPID(focusedWindow.pid);

      return {
        processName: processInfo?.name || focusedWindow.app_id || 'Unknown',
        processId: focusedWindow.pid,
        windowTitle: focusedWindow.name || '',
        windowId: focusedWindow.id?.toString() || '',
        executablePath: processInfo?.executable || '',
        commandLine: processInfo?.commandLine || '',
        startTime: processInfo?.startTime || '',
        memoryUsage: processInfo?.memoryUsage || 0,
        cpuTime: processInfo?.cpuTime || 0,
        appId: focusedWindow.app_id
      };
    } catch (error) {
      this.logger.error('Sway detection failed:', error);
      return null;
    }
  }

  /**
   * Find focused window in Sway tree
   */
  findFocusedWindow(node) {
    if (node.focused && node.pid) {
      return node;
    }

    if (node.nodes) {
      for (const child of node.nodes) {
        const result = this.findFocusedWindow(child);
        if (result) {
          return result;
        }
      }
    }

    if (node.floating_nodes) {
      for (const child of node.floating_nodes) {
        const result = this.findFocusedWindow(child);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Get application information using GNOME Shell D-Bus
   */
  async getApplicationGnomeShell() {
    try {
      // Get focused window info through GNOME Shell
      const script = `
        global.get_window_actors().forEach(actor => {
          let window = actor.get_meta_window();
          if (window.has_focus()) {
            log(JSON.stringify({
              title: window.get_title(),
              wm_class: window.get_wm_class(),
              pid: window.get_pid()
            }));
          }
        });
      `;

      const { stdout } = await execAsync(`gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "${script}"`, { timeout: 5000 });

      // Parse the result (this is a simplified approach)
      // In a real implementation, you'd need to handle the D-Bus response format properly

      return null; // Placeholder - this method needs more complex implementation
    } catch (error) {
      this.logger.error('GNOME Shell detection failed:', error);
      return null;
    }
  }

  /**
   * Get application information using /proc filesystem (fallback)
   */
  async getApplicationProcFallback() {
    try {
      // This is a very basic fallback that tries to find processes with GUI components
      // It's not perfect but provides some information when other methods fail

      const { stdout: psOutput } = await execAsync('ps aux --sort=-%cpu | grep -E "(X11|wayland|gnome|kde|xfce)" | head -1', { timeout: 3000 });

      if (!psOutput.trim()) {
        return null;
      }

      const processLine = psOutput.trim().split(/\s+/);
      const processId = parseInt(processLine[1], 10) || 0;

      if (processId === 0) {
        return null;
      }

      // Get process information
      const processInfo = await this.getProcessInfoFromPID(processId);

      return {
        processName: processInfo?.name || 'Unknown',
        processId,
        windowTitle: 'Unknown',
        windowId: '',
        executablePath: processInfo?.executable || '',
        commandLine: processInfo?.commandLine || '',
        startTime: processInfo?.startTime || '',
        memoryUsage: processInfo?.memoryUsage || 0,
        cpuTime: processInfo?.cpuTime || 0
      };
    } catch (error) {
      this.logger.error('Proc fallback detection failed:', error);
      return null;
    }
  }

  /**
   * Get detailed process information from /proc filesystem
   */
  async getProcessInfoFromPID(pid) {
    if (!pid || pid === 0) {
      return null;
    }

    try {
      const procPath = `/proc/${pid}`;

      // Check if process exists
      try {
        await fs.access(procPath);
      } catch (error) {
        return null;
      }

      const processInfo = {
        name: '',
        executable: '',
        commandLine: '',
        startTime: '',
        memoryUsage: 0,
        cpuTime: 0
      };

      // Get process name
      try {
        const commContent = await fs.readFile(`${procPath}/comm`, 'utf8');
        processInfo.name = commContent.trim();
      } catch (error) {
        // Ignore
      }

      // Get executable path
      try {
        const exePath = await fs.readlink(`${procPath}/exe`);
        processInfo.executable = exePath;
      } catch (error) {
        // Ignore
      }

      // Get command line
      try {
        const cmdlineContent = await fs.readFile(`${procPath}/cmdline`, 'utf8');
        processInfo.commandLine = cmdlineContent.replace(/\0/g, ' ').trim();
      } catch (error) {
        // Ignore
      }

      // Get memory usage
      try {
        const statusContent = await fs.readFile(`${procPath}/status`, 'utf8');
        const vmRSSMatch = statusContent.match(/VmRSS:\s+(\d+)\s+kB/);
        if (vmRSSMatch) {
          processInfo.memoryUsage = parseInt(vmRSSMatch[1], 10) * 1024; // Convert KB to bytes
        }
      } catch (error) {
        // Ignore
      }

      // Get CPU time
      try {
        const statContent = await fs.readFile(`${procPath}/stat`, 'utf8');
        const statFields = statContent.split(' ');
        if (statFields.length > 13) {
          const utime = parseInt(statFields[13], 10) || 0;
          const stime = parseInt(statFields[14], 10) || 0;
          processInfo.cpuTime = utime + stime;
        }
      } catch (error) {
        // Ignore
      }

      return processInfo;
    } catch (error) {
      this.logger.error(`Error getting process info for PID ${pid}:`, error);
      return null;
    }
  }

  /**
   * Get list of all applications with windows
   */
  async getAllApplicationsWithWindows() {
    try {
      if (this.detectionMethod === 'wmctrl') {
        const { stdout: windowList } = await execAsync('wmctrl -l -p', { timeout: 5000 });
        const lines = windowList.trim().split('\n');
        const applications = [];

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            const windowId = parts[0];
            const processId = parseInt(parts[2], 10) || 0;
            const windowTitle = parts.slice(4).join(' ');

            const processInfo = await this.getProcessInfoFromPID(processId);

            applications.push({
              processName: processInfo?.name || 'Unknown',
              processId,
              windowTitle,
              windowId,
              executablePath: processInfo?.executable || '',
              platform: 'linux'
            });
          }
        }

        return applications;
      }

      return [];
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
      const { stdout } = await execAsync(`pgrep -f "${processName}"`, { timeout: 3000 });
      return stdout.trim() !== '';
    } catch (error) {
      // pgrep returns non-zero exit code when no matches found
      return false;
    }
  }
}

module.exports = LinuxApplicationDetector;

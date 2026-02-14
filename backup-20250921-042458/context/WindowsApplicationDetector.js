/**
 * Windows Application Detector
 * Windows-specific implementation for detecting active applications and window information
 */

const ApplicationDetector = require('./ApplicationDetector');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class WindowsApplicationDetector extends ApplicationDetector {
  constructor(logger) {
    super(logger);
    this.platform = 'win32';

    // PowerShell commands for application detection
    this.commands = {
      // Get foreground window and process information
      activeApplication: `
        Add-Type -AssemblyName System.Windows.Forms;
        $hwnd = [System.Windows.Forms.Control]::FromHandle([System.IntPtr]::Zero).Handle;
        Add-Type @'
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class Win32 {
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")]
            public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          }
'@;

        $hwnd = [Win32]::GetForegroundWindow();
        $processId = 0;
        [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId);

        $windowTitle = New-Object System.Text.StringBuilder 256;
        [Win32]::GetWindowText($hwnd, $windowTitle, 256);

        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue;

        if ($process) {
          $result = @{
            ProcessName = $process.ProcessName;
            ProcessId = $process.Id;
            WindowTitle = $windowTitle.ToString();
            ExecutablePath = try { $process.MainModule.FileName } catch { "" };
            CompanyName = try { $process.Company } catch { "" };
            ProductName = try { $process.Product } catch { "" };
            FileVersion = try { $process.FileVersion } catch { "" };
            StartTime = try { $process.StartTime.ToString('o') } catch { "" };
            WorkingSet = $process.WorkingSet64;
            HandleCount = $process.HandleCount;
          };
          $result | ConvertTo-Json -Compress;
        } else {
          '{"ProcessName":"Unknown","ProcessId":0,"WindowTitle":"","ExecutablePath":""}' | ConvertTo-Json -Compress;
        }
      `,

      // Alternative method using WMI (slower but more reliable for some scenarios)
      activeApplicationWMI: `
        $foregroundWindow = Add-Type -MemberDefinition @'
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        '@ -Name Win32 -PassThru;

        $hwnd = $foregroundWindow::GetForegroundWindow();
        $processId = 0;
        $foregroundWindow::GetWindowThreadProcessId($hwnd, [ref]$processId);

        $process = Get-WmiObject -Query "SELECT * FROM Win32_Process WHERE ProcessId = $processId";
        if ($process) {
          @{
            ProcessName = $process.Name -replace '\\.exe$', '';
            ProcessId = $process.ProcessId;
            WindowTitle = '';
            ExecutablePath = $process.ExecutablePath;
            CommandLine = $process.CommandLine;
            CreationDate = $process.CreationDate;
            WorkingSetSize = $process.WorkingSetSize;
          } | ConvertTo-Json -Compress;
        }
      `
    };

    this.initialized = false;
  }

  /**
   * Initialize Windows-specific detection capabilities
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Test PowerShell availability and execution policy
      await this.testPowerShellCapabilities();
      this.initialized = true;
      this.logger.info('Windows application detector initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Windows application detector:', error);
      throw error;
    }
  }

  /**
   * Test PowerShell capabilities and execution policy
   */
  async testPowerShellCapabilities() {
    try {
      // Test basic PowerShell execution
      const { stdout } = await execAsync('powershell -Command "Get-ExecutionPolicy"');
      const executionPolicy = stdout.trim();

      this.logger.debug(`PowerShell execution policy: ${executionPolicy}`);

      // Test if we can load .NET assemblies
      await execAsync(
        'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; Write-Host \\"OK\\""'
      );

      return true;
    } catch (error) {
      throw new Error(`PowerShell test failed: ${error.message}`);
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
      const { stdout, stderr } = await execAsync(
        `powershell -Command "${this.commands.activeApplication.replace(/\n\s*/g, ' ')}"`,
        { timeout: 5000 }
      );

      if (stderr) {
        this.logger.warn('PowerShell stderr output:', stderr);
      }

      if (!stdout.trim()) {
        return null;
      }

      const applicationInfo = JSON.parse(stdout.trim());

      // Normalize and validate the data
      const normalizedInfo = {
        processName: applicationInfo.ProcessName || 'Unknown',
        processId: parseInt(applicationInfo.ProcessId, 10) || 0,
        windowTitle: applicationInfo.WindowTitle || '',
        executablePath: applicationInfo.ExecutablePath || '',
        companyName: applicationInfo.CompanyName || '',
        productName: applicationInfo.ProductName || '',
        fileVersion: applicationInfo.FileVersion || '',
        startTime: applicationInfo.StartTime || '',
        workingSet: parseInt(applicationInfo.WorkingSet, 10) || 0,
        handleCount: parseInt(applicationInfo.HandleCount, 10) || 0,
        platform: 'win32',
        timestamp: Date.now()
      };

      this.logger.debug('Detected Windows application:', normalizedInfo);
      return normalizedInfo;
    } catch (error) {
      this.logger.error('Error detecting Windows application:', error);

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
   * Fallback method using simpler PowerShell commands
   */
  async getApplicationFallback() {
    try {
      const command =
        "powershell -Command \"Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1 | ForEach-Object { @{ ProcessName = $_.ProcessName; ProcessId = $_.Id; WindowTitle = $_.MainWindowTitle; ExecutablePath = try { $_.Path } catch { '' } } | ConvertTo-Json -Compress }\"";

      const { stdout } = await execAsync(command, { timeout: 3000 });

      if (!stdout.trim()) {
        return null;
      }

      const applicationInfo = JSON.parse(stdout.trim());

      return {
        processName: applicationInfo.ProcessName || 'Unknown',
        processId: parseInt(applicationInfo.ProcessId, 10) || 0,
        windowTitle: applicationInfo.WindowTitle || '',
        executablePath: applicationInfo.ExecutablePath || '',
        platform: 'win32',
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
      const command =
        "powershell -Command \"Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, Id, MainWindowTitle, @{Name='ExecutablePath'; Expression={try {$_.Path} catch {''}}} | ConvertTo-Json\"";

      const { stdout } = await execAsync(command, { timeout: 10000 });

      if (!stdout.trim()) {
        return [];
      }

      const applications = JSON.parse(stdout.trim());
      const appArray = Array.isArray(applications) ? applications : [applications];

      return appArray.map(app => ({
        processName: app.ProcessName || 'Unknown',
        processId: parseInt(app.Id, 10) || 0,
        windowTitle: app.MainWindowTitle || '',
        executablePath: app.ExecutablePath || '',
        platform: 'win32'
      }));
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
      const command = `powershell -Command "Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Select-Object -First 1 | ConvertTo-Json"`;

      const { stdout } = await execAsync(command, { timeout: 3000 });

      return stdout.trim() !== '';
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
      const command = `powershell -Command "Get-Process -Id ${processId} | Select-Object ProcessName, Id, MainWindowTitle, Company, Product, FileVersion, StartTime, WorkingSet64, HandleCount, @{Name='ExecutablePath'; Expression={try {$_.MainModule.FileName} catch {''}}} | ConvertTo-Json"`;

      const { stdout } = await execAsync(command, { timeout: 5000 });

      if (!stdout.trim()) {
        return null;
      }

      const processInfo = JSON.parse(stdout.trim());

      return {
        processName: processInfo.ProcessName || 'Unknown',
        processId: parseInt(processInfo.Id, 10) || 0,
        windowTitle: processInfo.MainWindowTitle || '',
        executablePath: processInfo.ExecutablePath || '',
        companyName: processInfo.Company || '',
        productName: processInfo.Product || '',
        fileVersion: processInfo.FileVersion || '',
        startTime: processInfo.StartTime || '',
        workingSet: parseInt(processInfo.WorkingSet64, 10) || 0,
        handleCount: parseInt(processInfo.HandleCount, 10) || 0,
        platform: 'win32'
      };
    } catch (error) {
      this.logger.error(`Error getting process info for PID ${processId}:`, error);
      return null;
    }
  }
}

module.exports = WindowsApplicationDetector;

/**
 * System Resource Monitor
 * 
 * Monitors system resources including:
 * - CPU usage and temperature
 * - Memory usage
 * - Disk usage and I/O
 * - Network throughput
 * 
 * @module SystemResourceMonitor
 */

const EventEmitter = require('events');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SystemResourceMonitor extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      pollInterval: config.pollInterval || 5000,
      cpuThreshold: config.cpuThreshold || 80,
      memoryThreshold: config.memoryThreshold || 85,
      diskThreshold: config.diskThreshold || 90,
      platform: config.platform || process.platform,
      historySize: config.historySize || 60,
      ...config
    };
    
    this.currentState = {
      cpu: { usage: 0, temperature: null, cores: [] },
      memory: { used: 0, total: 0, percentage: 0 },
      disk: { used: 0, total: 0, percentage: 0 },
      network: { bytesIn: 0, bytesOut: 0, rateIn: 0, rateOut: 0 }
    };
    
    this.history = {
      cpu: [],
      memory: [],
      disk: [],
      network: []
    };
    
    this.previousNetwork = null;
    this.previousCpuTimes = null;
    this.pollTimer = null;
    this.running = false;
    
    this.alerts = {
      cpuHigh: false,
      memoryHigh: false,
      diskHigh: false
    };
    
    this.statistics = {
      highCpuEvents: 0,
      highMemoryEvents: 0,
      highDiskEvents: 0,
      averageCpu: 0,
      averageMemory: 0
    };
  }

  /**
   * Start monitoring resources
   */
  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger?.info('Starting system resource monitor');

    // Get initial state
    await this._updateResourceState();

    // Start polling
    this.pollTimer = setInterval(async () => {
      await this._updateResourceState();
    }, this.config.pollInterval);

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.logger?.info('System resource monitor stopped');
    this.emit('stopped');
  }

  /**
   * Update resource state
   */
  async _updateResourceState() {
    try {
      await this._updateCPU();
      await this._updateMemory();
      await this._updateDisk();
      await this._updateNetwork();

      // Update history
      this._updateHistory();

      // Check thresholds
      this._checkThresholds();

      // Emit update event
      this.emit('update', this.getState());
    } catch (error) {
      this.logger?.error('Failed to update resource state', error);
    }
  }

  /**
   * Update CPU information
   */
  async _updateCPU() {
    const cpus = os.cpus();
    
    // Calculate CPU usage
    const currentTimes = cpus.map(cpu => ({
      idle: cpu.times.idle,
      total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle
    }));

    if (this.previousCpuTimes) {
      let totalIdle = 0;
      let totalDelta = 0;

      for (let i = 0; i < currentTimes.length; i++) {
        const prev = this.previousCpuTimes[i];
        const curr = currentTimes[i];
        
        const idleDelta = curr.idle - prev.idle;
        const totalCpuDelta = curr.total - prev.total;
        
        totalIdle += idleDelta;
        totalDelta += totalCpuDelta;
      }

      this.currentState.cpu.usage = totalDelta > 0 
        ? Math.round((1 - totalIdle / totalDelta) * 100)
        : 0;
    }

    this.previousCpuTimes = currentTimes;

    // Update core info
    this.currentState.cpu.cores = cpus.map((cpu, index) => ({
      index,
      model: cpu.model,
      speed: cpu.speed
    }));

    // Get CPU temperature (platform specific)
    await this._getCPUTemperature();
  }

  /**
   * Get CPU temperature
   */
  async _getCPUTemperature() {
    try {
      switch (this.config.platform) {
        case 'darwin':
          // macOS: would need osx-temperature-sensor or similar
          this.currentState.cpu.temperature = null;
          break;
        case 'linux':
          const { stdout } = await execAsync(
            'cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0',
            { timeout: 3000 }
          );
          const temp = parseInt(stdout) / 1000;
          this.currentState.cpu.temperature = temp > 0 ? temp : null;
          break;
        case 'win32':
          // Windows: would need wmic or WMI
          this.currentState.cpu.temperature = null;
          break;
      }
    } catch {
      this.currentState.cpu.temperature = null;
    }
  }

  /**
   * Update memory information
   */
  async _updateMemory() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    this.currentState.memory = {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100)
    };
  }

  /**
   * Update disk information
   */
  async _updateDisk() {
    try {
      switch (this.config.platform) {
        case 'darwin':
        case 'linux':
          const { stdout } = await execAsync(
            'df -k / | tail -1',
            { timeout: 5000 }
          );
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 5) {
            const total = parseInt(parts[1]) * 1024;
            const used = parseInt(parts[2]) * 1024;
            const percentage = parseInt(parts[4]);
            
            this.currentState.disk = { total, used, free: total - used, percentage };
          }
          break;
        case 'win32':
          const { stdout: winOut } = await execAsync(
            'wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv',
            { timeout: 5000 }
          );
          const lines = winOut.trim().split('\n');
          if (lines.length > 1) {
            const [, freeSpace, size] = lines[1].split(',');
            const total = parseInt(size);
            const free = parseInt(freeSpace);
            const used = total - free;
            
            this.currentState.disk = {
              total,
              used,
              free,
              percentage: Math.round((used / total) * 100)
            };
          }
          break;
      }
    } catch (error) {
      this.logger?.debug('Disk info failed', error);
    }
  }

  /**
   * Update network information
   */
  async _updateNetwork() {
    const interfaces = os.networkInterfaces();
    let bytesIn = 0;
    let bytesOut = 0;

    try {
      switch (this.config.platform) {
        case 'darwin':
          const { stdout: macOut } = await execAsync(
            'netstat -ib | head -10',
            { timeout: 5000 }
          );
          // Parse netstat output for bytes
          const macLines = macOut.split('\n');
          for (const line of macLines) {
            if (line.includes('en0') || line.includes('en1')) {
              const parts = line.split(/\s+/);
              if (parts.length >= 10) {
                bytesIn += parseInt(parts[6]) || 0;
                bytesOut += parseInt(parts[9]) || 0;
              }
            }
          }
          break;
          
        case 'linux':
          const { stdout: linuxOut } = await execAsync(
            'cat /proc/net/dev | grep -E "eth|wlan|enp|wlp"',
            { timeout: 5000 }
          );
          for (const line of linuxOut.split('\n')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 10) {
              bytesIn += parseInt(parts[1]) || 0;
              bytesOut += parseInt(parts[9]) || 0;
            }
          }
          break;
          
        case 'win32':
          // Windows network stats simplified
          break;
      }
    } catch (error) {
      this.logger?.debug('Network stats failed', error);
    }

    // Calculate rates
    if (this.previousNetwork) {
      const timeDelta = this.config.pollInterval / 1000;
      this.currentState.network = {
        bytesIn,
        bytesOut,
        rateIn: Math.round((bytesIn - this.previousNetwork.bytesIn) / timeDelta),
        rateOut: Math.round((bytesOut - this.previousNetwork.bytesOut) / timeDelta)
      };
    } else {
      this.currentState.network = { bytesIn, bytesOut, rateIn: 0, rateOut: 0 };
    }

    this.previousNetwork = { bytesIn, bytesOut };
  }

  /**
   * Update history
   */
  _updateHistory() {
    const timestamp = Date.now();

    this.history.cpu.push({ timestamp, value: this.currentState.cpu.usage });
    this.history.memory.push({ timestamp, value: this.currentState.memory.percentage });
    this.history.disk.push({ timestamp, value: this.currentState.disk.percentage });
    this.history.network.push({ 
      timestamp, 
      rateIn: this.currentState.network.rateIn,
      rateOut: this.currentState.network.rateOut
    });

    // Trim history
    const maxSize = this.config.historySize;
    for (const key of Object.keys(this.history)) {
      if (this.history[key].length > maxSize) {
        this.history[key] = this.history[key].slice(-maxSize);
      }
    }

    // Update averages
    this.statistics.averageCpu = Math.round(
      this.history.cpu.reduce((sum, h) => sum + h.value, 0) / this.history.cpu.length
    );
    this.statistics.averageMemory = Math.round(
      this.history.memory.reduce((sum, h) => sum + h.value, 0) / this.history.memory.length
    );
  }

  /**
   * Check thresholds and emit alerts
   */
  _checkThresholds() {
    // CPU threshold
    const cpuHigh = this.currentState.cpu.usage > this.config.cpuThreshold;
    if (cpuHigh && !this.alerts.cpuHigh) {
      this.alerts.cpuHigh = true;
      this.statistics.highCpuEvents++;
      this.emit('highCpu', { usage: this.currentState.cpu.usage, threshold: this.config.cpuThreshold });
      this.logger?.warn('High CPU usage', { usage: this.currentState.cpu.usage });
    } else if (!cpuHigh && this.alerts.cpuHigh) {
      this.alerts.cpuHigh = false;
      this.emit('normalCpu', { usage: this.currentState.cpu.usage });
    }

    // Memory threshold
    const memoryHigh = this.currentState.memory.percentage > this.config.memoryThreshold;
    if (memoryHigh && !this.alerts.memoryHigh) {
      this.alerts.memoryHigh = true;
      this.statistics.highMemoryEvents++;
      this.emit('highMemory', { 
        percentage: this.currentState.memory.percentage, 
        threshold: this.config.memoryThreshold 
      });
      this.logger?.warn('High memory usage', { percentage: this.currentState.memory.percentage });
    } else if (!memoryHigh && this.alerts.memoryHigh) {
      this.alerts.memoryHigh = false;
      this.emit('normalMemory', { percentage: this.currentState.memory.percentage });
    }

    // Disk threshold
    const diskHigh = this.currentState.disk.percentage > this.config.diskThreshold;
    if (diskHigh && !this.alerts.diskHigh) {
      this.alerts.diskHigh = true;
      this.statistics.highDiskEvents++;
      this.emit('highDisk', { 
        percentage: this.currentState.disk.percentage, 
        threshold: this.config.diskThreshold 
      });
      this.logger?.warn('High disk usage', { percentage: this.currentState.disk.percentage });
    } else if (!diskHigh && this.alerts.diskHigh) {
      this.alerts.diskHigh = false;
      this.emit('normalDisk', { percentage: this.currentState.disk.percentage });
    }
  }

  /**
   * Get current state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Get history
   */
  getHistory() {
    return JSON.parse(JSON.stringify(this.history));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Get CPU usage
   */
  getCPUUsage() {
    return this.currentState.cpu.usage;
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    return this.currentState.memory.percentage;
  }

  /**
   * Get disk usage
   */
  getDiskUsage() {
    return this.currentState.disk.percentage;
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = SystemResourceMonitor;

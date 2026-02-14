/**
 * Hardware Event Monitor
 * 
 * Monitors hardware events across platforms including:
 * - USB device connections/disconnections
 * - Bluetooth device events
 * - Display/monitor changes
 * - Audio device changes
 * 
 * @module HardwareEventMonitor
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class HardwareEventMonitor extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      pollInterval: config.pollInterval || 10000,
      monitorUSB: config.monitorUSB !== false,
      monitorBluetooth: config.monitorBluetooth !== false,
      monitorDisplays: config.monitorDisplays !== false,
      monitorAudio: config.monitorAudio !== false,
      platform: config.platform || process.platform,
      ...config
    };
    
    this.currentState = {
      usbDevices: [],
      bluetoothDevices: [],
      displays: [],
      audioDevices: []
    };
    
    this.pollTimer = null;
    this.running = false;
    
    this.statistics = {
      usbConnections: 0,
      usbDisconnections: 0,
      bluetoothConnections: 0,
      bluetoothDisconnections: 0,
      displayChanges: 0,
      audioChanges: 0
    };
  }

  /**
   * Start monitoring hardware events
   */
  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger?.info('Starting hardware event monitor');

    // Get initial state
    await this._updateHardwareState();

    // Start polling
    this.pollTimer = setInterval(async () => {
      await this._updateHardwareState();
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

    this.logger?.info('Hardware event monitor stopped');
    this.emit('stopped');
  }

  /**
   * Update hardware state
   */
  async _updateHardwareState() {
    const previousState = JSON.parse(JSON.stringify(this.currentState));

    try {
      if (this.config.monitorUSB) {
        await this._updateUSBDevices();
      }
      if (this.config.monitorBluetooth) {
        await this._updateBluetoothDevices();
      }
      if (this.config.monitorDisplays) {
        await this._updateDisplays();
      }
      if (this.config.monitorAudio) {
        await this._updateAudioDevices();
      }

      // Check for changes and emit events
      this._checkHardwareChanges(previousState, this.currentState);
    } catch (error) {
      this.logger?.error('Failed to update hardware state', error);
    }
  }

  /**
   * Update USB devices
   */
  async _updateUSBDevices() {
    try {
      switch (this.config.platform) {
        case 'darwin':
          await this._getMacOSUSBDevices();
          break;
        case 'win32':
          await this._getWindowsUSBDevices();
          break;
        case 'linux':
          await this._getLinuxUSBDevices();
          break;
      }
    } catch (error) {
      this.logger?.debug('USB device detection failed', error);
    }
  }

  async _getMacOSUSBDevices() {
    const { stdout } = await execAsync(
      'system_profiler SPUSBDataType -json 2>/dev/null || echo "{}"',
      { timeout: 10000 }
    );
    
    try {
      const data = JSON.parse(stdout);
      this.currentState.usbDevices = this._parseUSBTree(data.SPUSBDataType || []);
    } catch {
      this.currentState.usbDevices = [];
    }
  }

  async _getWindowsUSBDevices() {
    const { stdout } = await execAsync(
      'wmic path Win32_USBHub get DeviceID,Description /format:csv 2>nul',
      { timeout: 10000 }
    );
    
    this.currentState.usbDevices = stdout.split('\n')
      .filter(line => line.trim() && !line.startsWith('Node'))
      .map(line => {
        const [, description, deviceId] = line.split(',');
        return { name: description?.trim(), id: deviceId?.trim() };
      })
      .filter(d => d.name);
  }

  async _getLinuxUSBDevices() {
    const { stdout } = await execAsync('lsusb 2>/dev/null || echo ""', { timeout: 10000 });
    
    this.currentState.usbDevices = stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/Bus \d+ Device \d+: ID (\S+) (.+)/);
        return match ? { id: match[1], name: match[2].trim() } : null;
      })
      .filter(Boolean);
  }

  _parseUSBTree(items, devices = []) {
    for (const item of items) {
      if (item._name) {
        devices.push({
          name: item._name,
          id: item.serial_num || item.location_id,
          vendor: item.manufacturer,
          product: item.product_id
        });
      }
      if (item._items) {
        this._parseUSBTree(item._items, devices);
      }
    }
    return devices;
  }

  /**
   * Update Bluetooth devices
   */
  async _updateBluetoothDevices() {
    try {
      switch (this.config.platform) {
        case 'darwin':
          await this._getMacOSBluetoothDevices();
          break;
        case 'win32':
          await this._getWindowsBluetoothDevices();
          break;
        case 'linux':
          await this._getLinuxBluetoothDevices();
          break;
      }
    } catch (error) {
      this.logger?.debug('Bluetooth device detection failed', error);
    }
  }

  async _getMacOSBluetoothDevices() {
    const { stdout } = await execAsync(
      'system_profiler SPBluetoothDataType -json 2>/dev/null || echo "{}"',
      { timeout: 10000 }
    );
    
    try {
      const data = JSON.parse(stdout);
      const devices = [];
      const btData = data.SPBluetoothDataType?.[0];
      
      if (btData?.device_connected) {
        for (const [name, info] of Object.entries(btData.device_connected)) {
          devices.push({
            name,
            connected: true,
            type: info.device_minorType || 'unknown',
            address: info.device_address
          });
        }
      }
      
      this.currentState.bluetoothDevices = devices;
    } catch {
      this.currentState.bluetoothDevices = [];
    }
  }

  async _getWindowsBluetoothDevices() {
    // Windows Bluetooth detection simplified
    this.currentState.bluetoothDevices = [];
  }

  async _getLinuxBluetoothDevices() {
    try {
      const { stdout } = await execAsync(
        'bluetoothctl devices 2>/dev/null || echo ""',
        { timeout: 5000 }
      );
      
      this.currentState.bluetoothDevices = stdout.split('\n')
        .filter(line => line.startsWith('Device'))
        .map(line => {
          const match = line.match(/Device (\S+) (.+)/);
          return match ? { address: match[1], name: match[2], connected: false } : null;
        })
        .filter(Boolean);
    } catch {
      this.currentState.bluetoothDevices = [];
    }
  }

  /**
   * Update displays
   */
  async _updateDisplays() {
    try {
      switch (this.config.platform) {
        case 'darwin':
          await this._getMacOSDisplays();
          break;
        case 'win32':
          await this._getWindowsDisplays();
          break;
        case 'linux':
          await this._getLinuxDisplays();
          break;
      }
    } catch (error) {
      this.logger?.debug('Display detection failed', error);
    }
  }

  async _getMacOSDisplays() {
    const { stdout } = await execAsync(
      'system_profiler SPDisplaysDataType -json 2>/dev/null || echo "{}"',
      { timeout: 10000 }
    );
    
    try {
      const data = JSON.parse(stdout);
      const displays = [];
      
      for (const gpu of data.SPDisplaysDataType || []) {
        for (const display of gpu.spdisplays_ndrvs || []) {
          displays.push({
            name: display._name,
            resolution: display._spdisplays_resolution,
            main: display.spdisplays_main === 'spdisplays_yes'
          });
        }
      }
      
      this.currentState.displays = displays;
    } catch {
      this.currentState.displays = [];
    }
  }

  async _getWindowsDisplays() {
    // Windows display detection simplified
    this.currentState.displays = [];
  }

  async _getLinuxDisplays() {
    try {
      const { stdout } = await execAsync('xrandr --query 2>/dev/null || echo ""', { timeout: 5000 });
      
      this.currentState.displays = stdout.split('\n')
        .filter(line => line.includes(' connected'))
        .map(line => {
          const [name, , resolution] = line.split(' ');
          return { name, resolution: resolution || 'unknown', connected: true };
        });
    } catch {
      this.currentState.displays = [];
    }
  }

  /**
   * Update audio devices
   */
  async _updateAudioDevices() {
    try {
      switch (this.config.platform) {
        case 'darwin':
          await this._getMacOSAudioDevices();
          break;
        case 'win32':
          await this._getWindowsAudioDevices();
          break;
        case 'linux':
          await this._getLinuxAudioDevices();
          break;
      }
    } catch (error) {
      this.logger?.debug('Audio device detection failed', error);
    }
  }

  async _getMacOSAudioDevices() {
    const { stdout } = await execAsync(
      'system_profiler SPAudioDataType -json 2>/dev/null || echo "{}"',
      { timeout: 10000 }
    );
    
    try {
      const data = JSON.parse(stdout);
      const devices = [];
      
      for (const item of data.SPAudioDataType || []) {
        if (item._name) {
          devices.push({
            name: item._name,
            type: item.coreaudio_device_transport || 'unknown'
          });
        }
      }
      
      this.currentState.audioDevices = devices;
    } catch {
      this.currentState.audioDevices = [];
    }
  }

  async _getWindowsAudioDevices() {
    this.currentState.audioDevices = [];
  }

  async _getLinuxAudioDevices() {
    try {
      const { stdout } = await execAsync('pactl list sinks short 2>/dev/null || echo ""', { timeout: 5000 });
      
      this.currentState.audioDevices = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('\t');
          return { id: parts[0], name: parts[1], state: parts[4] };
        })
        .filter(d => d.name);
    } catch {
      this.currentState.audioDevices = [];
    }
  }

  /**
   * Check for hardware changes and emit events
   */
  _checkHardwareChanges(previous, current) {
    // USB changes
    this._checkDeviceChanges(
      previous.usbDevices,
      current.usbDevices,
      'usb',
      'usbConnections',
      'usbDisconnections'
    );

    // Bluetooth changes
    this._checkDeviceChanges(
      previous.bluetoothDevices,
      current.bluetoothDevices,
      'bluetooth',
      'bluetoothConnections',
      'bluetoothDisconnections'
    );

    // Display changes
    if (JSON.stringify(previous.displays) !== JSON.stringify(current.displays)) {
      this.statistics.displayChanges++;
      this.emit('displayChange', {
        previous: previous.displays,
        current: current.displays
      });
    }

    // Audio changes
    if (JSON.stringify(previous.audioDevices) !== JSON.stringify(current.audioDevices)) {
      this.statistics.audioChanges++;
      this.emit('audioChange', {
        previous: previous.audioDevices,
        current: current.audioDevices
      });
    }
  }

  _checkDeviceChanges(previous, current, type, connectStat, disconnectStat) {
    const prevIds = new Set(previous.map(d => d.id || d.name));
    const currIds = new Set(current.map(d => d.id || d.name));

    // New devices
    for (const device of current) {
      const id = device.id || device.name;
      if (!prevIds.has(id)) {
        this.statistics[connectStat]++;
        this.emit(`${type}Connected`, device);
        this.logger?.info(`${type} device connected`, { device: device.name });
      }
    }

    // Removed devices
    for (const device of previous) {
      const id = device.id || device.name;
      if (!currIds.has(id)) {
        this.statistics[disconnectStat]++;
        this.emit(`${type}Disconnected`, device);
        this.logger?.info(`${type} device disconnected`, { device: device.name });
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Get USB devices
   */
  getUSBDevices() {
    return [...this.currentState.usbDevices];
  }

  /**
   * Get Bluetooth devices
   */
  getBluetoothDevices() {
    return [...this.currentState.bluetoothDevices];
  }

  /**
   * Get displays
   */
  getDisplays() {
    return [...this.currentState.displays];
  }

  /**
   * Get audio devices
   */
  getAudioDevices() {
    return [...this.currentState.audioDevices];
  }
}

module.exports = HardwareEventMonitor;

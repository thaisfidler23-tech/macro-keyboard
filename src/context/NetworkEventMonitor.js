/**
 * Network Event Monitor - Cross-platform network connectivity monitoring
 * 
 * Monitors:
 * - Network interface changes (WiFi, Ethernet, VPN)
 * - Internet connectivity status
 * - WiFi network switching
 * - VPN connection state changes
 * - Network quality changes
 */

const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const os = require('os');

class NetworkEventMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.logger = config.logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    
    this.platform = config.platform || process.platform;
    this.config = {
      checkInterval: config.checkInterval || 5000, // 5 seconds
      enableVPNDetection: config.enableVPNDetection !== false,
      enableWiFiMonitoring: config.enableWiFiMonitoring !== false,
      enableConnectivityCheck: config.enableConnectivityCheck !== false,
      connectivityCheckUrl: config.connectivityCheckUrl || 'https://google.com',
      connectivityTimeout: config.connectivityTimeout || 5000,
      ...config
    };
    
    // Current network state
    this.currentState = {
      interfaces: new Map(),
      activeConnections: new Set(),
      internetConnected: false,
      primaryInterface: null,
      currentWiFiSSID: null,
      vpnConnected: false,
      vpnInterface: null,
      lastUpdate: null
    };
    
    // Monitoring state
    this.monitoring = false;
    this.checkTimer = null;
    this.platformHandlers = null;
    this.networkProcess = null;
    
    // Statistics
    this.statistics = {
      networkChecks: 0,
      interfaceChanges: 0,
      connectivityChanges: 0,
      wifiChanges: 0,
      vpnChanges: 0,
      networkErrors: 0
    };
    
    this.logger.debug('NetworkEventMonitor initialized', { platform: this.platform });
  }

  /**
   * Start network event monitoring
   */
  async start() {
    if (this.monitoring) {
      throw new Error('Network monitoring already started');
    }

    this.monitoring = true;
    
    try {
      // Initialize platform-specific monitoring
      await this.initializePlatformMonitoring();
      
      // Get initial network state
      await this.updateNetworkState();
      
      // Start periodic network checks
      this.startPeriodicChecks();
      
      // Start platform-specific continuous monitoring
      if (this.platformHandlers && typeof this.platformHandlers.startContinuousMonitoring === 'function') {
        await this.platformHandlers.startContinuousMonitoring();
      }

      this.logger.info('Network event monitoring started');
      
    } catch (error) {
      this.monitoring = false;
      this.logger.error('Failed to start network monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop network event monitoring
   */
  async stop() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    
    // Clear periodic check timer
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    // Clean up platform-specific handlers
    if (this.platformHandlers && typeof this.platformHandlers.cleanup === 'function') {
      await this.platformHandlers.cleanup();
    }
    
    // Stop network monitoring process
    if (this.networkProcess) {
      this.networkProcess.kill();
      this.networkProcess = null;
    }

    this.logger.info('Network event monitoring stopped');
  }

  /**
   * Initialize platform-specific monitoring
   */
  async initializePlatformMonitoring() {
    switch (this.platform) {
      case 'win32':
        this.platformHandlers = await this.initializeWindowsNetworkMonitoring();
        break;
      case 'darwin':
        this.platformHandlers = await this.initializeMacOSNetworkMonitoring();
        break;
      case 'linux':
        this.platformHandlers = await this.initializeLinuxNetworkMonitoring();
        break;
      default:
        this.logger.warn(`Network monitoring not fully supported on platform: ${this.platform}`);
    }
  }

  /**
   * Initialize Windows network monitoring
   */
  async initializeWindowsNetworkMonitoring() {
    return {
      getNetworkInterfaces: this.getWindowsNetworkInterfaces.bind(this),
      getWiFiSSID: this.getWindowsWiFiSSID.bind(this),
      checkVPN: this.checkWindowsVPN.bind(this),
      startContinuousMonitoring: this.startWindowsContinuousMonitoring.bind(this),
      cleanup: async () => {}
    };
  }

  /**
   * Initialize macOS network monitoring
   */
  async initializeMacOSNetworkMonitoring() {
    return {
      getNetworkInterfaces: this.getMacOSNetworkInterfaces.bind(this),
      getWiFiSSID: this.getMacOSWiFiSSID.bind(this),
      checkVPN: this.checkMacOSVPN.bind(this),
      startContinuousMonitoring: this.startMacOSContinuousMonitoring.bind(this),
      cleanup: async () => {}
    };
  }

  /**
   * Initialize Linux network monitoring
   */
  async initializeLinuxNetworkMonitoring() {
    return {
      getNetworkInterfaces: this.getLinuxNetworkInterfaces.bind(this),
      getWiFiSSID: this.getLinuxWiFiSSID.bind(this),
      checkVPN: this.checkLinuxVPN.bind(this),
      startContinuousMonitoring: this.startLinuxContinuousMonitoring.bind(this),
      cleanup: async () => {}
    };
  }

  /**
   * Start periodic network checks
   */
  startPeriodicChecks() {
    this.checkTimer = setInterval(async () => {
      try {
        await this.updateNetworkState();
      } catch (error) {
        this.logger.error('Error during periodic network check:', error);
        this.statistics.networkErrors++;
      }
    }, this.config.checkInterval);
  }

  /**
   * Update network state and detect changes
   */
  async updateNetworkState() {
    if (!this.platformHandlers) {
      return;
    }

    try {
      const previousState = this.cloneCurrentState();
      
      // Get current network interfaces
      const interfaces = await this.platformHandlers.getNetworkInterfaces();
      this.currentState.interfaces = interfaces;
      
      // Update active connections
      this.updateActiveConnections(interfaces);
      
      // Check WiFi SSID if enabled
      if (this.config.enableWiFiMonitoring) {
        const wifiSSID = await this.platformHandlers.getWiFiSSID();
        this.currentState.currentWiFiSSID = wifiSSID;
      }
      
      // Check VPN status if enabled
      if (this.config.enableVPNDetection) {
        const vpnInfo = await this.platformHandlers.checkVPN();
        this.currentState.vpnConnected = vpnInfo.connected;
        this.currentState.vpnInterface = vpnInfo.interface;
      }
      
      // Check internet connectivity if enabled
      if (this.config.enableConnectivityCheck) {
        const internetConnected = await this.checkInternetConnectivity();
        this.currentState.internetConnected = internetConnected;
      }
      
      // Determine primary interface
      this.currentState.primaryInterface = this.determinePrimaryInterface(interfaces);
      
      this.currentState.lastUpdate = Date.now();
      
      // Check for changes and emit events
      this.checkNetworkStateChanges(previousState, this.currentState);
      
      this.statistics.networkChecks++;
      
    } catch (error) {
      this.logger.error('Failed to update network state:', error);
      this.statistics.networkErrors++;
    }
  }

  /**
   * Clone current state for comparison
   */
  cloneCurrentState() {
    return {
      interfaces: new Map(this.currentState.interfaces),
      activeConnections: new Set(this.currentState.activeConnections),
      internetConnected: this.currentState.internetConnected,
      primaryInterface: this.currentState.primaryInterface,
      currentWiFiSSID: this.currentState.currentWiFiSSID,
      vpnConnected: this.currentState.vpnConnected,
      vpnInterface: this.currentState.vpnInterface
    };
  }

  /**
   * Update active connections based on interface status
   */
  updateActiveConnections(interfaces) {
    this.currentState.activeConnections.clear();
    
    for (const [name, info] of interfaces) {
      if (info.active && info.hasIPAddress) {
        this.currentState.activeConnections.add(name);
      }
    }
  }

  /**
   * Determine primary network interface
   */
  determinePrimaryInterface(interfaces) {
    // Priority: VPN > WiFi > Ethernet > Other
    const priorities = {
      vpn: 1,
      wifi: 2,
      wireless: 2,
      ethernet: 3,
      wired: 3,
      other: 4
    };
    
    let primaryInterface = null;
    let highestPriority = 5;
    
    for (const [name, info] of interfaces) {
      if (info.active && info.hasIPAddress) {
        const priority = priorities[info.type] || priorities.other;
        if (priority < highestPriority) {
          highestPriority = priority;
          primaryInterface = { name, ...info };
        }
      }
    }
    
    return primaryInterface;
  }

  /**
   * Check for network state changes and emit events
   */
  checkNetworkStateChanges(previousState, currentState) {
    // Interface changes
    this.checkInterfaceChanges(previousState.interfaces, currentState.interfaces);
    
    // Internet connectivity changes
    if (previousState.internetConnected !== currentState.internetConnected) {
      this.emit('event', {
        type: currentState.internetConnected ? 'internet-connected' : 'internet-disconnected',
        data: {
          connected: currentState.internetConnected,
          primaryInterface: currentState.primaryInterface
        }
      });
      this.statistics.connectivityChanges++;
    }
    
    // WiFi network changes
    if (previousState.currentWiFiSSID !== currentState.currentWiFiSSID) {
      this.emit('event', {
        type: 'wifi-network-changed',
        data: {
          previousSSID: previousState.currentWiFiSSID,
          currentSSID: currentState.currentWiFiSSID,
          connected: !!currentState.currentWiFiSSID
        }
      });
      this.statistics.wifiChanges++;
    }
    
    // VPN status changes
    if (previousState.vpnConnected !== currentState.vpnConnected) {
      this.emit('event', {
        type: currentState.vpnConnected ? 'vpn-connected' : 'vpn-disconnected',
        data: {
          connected: currentState.vpnConnected,
          interface: currentState.vpnInterface,
          vpnInterface: currentState.vpnInterface
        }
      });
      this.statistics.vpnChanges++;
    }
    
    // Primary interface changes
    const previousPrimary = previousState.primaryInterface?.name;
    const currentPrimary = currentState.primaryInterface?.name;
    if (previousPrimary !== currentPrimary) {
      this.emit('event', {
        type: 'primary-interface-changed',
        data: {
          previousInterface: previousState.primaryInterface,
          currentInterface: currentState.primaryInterface
        }
      });
    }
  }

  /**
   * Check for interface changes
   */
  checkInterfaceChanges(previousInterfaces, currentInterfaces) {
    // Check for new or changed interfaces
    for (const [name, currentInfo] of currentInterfaces) {
      const previousInfo = previousInterfaces.get(name);
      
      if (!previousInfo) {
        // New interface
        if (currentInfo.active) {
          this.emit('event', {
            type: 'interface-connected',
            data: {
              interface: name,
              type: currentInfo.type,
              address: currentInfo.address
            }
          });
          this.statistics.interfaceChanges++;
        }
      } else if (previousInfo.active !== currentInfo.active) {
        // Interface status changed
        this.emit('event', {
          type: currentInfo.active ? 'interface-connected' : 'interface-disconnected',
          data: {
            interface: name,
            type: currentInfo.type,
            address: currentInfo.address,
            previouslyActive: previousInfo.active
          }
        });
        this.statistics.interfaceChanges++;
      } else if (previousInfo.address !== currentInfo.address && currentInfo.active) {
        // IP address changed
        this.emit('event', {
          type: 'interface-address-changed',
          data: {
            interface: name,
            type: currentInfo.type,
            previousAddress: previousInfo.address,
            currentAddress: currentInfo.address
          }
        });
      }
    }
    
    // Check for removed interfaces
    for (const [name, previousInfo] of previousInterfaces) {
      if (!currentInterfaces.has(name) && previousInfo.active) {
        this.emit('event', {
          type: 'interface-disconnected',
          data: {
            interface: name,
            type: previousInfo.type,
            address: previousInfo.address
          }
        });
        this.statistics.interfaceChanges++;
      }
    }
  }

  /**
   * Check internet connectivity
   */
  async checkInternetConnectivity() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.config.connectivityTimeout);
      
      exec(`curl -s --max-time ${Math.floor(this.config.connectivityTimeout / 1000)} "${this.config.connectivityCheckUrl}" > /dev/null && echo "connected"`, 
        (error, stdout) => {
          clearTimeout(timeout);
          resolve(stdout.trim() === 'connected');
        });
    });
  }

  /**
   * Get Windows network interfaces
   */
  async getWindowsNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const result = new Map();
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      const activeAddr = addrs.find(addr => 
        !addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1'
      );
      
      result.set(name, {
        active: !!activeAddr,
        hasIPAddress: !!activeAddr,
        address: activeAddr?.address,
        type: this.classifyInterfaceType(name),
        family: activeAddr?.family,
        internal: false
      });
    }
    
    return result;
  }

  /**
   * Get macOS network interfaces
   */
  async getMacOSNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const result = new Map();
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      const activeAddr = addrs.find(addr => 
        !addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1'
      );
      
      result.set(name, {
        active: !!activeAddr,
        hasIPAddress: !!activeAddr,
        address: activeAddr?.address,
        type: this.classifyInterfaceType(name),
        family: activeAddr?.family,
        internal: false
      });
    }
    
    return result;
  }

  /**
   * Get Linux network interfaces
   */
  async getLinuxNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const result = new Map();
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      const activeAddr = addrs.find(addr => 
        !addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1'
      );
      
      result.set(name, {
        active: !!activeAddr,
        hasIPAddress: !!activeAddr,
        address: activeAddr?.address,
        type: this.classifyInterfaceType(name),
        family: activeAddr?.family,
        internal: false
      });
    }
    
    return result;
  }

  /**
   * Classify interface type based on name
   */
  classifyInterfaceType(interfaceName) {
    const name = interfaceName.toLowerCase();
    
    if (name.includes('wifi') || name.includes('wlan') || name.includes('wireless') || name.startsWith('wl')) {
      return 'wifi';
    }
    if (name.includes('ethernet') || name.includes('eth') || name.startsWith('en') || name.startsWith('em')) {
      return 'ethernet';
    }
    if (name.includes('vpn') || name.includes('tun') || name.includes('tap') || name.startsWith('utun')) {
      return 'vpn';
    }
    if (name.includes('bluetooth') || name.includes('bt')) {
      return 'bluetooth';
    }
    if (name.includes('ppp')) {
      return 'dialup';
    }
    
    return 'other';
  }

  /**
   * Get Windows WiFi SSID
   */
  async getWindowsWiFiSSID() {
    return new Promise((resolve) => {
      exec('netsh wlan show profiles', (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        
        // Parse connected network from netsh output
        exec('netsh wlan show interfaces', (error2, stdout2) => {
          if (error2) {
            resolve(null);
            return;
          }
          
          const ssidMatch = stdout2.match(/SSID\s*:\s*(.+)/);
          resolve(ssidMatch ? ssidMatch[1].trim() : null);
        });
      });
    });
  }

  /**
   * Get macOS WiFi SSID
   */
  async getMacOSWiFiSSID() {
    return new Promise((resolve) => {
      exec('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I', 
        (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }
          
          const ssidMatch = stdout.match(/\sSSID:\s(.+)/);
          resolve(ssidMatch ? ssidMatch[1].trim() : null);
        });
    });
  }

  /**
   * Get Linux WiFi SSID
   */
  async getLinuxWiFiSSID() {
    return new Promise((resolve) => {
      exec('iwgetid -r', (error, stdout) => {
        if (error) {
          // Try alternative method
          exec('nmcli -t -f active,ssid dev wifi | grep yes | cut -d: -f2', 
            (error2, stdout2) => {
              resolve(error2 ? null : stdout2.trim() || null);
            });
          return;
        }
        
        resolve(stdout.trim() || null);
      });
    });
  }

  /**
   * Check Windows VPN status
   */
  async checkWindowsVPN() {
    return new Promise((resolve) => {
      exec('netsh interface show interface', (error, stdout) => {
        if (error) {
          resolve({ connected: false, interface: null });
          return;
        }
        
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('Connected') && (line.includes('VPN') || line.includes('TAP') || line.includes('TUN'))) {
            const match = line.match(/\s+([^\s]+)\s+Connected/);
            resolve({ 
              connected: true, 
              interface: match ? match[1] : 'unknown' 
            });
            return;
          }
        }
        
        resolve({ connected: false, interface: null });
      });
    });
  }

  /**
   * Check macOS VPN status
   */
  async checkMacOSVPN() {
    return new Promise((resolve) => {
      exec('ifconfig | grep -E "^(utun|tun|tap)" | grep "inet "', (error, stdout) => {
        if (error) {
          resolve({ connected: false, interface: null });
          return;
        }
        
        const lines = stdout.trim().split('\n');
        if (lines.length > 0 && lines[0]) {
          const interfaceMatch = lines[0].match(/^(\w+)/);
          resolve({ 
            connected: true, 
            interface: interfaceMatch ? interfaceMatch[1] : 'unknown' 
          });
        } else {
          resolve({ connected: false, interface: null });
        }
      });
    });
  }

  /**
   * Check Linux VPN status
   */
  async checkLinuxVPN() {
    return new Promise((resolve) => {
      exec('ip route | grep tun', (error, stdout) => {
        if (error) {
          resolve({ connected: false, interface: null });
          return;
        }
        
        const tunMatch = stdout.match(/dev\s+(tun\w*)/);
        if (tunMatch) {
          resolve({ connected: true, interface: tunMatch[1] });
        } else {
          resolve({ connected: false, interface: null });
        }
      });
    });
  }

  /**
   * Platform-specific continuous monitoring stubs
   */
  async startWindowsContinuousMonitoring() {
    // Windows could use WMI event notifications for real-time monitoring
    this.logger.debug('Windows continuous network monitoring initialized (polling mode)');
  }

  async startMacOSContinuousMonitoring() {
    // macOS could use SystemConfiguration framework callbacks
    this.logger.debug('macOS continuous network monitoring initialized (polling mode)');
  }

  async startLinuxContinuousMonitoring() {
    try {
      // Monitor NetworkManager events on Linux
      this.networkProcess = spawn('nmcli', ['monitor'], { stdio: 'pipe' });
      
      this.networkProcess.stdout.on('data', (data) => {
        const output = data.toString();
        this.parseLinuxNetworkEvents(output);
      });
      
      this.networkProcess.on('error', (error) => {
        this.logger.debug('Linux continuous network monitoring error:', error);
      });
      
      this.logger.debug('Linux continuous network monitoring initialized');
      
    } catch (error) {
      this.logger.debug('Failed to start Linux continuous monitoring:', error);
    }
  }

  /**
   * Parse Linux NetworkManager events
   */
  parseLinuxNetworkEvents(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('connected') || line.includes('disconnected')) {
        // Trigger immediate network state update for real-time response
        setTimeout(() => this.updateNetworkState(), 100);
        break;
      }
    }
  }

  /**
   * Get current network state
   */
  getCurrentState() {
    return {
      interfaces: new Map(this.currentState.interfaces),
      activeConnections: new Set(this.currentState.activeConnections),
      internetConnected: this.currentState.internetConnected,
      primaryInterface: this.currentState.primaryInterface ? { ...this.currentState.primaryInterface } : null,
      currentWiFiSSID: this.currentState.currentWiFiSSID,
      vpnConnected: this.currentState.vpnConnected,
      vpnInterface: this.currentState.vpnInterface,
      lastUpdate: this.currentState.lastUpdate
    };
  }

  /**
   * Get network monitoring statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.monitoring;
  }
}

module.exports = NetworkEventMonitor;
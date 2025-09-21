# Troubleshooting Guide

*Comprehensive solutions for common issues and problems*

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Hardware Issues](#hardware-issues)
3. [Software Issues](#software-issues)
4. [Configuration Issues](#configuration-issues)
5. [Performance Issues](#performance-issues)
6. [Security Issues](#security-issues)
7. [Platform-Specific Issues](#platform-specific-issues)
8. [Advanced Troubleshooting](#advanced-troubleshooting)

## Quick Diagnostics

### Health Check Steps

Before diving into specific issues, run this quick diagnostic:

1. **Check Application Status**
   - ✅ Application is running (icon in status bar/system tray)
   - ✅ No error notifications visible
   - ✅ Configuration file exists and is readable

2. **Check Hardware Connection**
   - ✅ Arduino is connected via USB
   - ✅ Arduino LED is on (power indicator)
   - ✅ Serial port is detected in system

3. **Check Configuration**
   - ✅ Button/encoder counts match physical hardware
   - ✅ Serial port setting is correct
   - ✅ Actions are properly configured

4. **Test Basic Functionality**
   - ✅ Press a button - action should execute
   - ✅ Check logs for errors: `logs/macro-keyboard.log`

### Common Issue Indicators

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| No response to button press | Hardware connection | Check USB cable, reconnect Arduino |
| Actions execute slowly | Performance issue | Restart application, check CPU usage |
| Random actions trigger | Hardware ghosting | Add diodes to button matrix |
| Can't connect to Arduino | Port/driver issue | Update drivers, try different USB port |
| Application won't start | Configuration error | Reset configuration file |

## Hardware Issues

### Arduino Not Detected

**Symptoms:**
- No serial ports listed in configuration
- "No devices found" message
- USB device not recognized by system

**Solutions:**

#### Check USB Connection
1. **Try different USB cable** - many micro-USB cables are power-only
2. **Try different USB port** - preferably USB 2.0 port
3. **Check Arduino LED** - should be solid on when connected
4. **Restart Arduino** - press reset button

#### Driver Issues

**Windows:**
```bash
# Check Device Manager for "Unknown Device" or errors
# Download Arduino drivers from arduino.cc if needed
```

**macOS:**
```bash
# Check if Arduino appears in system
ls /dev/tty.usbmodem*
system_profiler SPUSBDataType | grep Arduino
```

**Linux:**
```bash
# Check USB devices
lsusb | grep Arduino

# Check permissions
ls -la /dev/ttyACM* /dev/ttyUSB*

# Add user to dialout group if needed
sudo usermod -a -G dialout $USER
# Then logout and login again
```

#### Firmware Issues
1. **Reflash firmware** using Arduino IDE
2. **Check serial output** in Arduino IDE Serial Monitor
3. **Verify baud rate** is set to 9600
4. **Test with simple sketch** first

### Button Matrix Problems

#### Buttons Not Responding

**Check Wiring:**
```
Row Pin → [Diode] → Button → Column Pin
                             ↓
                         Other Buttons
```

1. **Verify all connections** with multimeter
2. **Check for loose wires** - resolder if necessary
3. **Test individual buttons** with multimeter continuity mode
4. **Ensure diode orientation** - cathode toward Arduino pin

#### Ghosting (Multiple Buttons Trigger)

**Symptoms:**
- Pressing one button triggers multiple actions
- Random buttons seem to press themselves
- Matrix scanning picks up false positives

**Solution:**
```
Add 1N4148 diodes to EVERY button:

Before:  Pin2 ─── [Button] ─── Pin6
After:   Pin2 ─── [Diode] ─── [Button] ─── Pin6
                    ↑
                 Cathode (black band) toward Pin2
```

#### Mechanical Issues
1. **Button bounce** - firmware handles debouncing automatically
2. **Sticky buttons** - clean contacts with isopropyl alcohol
3. **Worn buttons** - replace if actuation force changes significantly

### Rotary Encoder Problems

#### Encoder Not Detected

**Check Connections:**
```
Encoder Pin A → Arduino Analog Pin (A0-A7)
Encoder Pin B → Arduino Digital Pin (14-21)
Encoder Common → Ground
```

**Verify with multimeter:**
1. **Check continuity** on all connections
2. **Test encoder rotation** - should see changing resistance
3. **Verify pin assignments** in configuration

#### Direction Detection Issues

**Symptoms:**
- Both directions trigger same action
- Direction appears reversed
- Inconsistent direction detection

**Solutions:**
1. **Swap Pin A and B connections** if direction is reversed
2. **Add pull-up resistors** (10kΩ) if signals are noisy
3. **Check encoder quality** - cheap encoders may skip steps

### Power Issues

#### Insufficient Power
**Symptoms:**
- Arduino resets when pressing multiple buttons
- Inconsistent behavior
- Serial communication drops out

**Solutions:**
1. **Use powered USB hub** if using many encoders/LEDs
2. **Check USB cable quality** - use data cables, not charging cables
3. **Add external power supply** for high-power configurations

## Software Issues

### Application Won't Start

#### Permission Issues

**macOS:**
```bash
# If app is blocked by Gatekeeper
sudo spctl --master-disable
# Open app, then re-enable:
sudo spctl --master-enable
```

**Linux:**
```bash
# Make AppImage executable
chmod +x Macro-Keyboard-*.AppImage

# Check for missing libraries
ldd Macro-Keyboard-*.AppImage | grep "not found"
```

#### Configuration Corruption
1. **Backup current config** (if possible)
2. **Delete configuration file**: `~/.config/macro-keyboard/config.yaml`
3. **Restart application** - will create default config
4. **Restore settings** manually

#### Dependency Issues

**Node.js version conflicts:**
```bash
# Check Node.js version (development mode)
node --version  # Should be 18+ for development

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Serial Communication Issues

#### Connection Drops

**Symptoms:**
- Buttons work intermittently
- "Serial connection lost" messages
- Have to reconnect frequently

**Solutions:**

1. **Check USB cable** - use high-quality, short cables
2. **Update USB drivers** - especially on Windows
3. **Reduce electrical interference** - away from wireless devices
4. **Try lower baud rate** - change to 4800 baud if 9600 is unstable

**Configuration change:**
```yaml
device:
  baudRate: 4800  # Reduce from 9600 if having issues
  connectionTimeout: 10000  # Increase timeout
```

#### Buffer Overflow

**Symptoms:**
- Delayed responses to button presses
- Actions execute out of order
- Serial data corruption

**Solutions:**
```yaml
# Increase buffer sizes in configuration
device:
  serialBufferSize: 2048
  readTimeout: 1000
```

### Action Execution Problems

#### Actions Don't Execute

**Check Action Configuration:**
```yaml
buttons:
  button1:
    type: "keypress"     # Check: valid type?
    action: "VolumeUp"   # Check: valid action?
    enabled: true        # Check: enabled?
```

**Verify Security Settings:**
```yaml
security:
  commandExecution:
    enabled: true        # Must be enabled for commands
    mode: "blacklist"    # Check mode allows your actions
```

#### Wrong Actions Execute

1. **Check button mapping** - physical button vs. configuration
2. **Verify serial data** - enable debug logging
3. **Test with hardware test mode** - isolate hardware vs. software

**Enable debug logging:**
```yaml
logging:
  level: "debug"
  file: "logs/macro-keyboard.log"
```

## Configuration Issues

### YAML Syntax Errors

**Common Syntax Mistakes:**
```yaml
# WRONG - missing quotes around special characters
action: cmd+c

# CORRECT
action: "cmd+c"

# WRONG - incorrect indentation
buttons:
button1:
  type: keypress

# CORRECT
buttons:
  button1:
    type: keypress
```

**Validation Tools:**
```bash
# Check YAML syntax online or with tools
npm install -g js-yaml
js-yaml config.yaml  # Will show syntax errors
```

### Schema Validation Failures

**Required Fields Missing:**
```yaml
# Minimum required configuration
device:
  serialPort: "/dev/ttyUSB0"
  baudRate: 9600
  buttons: 16
  encoders: 0

buttons:
  button1:
    type: "keypress"      # Required
    action: "VolumeUp"    # Required
    description: "Volume" # Optional but recommended
```

### Profile Issues

#### Profile Won't Switch
1. **Check trigger conditions** - are applications/windows correct?
2. **Verify profile exists** - check available profiles list
3. **Test manual switching** first
4. **Check context manager logs**

#### Profile Conflicts
```yaml
# Avoid overlapping triggers
profiles:
  coding:
    triggers:
      applications: ["Visual Studio Code"]
  
  text-editing:
    triggers:
      applications: ["TextEdit"]  # Different apps - good
      # Don't use: ["Visual Studio Code"]  # Would conflict
```

## Performance Issues

### Slow Response Times

#### Measure Performance
```javascript
// Check performance in debug mode
console.time('button-response');
// ... button press occurs ...
console.timeEnd('button-response');  // Should be < 50ms
```

#### Common Causes and Solutions

**High CPU Usage:**
1. **Check running processes** - close unnecessary programs
2. **Reduce logging level** - use "info" instead of "debug"
3. **Disable unused plugins** - they consume resources even idle

**Memory Leaks:**
```yaml
# Monitor memory in performance dashboard
performance:
  alerts:
    enabled: true
    thresholds:
      memory: 536870912  # 512MB alert threshold
```

**Slow Actions:**
```yaml
# Set timeouts to identify slow actions
buttons:
  button1:
    timeout: 5000  # Fail if action takes > 5 seconds
```

### High Memory Usage

#### Check Memory Consumption
```bash
# Monitor memory usage
top -p $(pgrep -f macro-keyboard)

# Or use built-in performance monitor
# Settings → Performance → Memory Usage
```

#### Reduce Memory Usage
1. **Limit log retention:**
```yaml
logging:
  maxFiles: 5           # Reduce from 10
  maxFileSize: 2097152  # 2MB instead of 5MB
```

2. **Disable unnecessary features:**
```yaml
performance:
  enabled: false  # Disable if not needed
plugins:
  enabled: false  # Disable if not using plugins
```

## Security Issues

### Commands Being Blocked

#### Check Security Mode
```yaml
security:
  commandExecution:
    mode: "blacklist"  # vs "allowlist" or "disabled"
```

#### Whitelist Specific Commands
```yaml
security:
  commandExecution:
    mode: "allowlist"
    allowedCommands:
      - "echo"
      - "date"
      - "ls"
      - "your-safe-command-here"
```

#### Review Blocked Patterns
Common patterns that trigger security blocks:
- Commands containing `rm`, `sudo`, `passwd`
- Command injection: `$(...)`, `` `...` ``, `| command`
- File system access: `/etc/`, `../`

### Application Launch Blocked

```yaml
security:
  applicationExecution:
    mode: "allowlist"
    allowedApplications:
      - "Calculator"
      - "Your App Name Here"
```

## Platform-Specific Issues

### macOS Issues

#### System Permissions

**Accessibility Permission Required:**
```
System Preferences → Security & Privacy → Privacy → Accessibility
→ Add "Macro Keyboard" and check the box
```

**Input Monitoring Permission:**
```
System Preferences → Security & Privacy → Privacy → Input Monitoring  
→ Add "Macro Keyboard" and check the box
```

#### Application Signing
```bash
# If app is blocked by Gatekeeper
xattr -dr com.apple.quarantine /path/to/Macro\ Keyboard.app
```

#### Status Bar Icon Missing
1. **Check system preferences** - ensure status bar icons are enabled
2. **Try manual show** - press Option+Click on status bar
3. **Restart application** with admin privileges if needed

### Windows Issues

#### System Tray Issues

**Icon not appearing:**
1. **Check hidden icons** - click arrow in system tray
2. **Windows notification settings** - ensure notifications are enabled
3. **Run as Administrator** if having permission issues

**Windows Defender Blocking:**
1. **Add application to exclusions** in Windows Defender
2. **Whitelist application folder** in antivirus software
3. **Check Windows Event Viewer** for security blocks

#### RobotJS Issues
```bash
# Install Visual Studio Build Tools if RobotJS won't compile
npm install --global windows-build-tools

# Or install Visual Studio Community (free)
# Then rebuild RobotJS:
npm rebuild robotjs
```

### Linux Issues

#### Display Server Compatibility

**X11 vs Wayland:**
```bash
# Check display server
echo $XDG_SESSION_TYPE

# If Wayland, may need X11 compatibility
sudo apt install xwayland

# Or switch to X11 session at login
```

#### Permission Issues
```bash
# Add user to required groups
sudo usermod -a -G dialout,input,uucp $USER

# Set permissions for serial ports
sudo chmod 666 /dev/ttyUSB0  # Temporary
# Or add udev rule for permanent fix
```

#### Desktop Environment Integration

**GNOME:**
```bash
# Install GNOME Shell extensions if needed
sudo apt install gnome-shell-extensions

# Enable system tray extension
gnome-extensions enable ubuntu-appindicators@ubuntu.com
```

**KDE Plasma:**
```bash
# System tray should work out of box
# Check system tray settings if icon missing
```

## Advanced Troubleshooting

### Debug Mode

#### Enable Comprehensive Logging
```yaml
logging:
  level: "debug"
  enableConsole: true
  enableStructured: true  # JSON format for parsing
```

#### Component-Specific Debugging
```yaml
# Debug specific components
debug:
  serialCommunication: true
  actionExecution: true
  profileSwitching: true
  pluginSystem: true
```

### Log Analysis

#### Important Log Patterns

**Serial Communication:**
```
[INFO] Serial connected to /dev/ttyUSB0
[DEBUG] Sending: STATUS
[DEBUG] Received: BTN:1
[ERROR] Serial connection lost: Error: Port not open
```

**Action Execution:**
```
[INFO] Executing action: keypress:VolumeUp for button1
[DEBUG] Normalized key combo: VolumeUp → volumeup
[INFO] Action completed successfully in 15ms
[WARN] Action timeout after 10000ms
```

**Security Violations:**
```
[WARN] Command blocked: rm -rf /tmp/*
[ERROR] Security violation: dangerous pattern detected
[INFO] Application blocked: /System/Library/...
```

### Network Diagnostics

#### Serial Port Network Issues
```bash
# Check for port conflicts
lsof | grep ttyUSB0
netstat -tulpn | grep :9600

# Kill conflicting processes
sudo fuser -k /dev/ttyUSB0
```

### Hardware Diagnostics

#### Oscilloscope/Logic Analyzer Testing
If you have advanced equipment:

1. **Monitor serial lines** - should see 9600 baud communication
2. **Check button matrix scanning** - should see regular scanning pattern
3. **Verify encoder quadrature** - A/B phase relationship

#### Multimeter Testing
```
Button Matrix:
- Row voltage: 5V when not scanning, 0V when scanning
- Column voltage: 0V normally, 5V when button pressed during scan

Encoders:
- A/B pins: Should toggle between 0V and 5V during rotation
- Common pin: Should be at 0V (ground)
```

### Memory Dumps and Profiling

#### Generate Memory Dump (Development Mode)
```javascript
// In development console
process.memoryUsage();
global.gc(); // Force garbage collection
process.memoryUsage();
```

#### CPU Profiling
```bash
# Use Node.js profiler (development mode)
node --inspect src/main.js
# Then connect Chrome DevTools for profiling
```

---

## Getting Additional Help

### Before Asking for Help

1. **Check logs** - most issues are revealed in logs
2. **Try minimal configuration** - isolate the problem
3. **Test with fresh config** - rule out configuration corruption
4. **Document steps to reproduce** - makes debugging much easier

### Information to Include

When reporting issues, always include:

- **Operating system and version**
- **Application version** (`Help → About`)
- **Hardware configuration** (button/encoder count)
- **Configuration file** (remove sensitive info)
- **Log files** (last 50 lines usually sufficient)
- **Steps to reproduce** the issue
- **Expected vs. actual behavior**

### Support Channels

1. **GitHub Issues**: [Report bugs and request features](https://github.com/jmassardo/macro-keyboard/issues)
2. **Discussions**: [Community help and questions](https://github.com/jmassardo/macro-keyboard/discussions)
3. **Documentation**: [Complete documentation](./README.md)
4. **FAQ**: [Frequently Asked Questions](./FAQ.md)

### Emergency Recovery

If nothing else works:

1. **Complete reset:**
```bash
# Backup current config
cp ~/.config/macro-keyboard/config.yaml ~/config-backup.yaml

# Remove all configuration
rm -rf ~/.config/macro-keyboard/

# Remove logs
rm -rf ~/Library/Logs/macro-keyboard/  # macOS
rm -rf ~/.local/share/macro-keyboard/logs/  # Linux

# Restart application - will create defaults
```

2. **Reinstall application** with fresh download
3. **Check hardware with Arduino IDE** Serial Monitor
4. **Test with minimal 4-button configuration** first
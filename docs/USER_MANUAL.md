# Macro Keyboard User Manual

*Complete guide to using your macro keyboard effectively*

## Table of Contents

1. [Overview](#overview)
2. [Hardware Configuration](#hardware-configuration)
3. [Button Configuration](#button-configuration)
4. [Encoder Configuration](#encoder-configuration)
5. [Profile Management](#profile-management)
6. [Security Settings](#security-settings)
7. [Performance Monitoring](#performance-monitoring)
8. [Advanced Features](#advanced-features)
9. [Platform-Specific Guide](#platform-specific-guide)
10. [Tips & Best Practices](#tips--best-practices)

## Overview

The Macro Keyboard application transforms a physical Arduino-based button grid into a powerful automation tool. Each button and rotary encoder can trigger keyboard shortcuts, launch applications, or execute custom commands.

### Key Features
- **Multi-Platform**: Works on macOS, Windows, and Linux
- **Flexible Hardware**: Support for 8-32 buttons + up to 8 encoders
- **Context-Aware**: Automatic profile switching based on active applications
- **Secure**: Built-in validation prevents malicious commands
- **Extensible**: Plugin system for custom functionality

## Hardware Configuration

### Accessing Hardware Settings

**macOS/Windows**: Click the status bar/system tray icon → "Hardware Configuration"
**Linux**: Edit `~/.config/macro-keyboard/config.yaml` directly

### Serial Connection Setup

1. **Connect Arduino** via USB
2. **Detect Port**: Click "Scan Ports" to find your Arduino
3. **Select Port**: Choose from the dropdown list
4. **Test Connection**: Click "Test Connection" to verify

**Port Examples:**
- macOS: `/dev/tty.usbmodem14101`
- Windows: `COM3`, `COM4`
- Linux: `/dev/ttyUSB0`, `/dev/ttyACM0`

### Button Matrix Configuration

Configure your hardware layout:

1. **Select Button Count**: Choose 8, 12, 16, 24, or 32
2. **Apply Configuration**: Click "Apply" to send settings to Arduino
3. **Test Buttons**: Use "Hardware Test" to verify all buttons work

**Supported Configurations:**
| Buttons | Matrix Size | Recommended For |
|---------|-------------|-----------------|
| 8 | 2×4 | Beginners, basic controls |
| 12 | 3×4 | Media controls, shortcuts |
| 16 | 4×4 | **Most popular**, balanced |
| 24 | 4×6 | Power users, multiple apps |
| 32 | 4×8 | Advanced users, comprehensive |

### Rotary Encoder Setup

1. **Set Encoder Count**: Enter number of encoders (0-8)
2. **Apply Configuration**: Send to Arduino
3. **Test Rotation**: Verify clockwise/counter-clockwise detection

**Encoder Uses:**
- Volume/brightness control
- Scrolling through options
- Zooming in/out
- Timeline scrubbing

## Button Configuration

### Basic Button Setup

Each button has these properties:

- **Description**: Human-readable label (for your reference)
- **Type**: Action type (`keypress`, `application`, `command`)
- **Action**: The specific action to perform
- **Enabled**: Whether the button is active

### Action Types Explained

#### 1. Keypress Actions

Send keyboard shortcuts and key combinations.

**Examples:**
```yaml
# Volume controls
action: "VolumeUp"
action: "VolumeDown" 
action: "AudioMute"

# Common shortcuts
action: "cmd+c"      # Copy (macOS)
action: "ctrl+c"     # Copy (Windows/Linux)
action: "cmd+shift+3" # Screenshot (macOS)
action: "win+shift+s" # Screenshot (Windows)

# Navigation
action: "cmd+tab"    # App switcher (macOS)
action: "alt+tab"    # App switcher (Windows/Linux)
```

**Key Modifiers:**
- `cmd`/`command`: Command key (macOS), Windows key (Windows)
- `ctrl`/`control`: Control key (all platforms)
- `alt`/`option`: Alt/Option key (all platforms)
- `shift`: Shift key (all platforms)
- `win`/`meta`: Windows/Meta key

**Special Keys:**
- `space`, `enter`, `tab`, `escape`
- `up`, `down`, `left`, `right`
- `f1` through `f12`
- `home`, `end`, `pageup`, `pagedown`

#### 2. Application Actions

Launch applications by name or path.

**Examples:**
```yaml
# By application name
action: "Calculator"
action: "Terminal"
action: "Safari"

# By full path (more reliable)
action: "/Applications/Visual Studio Code.app"
action: "C:\Program Files\Google\Chrome\chrome.exe"
```

**Platform-Specific App Names:**
| Function | macOS | Windows | Linux |
|----------|-------|---------|-------|
| Calculator | `Calculator` | `calc` | `gnome-calculator` |
| Terminal | `Terminal` | `cmd` | `gnome-terminal` |
| Text Editor | `TextEdit` | `notepad` | `gedit` |
| Web Browser | `Safari` | `msedge` | `firefox` |

#### 3. Command Actions

Execute shell commands with security validation.

**Safe Examples:**
```yaml
# Display notifications
action: "osascript -e 'display notification \"Hello!\"'"  # macOS
action: "notify-send 'Hello!'"  # Linux

# File operations
action: "ls -la"
action: "pwd"
action: "date"

# System info
action: "whoami"
action: "uname -a"
```

**⚠️ Security Note**: Commands are validated for safety. Dangerous patterns like `rm -rf`, `sudo`, and command injection are blocked.

### Configuration Interface

#### GUI Configuration (macOS/Windows)

1. **Open Settings**: Click status bar icon → "Configuration"
2. **Select Button**: Click button number (1-32)
3. **Set Properties**: Fill in description, type, and action
4. **Save**: Click "Save Configuration"
5. **Test**: Click "Test Button" to verify

#### YAML Configuration (All Platforms)

Edit `~/.config/macro-keyboard/config.yaml`:

```yaml
buttons:
  button1:
    description: "Volume Up"
    type: "keypress"
    action: "VolumeUp"
    enabled: true
    
  button2:
    description: "Launch Calculator"
    type: "application"
    action: "Calculator"
    enabled: true
    
  button3:
    description: "Show Date"
    type: "command"
    action: "date"
    enabled: true
```

## Encoder Configuration

### Basic Encoder Setup

Each encoder has separate actions for clockwise (CW) and counter-clockwise (CCW) rotation:

```yaml
encoders:
  encoder1:
    description: "Volume Control"
    typeCW: "keypress"
    actionCW: "VolumeUp"
    typeCCW: "keypress" 
    actionCCW: "VolumeDown"
```

### Common Encoder Uses

#### Volume Control
```yaml
encoder1:
  description: "System Volume"
  typeCW: "keypress"
  actionCW: "VolumeUp"
  typeCCW: "keypress"
  actionCCW: "VolumeDown"
```

#### Brightness Control  
```yaml
encoder2:
  description: "Screen Brightness"
  typeCW: "keypress"
  actionCW: "f2"        # Brightness up (macOS)
  typeCCW: "keypress"
  actionCCW: "f1"       # Brightness down (macOS)
```

#### Application Switching
```yaml
encoder3:
  description: "App Switcher"
  typeCW: "keypress"
  actionCW: "cmd+tab"
  typeCCW: "keypress"
  actionCCW: "cmd+shift+tab"
```

#### Zoom Control
```yaml
encoder4:
  description: "Zoom Control"
  typeCW: "keypress"
  actionCW: "cmd+plus"   # Zoom in
  typeCCW: "keypress"
  actionCCW: "cmd+minus" # Zoom out
```

## Profile Management

Profiles allow you to have different button configurations for different contexts.

### Creating Profiles

1. **Access Profile Manager**: Settings → "Profiles"
2. **Create New**: Click "New Profile"
3. **Name Profile**: Give it a descriptive name (e.g., "Video Editing")
4. **Configure Buttons**: Set up buttons for this specific context
5. **Save Profile**: Click "Save"

### Switching Profiles

#### Manual Switching
- **GUI**: Click current profile name → select new profile
- **Keyboard**: Use assigned profile switch button
- **System Tray**: Right-click → "Profiles" → select profile

#### Automatic Switching
Set up context-aware profile switching:

```yaml
profiles:
  video-editing:
    name: "Video Editing"
    triggers:
      applications: ["Final Cut Pro", "Adobe Premiere Pro"]
      windowTitles: ["*video*", "*editing*"]
    
  coding:
    name: "Development"  
    triggers:
      applications: ["Visual Studio Code", "Xcode"]
      windowTitles: ["*.js", "*.py", "*.cpp"]
```

**Trigger Options:**
- `applications`: Switch when specific apps are active
- `windowTitles`: Switch based on window titles (supports wildcards)
- `timeRanges`: Switch during specific time periods
- `networkConnections`: Switch based on network/location

### Profile Examples

#### Media Control Profile
```yaml
buttons:
  button1: { type: "keypress", action: "space", description: "Play/Pause" }
  button2: { type: "keypress", action: "left", description: "Previous" }
  button3: { type: "keypress", action: "right", description: "Next" }
  button4: { type: "keypress", action: "VolumeUp", description: "Volume +" }
  button5: { type: "keypress", action: "VolumeDown", description: "Volume -" }
```

#### Development Profile
```yaml
buttons:
  button1: { type: "keypress", action: "cmd+s", description: "Save" }
  button2: { type: "keypress", action: "cmd+shift+p", description: "Command Palette" }
  button3: { type: "application", action: "Terminal", description: "Terminal" }
  button4: { type: "keypress", action: "cmd+`", description: "Terminal Toggle" }
  button5: { type: "command", action: "git status", description: "Git Status" }
```

#### Gaming Profile
```yaml
buttons:
  button1: { type: "keypress", action: "f1", description: "Quick Save" }
  button2: { type: "keypress", action: "f9", description: "Quick Load" }
  button3: { type: "keypress", action: "tab", description: "Map/Inventory" }
  button4: { type: "keypress", action: "escape", description: "Menu" }
  button5: { type: "application", action: "Discord", description: "Discord" }
```

## Security Settings

The application includes comprehensive security to prevent malicious actions.

### Security Modes

#### Command Execution Security

**Allowlist Mode** (Most Secure):
```yaml
security:
  commandExecution:
    mode: "allowlist"
    allowedCommands:
      - "ls"
      - "pwd"
      - "date"
      - "echo"
      - "whoami"
```

**Blacklist Mode** (Balanced):
```yaml
security:
  commandExecution:
    mode: "blacklist"  
    blockedCommands:
      - "rm"
      - "sudo"
      - "passwd"
      - "chmod"
```

**Disabled Mode** (No Validation):
```yaml
security:
  commandExecution:
    mode: "disabled"  # Not recommended
```

#### Application Security

Control which applications can be launched:

```yaml
security:
  applicationExecution:
    mode: "allowlist"
    allowedApplications:
      - "Calculator"
      - "TextEdit" 
      - "Safari"
      - "Chrome"
```

### Security Best Practices

1. **Use Allowlist Mode**: In production/shared environments
2. **Regular Review**: Periodically review allowed commands/apps
3. **Principle of Least Privilege**: Only allow what's needed
4. **Monitor Logs**: Check security logs for blocked attempts
5. **Update Regularly**: Keep security patterns current

## Performance Monitoring

Monitor your macro keyboard's performance and optimize usage.

### Performance Dashboard

Access via Settings → "Performance":

- **Button Response Time**: Average time from press to action
- **Memory Usage**: Current application memory consumption  
- **Action Success Rate**: Percentage of successful actions
- **Serial Communication**: Connection stability metrics

### Performance Alerts

Configure alerts for performance issues:

```yaml
performance:
  alerts:
    enabled: true
    thresholds:
      buttonResponseTime: 100    # ms
      memoryUsage: 1073741824   # 1GB
      actionFailureRate: 5      # %
```

### Optimization Tips

1. **Reduce Command Complexity**: Use simple, fast commands
2. **Optimize Serial Communication**: Ensure good USB connection
3. **Profile Switching**: Use context-aware switching to reduce config size
4. **Plugin Management**: Disable unused plugins
5. **Log Level**: Use "info" or "warn" level in production

## Advanced Features

### Macro Recording

Record complex key sequences:

1. **Start Recording**: Click "Record Macro"
2. **Perform Actions**: Type, click, wait as needed  
3. **Stop Recording**: Click "Stop Recording"
4. **Assign to Button**: Select button and save

**Example Recorded Macro:**
```yaml
button5:
  type: "macro"
  action:
    - { type: "keypress", action: "cmd+a", delay: 100 }
    - { type: "keypress", action: "cmd+c", delay: 100 }
    - { type: "keypress", action: "cmd+tab", delay: 200 }
    - { type: "keypress", action: "cmd+v", delay: 100 }
```

### LED Integration

Add visual feedback with RGB LEDs:

```yaml
leds:
  enabled: true
  buttonCount: 16
  brightness: 128
  effects:
    buttonPress: "flash"
    profileSwitch: "rainbow"
    error: "red_pulse"
```

### Voice Recognition

Control with voice commands:

```yaml
voice:
  enabled: true
  commands:
    "macro one": "button1"
    "volume up": "button2"
    "take screenshot": "button3"
```

### Plugin System

Extend functionality with plugins:

1. **Browse Plugins**: Settings → "Plugins" → "Browse"
2. **Install Plugin**: Click "Install" next to desired plugin
3. **Configure Plugin**: Set plugin-specific options
4. **Enable Plugin**: Toggle to activate

**Popular Plugins:**
- **Spotify Control**: Advanced music controls
- **Home Assistant**: Smart home integration  
- **OBS Studio**: Streaming controls
- **Discord**: Server/channel quick actions

## Platform-Specific Guide

### macOS

**Status Bar Integration:**
- Icon appears in top-right status bar
- Right-click for quick actions
- Cmd+click for configuration

**Key Combinations:**
- Use `cmd` instead of `ctrl` for most shortcuts
- `cmd+space` for Spotlight
- `cmd+tab` for app switching

**Notification Center:**
- Action results appear as native notifications
- Configure in System Preferences → Notifications

### Windows

**System Tray Integration:**
- Icon appears in bottom-right system tray
- Right-click for context menu
- Double-click for main window

**Key Combinations:**  
- Use `ctrl` for most shortcuts
- `win+r` for Run dialog
- `alt+tab` for app switching

**Windows Integration:**
- Action results appear as Windows notifications
- Configure notification settings in Windows Settings

### Linux

**Service Mode:**
- Runs as background service (no GUI by default)
- Configuration via YAML files
- Status via command line tools

**Desktop Environment Support:**
- **GNOME**: Native notification support
- **KDE**: System tray integration available
- **XFCE**: Basic notification support

**Key Combinations:**
- Use `ctrl` for most shortcuts  
- `super` for activities overview
- `alt+f2` for run command

## Tips & Best Practices

### Button Layout Strategy

1. **Logical Grouping**: Group related functions together
2. **Muscle Memory**: Place frequently used actions in consistent positions
3. **Visual Aids**: Use descriptive labels and LED colors
4. **Progressive Complexity**: Start simple, add complexity gradually

### Workflow Integration

1. **Application-Specific Profiles**: Different layouts for different apps
2. **Time-Based Switching**: Work vs. entertainment profiles
3. **Project-Based**: Different configurations for different projects
4. **Team Sharing**: Export/import configurations across team members

### Maintenance

1. **Regular Backups**: Export configurations regularly
2. **Update Checks**: Keep firmware and software current
3. **Hardware Inspection**: Check connections periodically
4. **Performance Review**: Monitor and optimize performance

### Troubleshooting Quick Tips

1. **Connection Issues**: Check USB cable, try different port
2. **Button Not Working**: Verify wiring, check configuration
3. **Action Not Executing**: Check security settings, review logs
4. **Performance Problems**: Reduce complexity, check system resources

---

**Need More Help?**
- [Troubleshooting Guide](./TROUBLESHOOTING.md): Detailed problem solving
- [FAQ](./FAQ.md): Common questions and answers
- [Community Forum](https://github.com/jmassardo/macro-keyboard/discussions): Connect with other users
- [GitHub Issues](https://github.com/jmassardo/macro-keyboard/issues): Report bugs or request features
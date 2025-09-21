# Getting Started with Macro Keyboard

Welcome to Macro Keyboard! This guide will help you set up and start using your macro keyboard in minutes.

## Table of Contents

1. [What You'll Need](#what-youll-need)
2. [Hardware Setup](#hardware-setup)
3. [Software Installation](#software-installation)
4. [First-Time Configuration](#first-time-configuration)
5. [Your First Macro](#your-first-macro)
6. [Next Steps](#next-steps)

## What You'll Need

### Hardware Requirements
- **Arduino Micro** (or compatible microcontroller)
- **Push buttons** (8, 12, 16, 24, or 32 buttons)
- **Rotary encoders** (optional, up to 8)
- **Breadboard or PCB** for connections
- **Jumper wires** and **diodes** (1N4148 recommended)
- **USB cable** (micro-USB to USB-A)

### Software Requirements
- **Computer** running macOS 10.14+, Windows 10+, or Ubuntu 18.04+
- **Arduino IDE** (for firmware upload)
- **Node.js 18+** (for development only)

### Skill Level
- **Beginner**: Basic electronics knowledge helpful
- **Time Required**: 30-60 minutes for complete setup

## Hardware Setup

### Step 1: Plan Your Layout

Choose your button configuration:
- **8 buttons**: 2×4 matrix (great for beginners)
- **12 buttons**: 3×4 matrix 
- **16 buttons**: 4×4 matrix (most popular)
- **24 buttons**: 4×6 matrix
- **32 buttons**: 4×8 matrix (advanced users)

### Step 2: Wire the Button Matrix

> **💡 Tip**: Always disconnect USB power when wiring!

#### Basic 4×4 (16 button) Example:

**Row Connections:**
```
Row 1: Arduino Pin 2 → Buttons 1,2,3,4
Row 2: Arduino Pin 3 → Buttons 5,6,7,8  
Row 3: Arduino Pin 4 → Buttons 9,10,11,12
Row 4: Arduino Pin 5 → Buttons 13,14,15,16
```

**Column Connections:**
```
Col 1: Arduino Pin 6 → Buttons 1,5,9,13
Col 2: Arduino Pin 7 → Buttons 2,6,10,14
Col 3: Arduino Pin 8 → Buttons 3,7,11,15
Col 4: Arduino Pin 9 → Buttons 4,8,12,16
```

#### Wiring Diagram
```
    Pin 6   Pin 7   Pin 8   Pin 9
     |       |       |       |
Pin 2─●─── [1] ─── [2] ─── [3] ─── [4]
     |       |       |       |
Pin 3─●─── [5] ─── [6] ─── [7] ─── [8]
     |       |       |       |
Pin 4─●─── [9] ─── [10] ── [11] ── [12]
     |       |       |       |
Pin 5─●─── [13] ── [14] ── [15] ── [16]

● = Diode (cathode toward Arduino pin)
```

**Important**: Add a diode (1N4148) on each row connection to prevent "ghosting" (false button presses).

### Step 3: Add Rotary Encoders (Optional)

Connect rotary encoders to analog pins:

**Encoder 1:**
- Pin A → A0
- Pin B → Pin 14
- Common → Ground

**Encoder 2:**
- Pin A → A1  
- Pin B → Pin 15

Continue this pattern for additional encoders (up to 8).

### Step 4: Upload Arduino Firmware

1. **Download Arduino IDE** from [arduino.cc](https://arduino.cc)
2. **Open the firmware**: `arduino/macro-keyboard-firmware/macro-keyboard-firmware.ino`
3. **Connect Arduino** via USB
4. **Select board**: Tools → Board → Arduino Micro
5. **Select port**: Tools → Port → (your Arduino port)
6. **Upload**: Click the upload button (→)

The firmware will auto-detect your hardware configuration when you set it up in the desktop app!

## Software Installation

### Option 1: Download Release (Recommended)

1. **Visit** [GitHub Releases](https://github.com/jmassardo/macro-keyboard/releases)
2. **Download** the latest version for your platform:
   - macOS: `Macro-Keyboard-X.X.X.dmg`
   - Windows: `Macro-Keyboard-Setup-X.X.X.exe`  
   - Linux: `Macro-Keyboard-X.X.X.AppImage`
3. **Install** using your system's standard process

### Option 2: Build from Source

```bash
# Clone repository
git clone https://github.com/jmassardo/macro-keyboard.git
cd macro-keyboard

# Install dependencies
npm install

# Start application
npm start
```

## First-Time Configuration

### Step 1: Launch the Application

**macOS**: Look for the macro keyboard icon in your status bar (top-right)
**Windows**: Check your system tray (bottom-right corner)
**Linux**: The app runs as a background service

### Step 2: Connect Your Hardware

1. **Click** the macro keyboard icon
2. **Select** "Hardware Configuration"
3. **Choose** your Arduino's serial port from the dropdown
4. **Set** button count (8, 12, 16, 24, or 32)
5. **Set** encoder count (0-8)
6. **Click** "Apply Configuration"

The app will automatically configure your Arduino - no firmware reflashing needed!

### Step 3: Test Hardware Connection

1. **Click** "Test Hardware" 
2. **Press each button** on your keyboard
3. **Rotate each encoder** (if you have any)
4. **Verify** all inputs are detected

Green checkmarks mean everything is working perfectly!

## Your First Macro

Let's set up a simple volume control macro:

### Step 1: Configure Button Actions

1. **Open** the configuration interface
2. **Select** "Button Configuration"
3. **Choose** Button 1:
   - **Description**: "Volume Up"
   - **Type**: "Keypress"
   - **Action**: "VolumeUp"
4. **Choose** Button 2:
   - **Description**: "Volume Down"
   - **Type**: "Keypress"  
   - **Action**: "VolumeDown"
5. **Choose** Button 3:
   - **Description**: "Mute Toggle"
   - **Type**: "Keypress"
   - **Action**: "AudioMute"

### Step 2: Save Configuration

Click **"Save Configuration"** and test your buttons!

### Step 3: Try More Action Types

#### Launch Applications:
```yaml
Button 4:
  Description: "Calculator"
  Type: "Application"
  Action: "Calculator"
```

#### Custom Commands:
```yaml
Button 5:
  Description: "Take Screenshot"  
  Type: "Command"
  Action: "screencapture -c"  # macOS clipboard screenshot
```

#### Keyboard Shortcuts:
```yaml
Button 6:
  Description: "Copy"
  Type: "Keypress"
  Action: "cmd+c"  # macOS (use "ctrl+c" for Windows/Linux)
```

## Next Steps

Congratulations! Your macro keyboard is now working. Here's what to explore next:

### 🎯 **Immediate Actions**
- [Configure all your buttons](./USER_MANUAL.md#button-configuration) 
- [Set up rotary encoders](./USER_MANUAL.md#encoder-configuration)
- [Try different action types](./ACTION_EXECUTION.md)

### 🚀 **Advanced Features**
- [**Context-Aware Profiles**](./CONTEXT_AWARE_PROFILES.md): Automatic profile switching
- [**Macro Recording**](./MACRO_RECORDING.md): Record complex key sequences
- [**Plugin System**](./PLUGIN_DEVELOPMENT.md): Extend functionality

### 🔧 **Customization**
- [**Security Configuration**](./SECURITY_GUIDE.md): Configure command validation
- [**Performance Tuning**](./PERFORMANCE_GUIDE.md): Optimize for your workflow
- [**LED Integration**](./RGB_LED_INTEGRATION.md): Add visual feedback

### 📚 **Learning Resources**
- [**User Manual**](./USER_MANUAL.md): Complete feature reference
- [**Troubleshooting**](./TROUBLESHOOTING.md): Common issues and solutions
- [**FAQ**](./FAQ.md): Frequently asked questions

### 🤝 **Community**
- [**Contributing Guide**](./CONTRIBUTING.md): Help improve the project
- [**GitHub Issues**](https://github.com/jmassardo/macro-keyboard/issues): Report bugs or request features
- [**Discussions**](https://github.com/jmassardo/macro-keyboard/discussions): Connect with other users

## Quick Reference

### Common Actions
| Action Type | Example | Description |
|-------------|---------|-------------|
| `keypress` | `cmd+c` | Send keyboard shortcuts |
| `application` | `Calculator` | Launch applications |
| `command` | `echo "Hello"` | Execute shell commands |

### Platform-Specific Keys
| Function | macOS | Windows | Linux |
|----------|-------|---------|-------|
| Copy | `cmd+c` | `ctrl+c` | `ctrl+c` |
| Screenshot | `cmd+shift+3` | `win+shift+s` | `printscreen` |
| Lock Screen | `cmd+ctrl+q` | `win+l` | `ctrl+alt+l` |

### Serial Ports
| Platform | Typical Paths |
|----------|---------------|
| macOS | `/dev/tty.usbmodem*` |
| Windows | `COM3`, `COM4`, etc. |
| Linux | `/dev/ttyUSB*`, `/dev/ttyACM*` |

---

**Need Help?** Check our [Troubleshooting Guide](./TROUBLESHOOTING.md) or [open an issue](https://github.com/jmassardo/macro-keyboard/issues) on GitHub.

**Want to Contribute?** See our [Contributing Guidelines](./CONTRIBUTING.md) to get started.
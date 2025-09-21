# Frequently Asked Questions (FAQ)

*Quick answers to common questions about the Macro Keyboard project*

## General Questions

### Q: What is the Macro Keyboard project?
**A:** The Macro Keyboard is an open-source project that transforms an Arduino-based hardware keypad into a powerful automation tool. It consists of:
- Arduino firmware for button matrix and rotary encoder scanning
- Cross-platform desktop application (Electron-based) for configuration and control
- Support for 8-32 buttons plus up to 8 rotary encoders

### Q: What platforms are supported?
**A:** The desktop application runs on:
- **macOS** 10.14+ (Mojave and later)
- **Windows** 10+ (64-bit)
- **Linux** Ubuntu 18.04+ and compatible distributions

The Arduino firmware works with Arduino Micro and compatible boards.

### Q: Is this project free to use?
**A:** Yes! The project is released under the MIT License, meaning it's free to use, modify, and distribute. Both the source code and pre-built releases are available at no cost.

### Q: Do I need programming experience to use this?
**A:** No programming experience is required for basic use. The project includes:
- Pre-built desktop applications for all platforms
- Pre-compiled Arduino firmware
- GUI-based configuration (no code editing needed)
- Comprehensive documentation and setup guides

However, programming knowledge is helpful for:
- Custom modifications
- Plugin development
- Advanced troubleshooting

## Hardware Questions

### Q: What Arduino board should I use?
**A:** We recommend the **Arduino Micro** because:
- Native USB support (appears as HID device)
- Sufficient pins for large button matrices
- 5V operation compatible with most switches
- Small form factor
- Wide availability

Compatible alternatives include Arduino Leonardo, Pro Micro, and other ATmega32u4-based boards.

### Q: What's the maximum number of buttons I can connect?
**A:** The firmware supports up to **32 buttons** in a matrix configuration:
- 8 buttons: 2×4 matrix
- 12 buttons: 3×4 matrix  
- 16 buttons: 4×4 matrix (most popular)
- 24 buttons: 4×6 matrix
- 32 buttons: 4×8 matrix

Plus up to **8 rotary encoders** for additional input options.

### Q: Do I need diodes for the button matrix?
**A:** **Yes, absolutely!** Each button needs a diode (1N4148 recommended) to prevent "ghosting" - where pressing one button triggers others. Connect the cathode (black band) toward the Arduino pin.

Without diodes, you'll experience:
- False button presses
- Multiple buttons triggering from single press
- Unreliable operation with larger matrices

### Q: What type of switches should I use?
**A:** Any momentary push button will work:
- **Mechanical keyboard switches** (Cherry MX, Gateron, etc.) - excellent feel
- **Tactile buttons** - good for prototyping
- **Arcade buttons** - fun for gaming applications
- **Membrane switches** - low-profile option

Avoid latching switches (they stay pressed) - use only momentary switches.

### Q: Can I use rotary encoders?
**A:** Yes! The system supports up to 8 rotary encoders. Each encoder can have different actions for clockwise and counter-clockwise rotation. Popular uses include:
- Volume control
- Brightness adjustment
- Scrolling through options
- Zoom in/out
- Timeline scrubbing

### Q: What about RGB LEDs?
**A:** LED support is available through the plugin system. You can add:
- Individual button backlighting
- Status indicators
- Profile indication
- Visual feedback for actions

See the [RGB LED Integration Guide](./RGB_LED_INTEGRATION.md) for details.

### Q: Can I power the Arduino from USB?
**A:** Yes, USB power is sufficient for basic configurations (16 buttons + 2 encoders). For larger configurations with LEDs, you may need:
- Powered USB hub
- External 5V power supply
- Higher-capacity USB port (some laptop ports are limited)

## Software Questions

### Q: Do I need to install Arduino IDE?
**A:** Only for initial firmware upload. After that:
- Hardware configuration is done through the desktop app
- No need to reflash firmware for different button counts
- Updates can be installed automatically

For first-time setup:
1. Install Arduino IDE
2. Upload the firmware once
3. Use desktop app for all configuration

### Q: How do I configure buttons?
**A:** Configuration is done through the desktop application:

**GUI Method (macOS/Windows):**
1. Click status bar/system tray icon
2. Select "Configuration"
3. Choose button number
4. Set description, type, and action
5. Save configuration

**File Method (all platforms):**
Edit `~/.config/macro-keyboard/config.yaml`:
```yaml
buttons:
  button1:
    description: "Volume Up"
    type: "keypress"
    action: "VolumeUp"
```

### Q: What types of actions can I assign to buttons?
**A:** Three main action types are supported:

1. **Keypress**: Send keyboard shortcuts
   - `"VolumeUp"`, `"VolumeDown"`, `"AudioMute"`
   - `"cmd+c"`, `"ctrl+alt+t"`, `"f1"`
   - Any key combination your OS supports

2. **Application**: Launch programs
   - `"Calculator"`, `"Terminal"`, `"Safari"`
   - Full paths: `"/Applications/Visual Studio Code.app"`

3. **Command**: Execute shell commands (with security validation)
   - `"echo 'Hello World'"`, `"date"`, `"ls -la"`
   - Platform-specific commands for notifications, screenshots, etc.

### Q: Are there security restrictions on commands?
**A:** Yes, for safety. The system blocks dangerous patterns like:
- File deletion commands (`rm -rf`)
- Privilege escalation (`sudo`)
- System file access (`/etc/passwd`)
- Command injection attempts
- Password utilities (`passwd`)

You can configure security modes:
- **Allowlist**: Only explicitly allowed commands (most secure)
- **Blacklist**: Block known dangerous patterns (default)
- **Disabled**: No restrictions (not recommended)

### Q: Can I have different button layouts for different applications?
**A:** Yes! This is called "Context-Aware Profiles":

**Manual Switching:**
- Create multiple profiles
- Switch between them using GUI or assigned buttons

**Automatic Switching:**
- Configure triggers based on active application
- Switch when specific windows are focused
- Time-based switching (work vs. personal hours)
- Network-based switching (home vs. office)

Example:
```yaml
profiles:
  video-editing:
    triggers:
      applications: ["Final Cut Pro", "Adobe Premiere"]
  coding:  
    triggers:
      applications: ["VS Code", "Xcode"]
```

### Q: How do I update the software?
**A:** The application includes automatic update checking:

1. **Automatic**: Enable in settings for seamless updates
2. **Manual**: Download latest release from GitHub
3. **Development**: `git pull` and `npm start` for latest features

Updates include both desktop application and Arduino firmware when needed.

## Configuration Questions

### Q: Where are configuration files stored?
**A:** Configuration location varies by platform:

- **macOS**: `~/Library/Application Support/macro-keyboard/config.yaml`
- **Windows**: `%APPDATA%\macro-keyboard\config.yaml`  
- **Linux**: `~/.config/macro-keyboard/config.yaml`

You can also access via:
- GUI: Settings → "Open Config Folder"
- Command line: Application displays path on startup

### Q: Can I backup and restore my configuration?
**A:** Absolutely! Configuration is stored in standard YAML files:

**Backup:**
```bash
# Copy the entire configuration directory
cp -r ~/.config/macro-keyboard/ ~/macro-keyboard-backup/
```

**Restore:**
```bash
# Replace current config with backup
cp -r ~/macro-keyboard-backup/ ~/.config/macro-keyboard/
```

**Share configurations:**
- Export specific profiles to share with team members
- Version control configurations with git
- Create configuration templates for different use cases

### Q: How do I reset to default configuration?
**A:** Two methods:

**Through GUI (if accessible):**
1. Settings → "Reset Configuration"
2. Confirm reset
3. Restart application

**Manual reset:**
```bash
# Remove configuration file - app will create defaults
rm ~/.config/macro-keyboard/config.yaml
# Restart application
```

### Q: Can I use environment variables in configuration?
**A:** Yes, for certain values:
```yaml
buttons:
  button1:
    action: "${HOME}/my-script.sh"  # Expands to home directory
    
logging:
  file: "${LOG_DIR}/macro-keyboard.log"  # Custom log location
```

## Troubleshooting Questions

### Q: My Arduino isn't detected. What should I check?
**A:** Follow this diagnostic sequence:

1. **USB Connection**:
   - Try different USB cable (many are power-only)
   - Try different USB port
   - Check Arduino power LED

2. **Drivers**:
   - Windows: Install Arduino drivers from arduino.cc
   - macOS: Should work automatically
   - Linux: Add user to `dialout` group

3. **Hardware**:
   - Press Arduino reset button
   - Verify with Arduino IDE Serial Monitor first
   - Check for conflicts with other software

### Q: Buttons aren't responding. How do I troubleshoot?
**A:** Systematic approach:

1. **Test with Hardware Test mode** in the app
2. **Check wiring** - especially diode orientation
3. **Verify configuration** - button count matches hardware
4. **Check logs** for error messages
5. **Test individual buttons** with multimeter
6. **Try minimal configuration** (4 buttons) first

### Q: Actions execute slowly or not at all. What's wrong?
**A:** Performance issues can have several causes:

**Check System Resources:**
- High CPU usage from other programs
- Insufficient memory
- Background processes interfering

**Configuration Issues:**
- Complex commands taking too long
- Security blocking actions
- Incorrect action syntax

**Enable Debug Mode:**
```yaml
logging:
  level: "debug"
```
This reveals timing and execution details.

### Q: How do I enable debug logging?
**A:** Edit configuration file:
```yaml
logging:
  level: "debug"          # vs "info", "warn", "error"
  enableConsole: true     # Show logs in terminal
  file: "logs/debug.log"  # Custom log file
```

Debug logs show:
- Detailed action execution steps
- Serial communication data
- Performance timing
- Security validation details

### Q: The application crashes on startup. How do I fix this?
**A:** Try these recovery steps:

1. **Check log files** for error details
2. **Reset configuration** to defaults
3. **Run from terminal** to see error messages:
   ```bash
   # macOS
   /Applications/Macro\ Keyboard.app/Contents/MacOS/Macro\ Keyboard
   
   # Linux  
   ./Macro-Keyboard-*.AppImage
   ```
4. **Reinstall application** if configuration reset doesn't help
5. **Check system permissions** (especially on macOS)

## Advanced Questions

### Q: Can I write plugins for the macro keyboard?
**A:** Yes! The plugin system allows custom extensions:

**Plugin capabilities:**
- Custom action types
- External service integrations
- Hardware extensions
- UI components

**Getting started:**
```bash
# Generate plugin template
npm run create-plugin my-plugin

# Development with hot-reload
# Enable in config:
plugins:
  development:
    enableDevMode: true
    hotReload: true
```

See the [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) for complete details.

### Q: How do I contribute to the project?
**A:** We welcome contributions! Here's how to get started:

1. **Read the [Contributing Guide](./CONTRIBUTING.md)**
2. **Check [GitHub Issues](https://github.com/jmassardo/macro-keyboard/issues)** for needed work
3. **Join [Discussions](https://github.com/jmassardo/macro-keyboard/discussions)** for questions
4. **Fork the repository** and submit pull requests

**Areas where help is needed:**
- Documentation improvements
- Testing on different platforms
- New plugin development
- Hardware design contributions
- Bug fixes and feature enhancements

### Q: Can I use this commercially?
**A:** Yes! The MIT License allows commercial use:
- Use in commercial products
- Sell hardware kits using this software
- Integrate into business workflows
- Create derivative commercial products

**Requirements:**
- Include MIT license text
- Attribute original project
- No warranty provided

### Q: How do I integrate with external services?
**A:** Several methods available:

**Direct Integration:**
```yaml
# Use commands to call APIs
button1:
  type: "command"
  action: 'curl -X POST "https://api.example.com/trigger"'
```

**Plugin System:**
- Develop plugins for specific services
- Handle authentication securely
- Provide user-friendly configuration

**Available Integrations:**
- Home Assistant (smart home)
- OBS Studio (streaming)  
- Spotify (music control)
- Discord (communication)
- Custom web APIs

### Q: What's the roadmap for future development?
**A:** Key areas of ongoing development:

**Near Term (3-6 months):**
- Enhanced plugin marketplace
- Improved cross-platform compatibility
- Better visual configuration tools
- Expanded hardware support

**Medium Term (6-12 months):**
- Mobile app integration
- Cloud configuration sync
- Advanced macro recording
- Voice recognition improvements

**Long Term (12+ months):**
- Machine learning for usage optimization
- IoT device integration
- Enterprise management features
- Hardware design kits

See [Production Roadmap](./PRODUCTION_ROADMAP.md) for detailed plans.

### Q: How do I get performance metrics?
**A:** The built-in performance monitor provides:

**Real-time Metrics:**
- Button response time
- Memory usage
- Action success rates
- Serial communication stability

**Historical Data:**
- Performance trends over time
- Usage patterns
- Optimization suggestions

**Access Methods:**
- GUI: Settings → "Performance Dashboard"
- Logs: Performance data logged regularly
- Export: JSON/CSV export for analysis

### Q: Can I run this on a Raspberry Pi?
**A:** The desktop application can run on Raspberry Pi with some limitations:

**Supported:**
- Command-line configuration
- Basic action execution
- Serial communication with Arduino

**Limitations:**
- No GUI (headless mode only)
- Reduced performance on older Pi models
- Some robotjs features may not work

**Setup:**
```bash
# Install on Raspberry Pi
git clone https://github.com/jmassardo/macro-keyboard.git
cd macro-keyboard
npm install --production
npm start
```

## Getting More Help

### Q: Where can I find more detailed documentation?
**A:** Complete documentation is available:

- **[Getting Started Guide](./GETTING_STARTED.md)**: Quick setup
- **[User Manual](./USER_MANUAL.md)**: Complete feature reference  
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)**: Problem solving
- **[API Reference](./API_REFERENCE.md)**: Developer documentation
- **[Plugin Development](./PLUGIN_DEVELOPMENT.md)**: Extension guide

### Q: How do I contact the developers?
**A:** Multiple channels available:

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community help
- **Email**: Check repository for maintainer contact info
- **Community Forums**: Links provided in project documentation

### Q: Is there a community around this project?
**A:** Yes! Join the community:

- **GitHub Discussions**: Primary community hub
- **Discord Server**: Real-time chat (link in repo)
- **Reddit**: r/macrokeyboard (unofficial)
- **YouTube**: Tutorial videos and demos

**Community guidelines:**
- Be respectful and helpful
- Search existing discussions before posting
- Provide details when asking for help
- Share your builds and configurations!

---

**Didn't find your answer?** 
- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) for technical issues
- Search [GitHub Issues](https://github.com/jmassardo/macro-keyboard/issues) for similar questions
- Ask in [GitHub Discussions](https://github.com/jmassardo/macro-keyboard/discussions) for community help
# Macro Keyboard

Electron based application to drive a physical macro keyboard with Arduino integration.

## Features

### Hardware Support
- **Buttons**: Support for 8, 12, 16, 24, or 32 button configurations
- **Rotary Encoders**: Up to 8 rotary encoders for additional input options
- **Arduino Micro**: Firmware for Arduino Micro controller

### Cross-Platform Desktop Application
- **macOS**: Status menu integration with native system tray
- **Windows**: System tray integration with Windows-style notifications  
- **Linux**: Headless service mode with configuration file support

### Configuration Management
- YAML-based configuration files for easy editing
- GUI configuration interface (macOS/Windows)
- Hot-reload configuration without restart
- Per-button and per-encoder action assignment

### Macro Recording & Sequences
- **Real-time Recording**: Capture key sequences and timing automatically
- **Playbook System**: Organize macros into reusable playbooks
- **Advanced Timing**: Configurable delays and timing patterns
- **GUI Editor**: Visual macro creation and editing interface
- **Import/Export**: Share macros across devices and teams

### Context-Aware Profiles
- **Automatic Switching**: Switch profiles based on active application, time, or system state
- **Smart Rules Engine**: Create complex switching rules with priorities
- **Manual Override**: Temporary or permanent manual profile control
- **Switch History**: Complete tracking of all profile switches
- **Performance Analytics**: Usage statistics and optimization suggestions

### Action Types
- **Key Press**: Send keyboard shortcuts and key combinations
- **Shell Commands**: Execute system commands and scripts (with security validation)
- **Application Launch**: Launch applications and programs

### Security & Protection
- **Input Validation**: Comprehensive validation of all user actions
- **Command Sanitization**: Automatic cleaning and normalization of inputs
- **Dangerous Pattern Detection**: Blocks malicious commands and system access attempts
- **Configurable Security Policies**: Allowlist/blacklist modes for fine-grained control
- **Cross-platform Protection**: Platform-specific security patterns and controls
- **Security Logging**: Complete audit trail of all security events

### Logging & Monitoring
- Comprehensive logging with Winston
- Activity monitoring and debugging
- Serial communication status tracking

## Quick Start

### New to Macro Keyboards?
👉 **[Complete Getting Started Guide](docs/GETTING_STARTED.md)** - Everything you need to know in 30 minutes

### Already Know What You're Doing?

#### 1. Get the Software
- **[Download Latest Release](https://github.com/jmassardo/macro-keyboard/releases)** (Recommended)
- Or build from source (see [Development Guide](docs/DEVELOPMENT.md))

#### 2. Hardware Setup
- Wire your button matrix with diodes ([Wiring Guide](docs/GETTING_STARTED.md#hardware-setup))
- Flash Arduino firmware ([Arduino Guide](arduino/README.md))
- Connect via USB and configure in the app

#### 3. Configure Your Actions
```yaml
buttons:
  button1:
    description: "Volume Up"
    type: "keypress" 
    action: "VolumeUp"
  
  button2:
    description: "Launch Calculator"
    type: "application"
    action: "Calculator"
  
  button3:
    description: "Take Screenshot"
    type: "keypress"
    action: "cmd+shift+3"  # macOS example
```

**Need Help?** Check our [Troubleshooting Guide](docs/TROUBLESHOOTING.md) or [FAQ](docs/FAQ.md)

## Arduino Firmware

The Arduino firmware supports multiple hardware configurations. See the [Arduino README](arduino/README.md) for detailed instructions.

### Supported Configurations
- 8 buttons (2×4 matrix) + 0-8 encoders
- 12 buttons (3×4 matrix) + 0-8 encoders  
- 16 buttons (4×4 matrix) + 0-8 encoders
- 24 buttons (4×6 matrix) + 0-8 encoders
- 32 buttons (4×8 matrix) + 0-8 encoders

### Flashing Firmware
1. Install Arduino IDE
2. Open `arduino/macro-keyboard-firmware/macro-keyboard-firmware.ino`
3. Configure hardware in `config.h`
4. Upload to Arduino Micro

## Development

### Project Structure
```
macro-keyboard/
├── src/                    # Electron application source
│   ├── main.js            # Main process
│   ├── renderer/          # Renderer process (UI)
│   └── assets/            # Icons and resources
├── arduino/               # Arduino firmware
├── config/                # Configuration files
├── tests/                 # Test files
├── docs/                  # Documentation
└── .github/               # CI/CD workflows
```

### Scripts
```bash
npm start          # Start the application
npm run dev        # Start in development mode
npm run build      # Build for all platforms
npm run lint       # Run ESLint
npm run lint:fix   # Fix linting issues
npm test           # Run tests
npm run icons:generate  # Generate application icons
npm run icons:validate # Validate icon setup
```

### Documentation

#### 📚 **[Complete Documentation Index](docs/DOCUMENTATION_INDEX.md)**
*Your guide to all available documentation - start here to find exactly what you need*

#### Essential Guides
- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Complete setup process for new users
- **[User Manual](docs/USER_MANUAL.md)** - Comprehensive feature reference  
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Solutions for common problems
- **[FAQ](docs/FAQ.md)** - Quick answers to frequent questions

#### Developer Resources
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[Plugin Development Tutorial](docs/PLUGIN_DEVELOPMENT.md)** - Step-by-step plugin creation
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute to the project
- **[Development Guide](docs/DEVELOPMENT.md)** - Development environment setup

#### Advanced Features
- **[Context-Aware Profiles](docs/CONTEXT_AWARE_PROFILES.md)** - Automatic profile switching
- **[Security Architecture](docs/SECURITY_ARCHITECTURE.md)** - Security model and configuration
- **[Plugin Architecture](docs/PLUGIN_ARCHITECTURE.md)** - Plugin system design
- **[Performance Monitoring](docs/PERFORMANCE_MONITORING.md)** - Performance tracking and optimization

#### Hardware Documentation
- **[Arduino Setup Guide](arduino/README.md)** - Hardware setup and firmware installation

### Automated Releases

The project uses automated releases that trigger when code is pushed to the main branch:

1. **CI Pipeline**: All tests, linting, and builds must pass
2. **Version Increment**: Automatically increments version based on commit message:
   - `[major]` - Major version increment (1.0.0 → 2.0.0)
   - `[minor]` - Minor version increment (1.0.0 → 1.1.0)
   - Default - Patch version increment (1.0.0 → 1.0.1)
3. **Release Creation**: Creates GitHub release with platform-specific builds
4. **Assets**: Includes desktop apps for Windows, macOS, Linux and Arduino firmware

### Testing
```bash
# Run all tests
npm test

# Run specific test files
npx jest tests/config.test.js

# Run with coverage
npm test -- --coverage
```

## Platform-Specific Notes

### macOS
- Application appears in the status menu (top bar)
- Uses native macOS notifications
- Supports macOS-specific key combinations

### Windows  
- Application appears in the system tray
- Uses Windows notifications
- Supports Windows-specific key combinations

### Linux
- Runs as a headless service (no GUI)
- Configuration via YAML file only
- Logs to file and console
- Supports standard Linux key combinations

## Troubleshooting

### Serial Port Issues
1. Check that Arduino is properly connected
2. Verify the correct serial port in configuration
3. Ensure no other applications are using the serial port
4. Check Arduino IDE Serial Monitor works first

### Button Matrix Issues
1. Verify wiring connections
2. Check for proper debouncing (firmware handles this)
3. Add diodes if experiencing "ghosting" (multiple buttons registering)

### Application Issues
1. Check logs in `logs/macro-keyboard.log`
2. Verify configuration file syntax (YAML)
3. Restart application after configuration changes

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Serial communication via [node-serialport](https://serialport.io/)
- Configuration management with [js-yaml](https://github.com/nodeca/js-yaml)
- Logging with [Winston](https://github.com/winstonjs/winston)

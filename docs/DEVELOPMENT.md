# Development Guide

## Development Environment Setup

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git
- Arduino IDE (for firmware development)

### Initial Setup
```bash
git clone https://github.com/jmassardo/macro-keyboard.git
cd macro-keyboard
npm install
```

### Development Workflow

#### Running in Development Mode
```bash
npm run dev
```
This starts the Electron app with:
- Hot reload enabled
- DevTools open
- Main window visible (instead of hidden)

#### Code Style and Quality
```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

#### Building
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

**Note:** The electron-builder configuration is set with `"publish": null` to prevent automatic publishing during CI builds. The CI workflow only builds artifacts for testing, while the release workflow handles publishing to GitHub releases when tags are created.

## Project Architecture

### Main Process (`src/main.js`)
The main process handles:
- Application lifecycle
- Window management
- System tray/menu bar integration
- Serial port communication
- Configuration management
- IPC communication with renderer

### Renderer Process (`src/renderer/`)
The renderer process provides:
- Configuration GUI
- Real-time status display
- User interaction handling

### Arduino Firmware (`arduino/`)
- Matrix scanning for buttons
- Encoder state monitoring
- Serial communication protocol
- Configurable hardware support

## Serial Communication Protocol

### From Arduino to Application
```
BTN:<button_id>              # Button press (1-indexed)
ENC:<encoder_id>:<direction> # Encoder rotation (CW/CCW)
STATUS:OK                    # Status response
CONFIG:<param>:<value>       # Configuration response
TEST:Starting test mode...   # Test mode messages
```

### From Application to Arduino
```
STATUS        # Request status
TEST          # Enter test mode
CONFIG:<param>:<value>  # Set configuration
```

## Configuration System

### Configuration File Structure
```yaml
device:
  serialPort: string    # Serial port path
  baudRate: number      # Communication speed
  buttons: number       # Button count (8,12,16,24,32)
  encoders: number      # Encoder count (0-8)

buttons:
  button<N>:
    description: string # Human-readable description
    type: string       # "keypress", "command", "application"
    action: string     # Action to execute

encoders:
  encoder<N>:
    description: string # Human-readable description
    typeCW: string     # Clockwise action type
    actionCW: string   # Clockwise action
    typeCCW: string    # Counter-clockwise action type
    actionCCW: string  # Counter-clockwise action

logging:
  level: string        # "debug", "info", "warn", "error"
  file: string         # Log file path
```

### Action Types
- **keypress**: Keyboard shortcuts (e.g., "cmd+c", "ctrl+alt+t")
- **command**: Shell commands (e.g., "open -a Calculator")
- **application**: Application names (e.g., "Calculator", "Terminal")

## Platform-Specific Development

### macOS Development
- Test status bar integration
- Verify macOS-specific key combinations
- Test application bundling and signing

### Windows Development  
- Test system tray integration
- Verify Windows-specific shortcuts
- Test installer creation

### Linux Development
- Test headless operation
- Verify service integration
- Test AppImage creation

## Testing

### Unit Tests
Located in `tests/` directory, using Jest framework.

```bash
# Run specific test file
npx jest tests/config.test.js

# Run tests in watch mode
npx jest --watch

# Generate coverage report
npx jest --coverage
```

### Integration Testing
Manual testing checklist:
- [ ] Serial port detection and connection
- [ ] Button press detection and action execution
- [ ] Encoder rotation detection and action execution
- [ ] Configuration loading and saving
- [ ] Configuration reload functionality
- [ ] Platform-specific UI integration
- [ ] Cross-platform build process

### Arduino Testing
```bash
# Open Arduino serial monitor
# Send commands:
STATUS   # Should respond with current config
TEST     # Should simulate all buttons/encoders
```

## Debugging

### Application Debugging
- Use `npm run dev` for development mode with DevTools
- Check logs in `logs/macro-keyboard.log`
- Use console output for real-time debugging

### Serial Communication Debugging
- Use Arduino IDE Serial Monitor
- Check baud rate settings
- Verify Arduino enumeration in device manager

### Common Issues
1. **Serial port not found**: Check USB connection and drivers
2. **Button matrix ghosting**: Add diodes to button matrix
3. **Encoder bouncing**: Firmware includes debouncing
4. **Application not starting**: Check Node.js version and dependencies

## Contributing

### Code Style
- Use ESLint configuration provided
- Follow existing naming conventions
- Add JSDoc comments for functions
- Keep functions small and focused

### Git Workflow
1. Create feature branch from main
2. Make changes with descriptive commits
3. Run tests and linting before push
4. Create pull request with description

### Pull Request Guidelines
- Include tests for new functionality
- Update documentation if needed
- Ensure all CI checks pass
- Link to related issues

### Release Process

The project uses automated releases:

#### Automated Releases
- Releases are automatically created when changes are pushed to the `main` branch
- All CI checks (lint, test, build) must pass before a release is created
- Version numbers are automatically incremented based on commit messages
- GitHub releases include platform-specific builds and Arduino firmware

#### Version Increment Control
Use these keywords in your commit messages to control version increments:
- `[major]` - Breaking changes (1.0.0 → 2.0.0)
- `[minor]` - New features (1.0.0 → 1.1.0)  
- `[patch]` or default - Bug fixes (1.0.0 → 1.0.1)

#### Manual Release (if needed)
```bash
# Create and push a version tag manually
npm version patch  # or minor/major
git push origin main --tags
```
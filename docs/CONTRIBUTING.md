# Contributing to Macro Keyboard

*Welcome! We're thrilled you're interested in contributing to the Macro Keyboard project.*

## Table of Contents

1. [Quick Start for Contributors](#quick-start-for-contributors)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Style and Standards](#code-style-and-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Documentation Standards](#documentation-standards)
8. [Pull Request Process](#pull-request-process)
9. [Issue Guidelines](#issue-guidelines)
10. [Community Guidelines](#community-guidelines)

## Quick Start for Contributors

### 30-Second Contribution Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR-USERNAME/macro-keyboard.git
cd macro-keyboard

# 2. Install dependencies
npm install

# 3. Start development mode
npm run dev

# 4. Make changes, test, commit, push, and open PR!
```

### Ways to Contribute

We welcome all types of contributions:

- 🐛 **Bug Reports**: Found an issue? Let us know!
- ✨ **Feature Requests**: Have an idea? Share it!
- 💻 **Code Contributions**: Fix bugs, add features
- 📚 **Documentation**: Improve guides, fix typos
- 🧪 **Testing**: Help test on different platforms
- 🎨 **Design**: UI/UX improvements, icons, branding
- 🔌 **Plugins**: Create useful plugins for the community
- 💡 **Ideas**: Share thoughts on project direction

### First-Time Contributors

**Great first issues** (look for these labels):
- `good first issue`: Perfect for newcomers
- `help wanted`: We'd love assistance with these
- `documentation`: Improve docs and guides
- `testing`: Help with testing and validation

## Development Environment Setup

### Prerequisites

- **Node.js 18+** and **npm 8+**
- **Git** for version control
- **Arduino IDE** (for firmware development)
- **Code editor** (VS Code recommended with extensions below)

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode", 
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.test-adapter-converter",
    "hbenl.vscode-test-explorer"
  ]
}
```

### Complete Setup Process

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/macro-keyboard.git
   cd macro-keyboard
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/jmassardo/macro-keyboard.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Verify installation**:
   ```bash
   # Run tests
   npm test
   
   # Check linting
   npm run lint
   
   # Start development server
   npm run dev
   ```

### Development Scripts Reference

```bash
# Development
npm run dev              # Start app in development mode
npm start               # Start app in production mode

# Code Quality
npm run lint            # Check code style
npm run lint:fix        # Fix auto-fixable issues
npm run format          # Format code with Prettier
npm run quality         # Run all quality checks
npm run quality:fix     # Fix all auto-fixable issues

# Testing
npm test                # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:e2e        # Run end-to-end tests
npm run test:all        # Run all tests

# Building
npm run build           # Build for all platforms
npm run build:mac       # Build for macOS
npm run build:win       # Build for Windows
npm run build:linux     # Build for Linux

# Utilities
npm run icons:generate  # Generate app icons
npm run validate        # Full project validation
```

## Project Structure

Understanding the codebase organization:

```
macro-keyboard/
├── src/                          # Main application source
│   ├── main.js                  # Electron main process
│   ├── ActionExecutor.js        # Action execution engine
│   ├── SerialConnectionManager.js # Hardware communication
│   ├── ConfigValidator.js       # Configuration validation
│   ├── SecurityManager.js       # Security and validation
│   ├── PluginManager.js         # Plugin system
│   ├── PerformanceMonitor.js    # Performance tracking
│   ├── renderer/                # UI components (Electron renderer)
│   └── assets/                  # Icons, images, resources
│
├── arduino/                      # Arduino firmware
│   └── macro-keyboard-firmware/ # Main firmware project
│       ├── macro-keyboard-firmware.ino
│       ├── config.h             # Hardware configuration
│       └── README.md            # Firmware documentation
│
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   ├── e2e/                     # End-to-end tests
│   └── __mocks__/               # Test mocks
│
├── docs/                        # Documentation
│   ├── GETTING_STARTED.md       # User onboarding
│   ├── USER_MANUAL.md           # Complete user guide
│   ├── API_REFERENCE.md         # Developer API docs
│   ├── PLUGIN_DEVELOPMENT.md    # Plugin creation guide
│   └── TROUBLESHOOTING.md       # Problem solving
│
├── config/                      # Configuration files
│   ├── default.yaml             # Default configuration
│   ├── schema.json              # Configuration schema
│   └── profiles/                # Example profiles
│
├── scripts/                     # Build and utility scripts
├── .github/                     # GitHub workflows and templates
└── examples/                    # Example configurations and plugins
```

### Key Components Overview

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **Main Process** | Application orchestration | `main.js` |
| **Action Execution** | Execute user-defined actions | `ActionExecutor.js` |
| **Hardware Communication** | Arduino serial communication | `SerialConnectionManager.js` |
| **Configuration** | Manage app configuration | `ConfigValidator.js` |
| **Security** | Validate and sanitize actions | `SecurityManager.js` |
| **Plugin System** | Extensibility framework | `PluginManager.js` |
| **Performance** | Monitor and optimize | `PerformanceMonitor.js` |
| **Arduino Firmware** | Hardware button/encoder scanning | `arduino/` |

## Development Workflow

### Git Workflow

We use a **GitHub Flow** approach:

1. **Create feature branch** from `main`
2. **Make changes** with clear commits
3. **Test thoroughly** on your platform
4. **Open pull request** against `main`
5. **Address review feedback**
6. **Merge** when approved

#### Branch Naming Conventions

```bash
# Features
git checkout -b feature/button-led-support
git checkout -b feature/voice-recognition

# Bug fixes  
git checkout -b fix/serial-connection-stability
git checkout -b fix/memory-leak-plugin-system

# Documentation
git checkout -b docs/api-reference-update
git checkout -b docs/troubleshooting-guide

# Refactoring
git checkout -b refactor/action-executor-cleanup
git checkout -b refactor/improve-error-handling
```

### Commit Message Format

Use **Conventional Commits** format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic changes)
- `refactor`: Code restructuring (no behavior changes)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(actions): add support for complex macro sequences"
git commit -m "fix(serial): resolve connection timeout on Linux"
git commit -m "docs(api): update plugin development guide"
git commit -m "test(integration): add hardware connection tests"
```

### Development Best Practices

#### Before Starting Work

1. **Check for existing issues/PRs** to avoid duplication
2. **Create or comment on issue** to discuss approach
3. **Pull latest changes** from upstream:
   ```bash
   git checkout main
   git pull upstream main
   ```

#### During Development

1. **Make focused changes** - one feature/fix per PR
2. **Write tests** for new functionality
3. **Update documentation** as needed
4. **Test cross-platform** if possible
5. **Commit frequently** with clear messages

#### Before Submitting PR

1. **Rebase on latest main**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run full validation**:
   ```bash
   npm run validate  # Runs lint, format, and tests
   ```

3. **Test manually** - don't rely only on automated tests

4. **Update documentation** for user-facing changes

## Code Style and Standards

### JavaScript Style Guide

We use **ESLint** and **Prettier** for consistent code style.

#### Key Style Rules

```javascript
// Use modern ES6+ syntax
const config = await loadConfig();

// Prefer async/await over promises
async function executeAction(actionConfig) {
  try {
    const result = await performAction(actionConfig);
    return result;
  } catch (error) {
    logger.error('Action failed', { error: error.message });
    throw error;
  }
}

// Use meaningful variable names
const serialConnectionManager = new SerialConnectionManager();
const buttonPressCount = trackButtonPresses();

// Destructure for cleaner code
const { type, action, enabled } = buttonConfig;

// Use template literals
const message = `Action ${action} executed for ${context}`;

// Consistent error handling
if (!config.serialPort) {
  throw new ConfigValidationError('Serial port not configured');
}
```

#### Function Documentation

Use **JSDoc** for function documentation:

```javascript
/**
 * Executes an action with security validation and error handling
 * @param {Object} actionConfig - Configuration for the action
 * @param {string} actionConfig.type - Type of action (keypress|command|application)
 * @param {string} actionConfig.action - Action to execute
 * @param {string} context - Execution context (e.g., "button1", "encoder2:CW")
 * @returns {Promise<ExecutionResult>} Result of action execution
 * @throws {ActionExecutionError} When action execution fails
 */
async function executeAction(actionConfig, context) {
  // Implementation
}
```

#### Class Structure

```javascript
class ActionExecutor {
  /**
   * Constructor description
   * @param {Logger} logger - Winston logger instance
   * @param {SecurityManager} securityManager - Security validation
   */
  constructor(logger, securityManager) {
    this.logger = logger;
    this.securityManager = securityManager;
    this.platform = process.platform;
  }
  
  /**
   * Public method description
   */
  async executeAction(actionConfig, context) {
    // Public method implementation
  }
  
  /**
   * Private method (prefix with underscore)
   */
  _validateActionConfig(actionConfig) {
    // Private helper implementation
  }
}
```

### Arduino C++ Style Guide

Follow **Arduino coding standards**:

```cpp
// Use descriptive names
const int BUTTON_DEBOUNCE_DELAY = 50;
const int ENCODER_UPDATE_INTERVAL = 10;

// Consistent indentation (2 spaces)
void scanButtonMatrix() {
  for (int row = 0; row < MATRIX_ROWS; row++) {
    digitalWrite(rowPins[row], LOW);
    
    for (int col = 0; col < MATRIX_COLS; col++) {
      if (digitalRead(colPins[col]) == LOW) {
        handleButtonPress(row, col);
      }
    }
    
    digitalWrite(rowPins[row], HIGH);
  }
}

// Function documentation
/**
 * Handles a button press event with debouncing
 * @param row Button matrix row
 * @param col Button matrix column
 */
void handleButtonPress(int row, int col) {
  // Implementation
}
```

## Testing Guidelines

### Testing Strategy

We use a **multi-layered testing approach**:

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Manual Testing**: Platform-specific validation

### Unit Testing

Use **Jest** for unit tests:

```javascript
// tests/action-executor.test.js
const ActionExecutor = require('../src/ActionExecutor');
const { mockLogger } = require('./test-utils');

describe('ActionExecutor', () => {
  let actionExecutor;
  let mockSecurityManager;
  
  beforeEach(() => {
    mockSecurityManager = {
      validateCommand: jest.fn().mockReturnValue({ valid: true }),
      validateApplication: jest.fn().mockReturnValue({ valid: true })
    };
    
    actionExecutor = new ActionExecutor(mockLogger, mockSecurityManager);
  });
  
  describe('executeAction', () => {
    test('should execute keypress action successfully', async () => {
      const actionConfig = {
        type: 'keypress',
        action: 'VolumeUp'
      };
      
      const result = await actionExecutor.executeAction(actionConfig, 'button1');
      
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(100);
    });
    
    test('should handle invalid action type', async () => {
      const actionConfig = {
        type: 'invalid-type',
        action: 'test'
      };
      
      const result = await actionExecutor.executeAction(actionConfig, 'button1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid-type');
    });
  });
});
```

### Integration Testing

Test component interactions:

```javascript
// tests/integration/serial-communication.test.js
describe('Serial Communication Integration', () => {
  test('should handle button press from Arduino', async () => {
    const app = new MacroKeyboardApp();
    await app.initialize();
    
    // Simulate serial data from Arduino
    app.serialManager.emit('data', 'BTN:1');
    
    // Allow async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify action was executed
    expect(app.actionExecutor.executionCount).toBe(1);
  });
});
```

### Test Utilities

Create reusable test helpers:

```javascript
// tests/test-utils.js
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(), 
  warn: jest.fn(),
  error: jest.fn()
};

const createMockConfig = (overrides = {}) => ({
  device: {
    serialPort: '/dev/ttyUSB0',
    baudRate: 9600,
    buttons: 16,
    encoders: 2
  },
  buttons: {
    button1: {
      type: 'keypress',
      action: 'VolumeUp',
      enabled: true
    }
  },
  ...overrides
});

module.exports = {
  mockLogger,
  createMockConfig
};
```

### Manual Testing Checklist

Before submitting PRs, verify:

#### Basic Functionality
- [ ] Application starts without errors
- [ ] Can connect to Arduino hardware
- [ ] Button presses trigger configured actions
- [ ] Configuration changes take effect
- [ ] Application shuts down cleanly

#### Cross-Platform (if possible)
- [ ] Test on macOS, Windows, and/or Linux
- [ ] Platform-specific features work correctly
- [ ] File paths and permissions are correct

#### Error Handling
- [ ] Graceful handling of missing configuration
- [ ] Proper error messages for invalid configurations
- [ ] Recovery from serial connection loss
- [ ] Handling of security validation failures

## Documentation Standards

### Documentation Types

1. **User Documentation**: Guides for end users
2. **Developer Documentation**: API references, architecture
3. **Code Comments**: Inline documentation for maintainers
4. **README Updates**: Keep project README current

### Writing Style Guidelines

#### User-Facing Documentation

- **Clear and Accessible**: Write for your audience's skill level
- **Action-Oriented**: Use imperative mood ("Click the button")
- **Structured**: Use consistent headings and formatting
- **Visual Aids**: Include code examples, screenshots when helpful
- **Complete**: Cover setup, usage, and troubleshooting

**Example:**
```markdown
## Installing the Application

### Step 1: Download the Release

1. **Visit** the [GitHub Releases page](link)
2. **Download** the appropriate file for your platform:
   - macOS: `Macro-Keyboard-X.X.X.dmg`
   - Windows: `Macro-Keyboard-Setup-X.X.X.exe`
   - Linux: `Macro-Keyboard-X.X.X.AppImage`

### Step 2: Install the Application

**macOS:**
1. Open the `.dmg` file
2. Drag the application to your Applications folder
3. Launch from Applications or Spotlight
```

#### Developer Documentation

- **Technical Accuracy**: Be precise about APIs and behavior
- **Complete Examples**: Show real, working code
- **Context**: Explain why, not just what
- **Maintainable**: Keep docs updated with code changes

**Example:**
```markdown
## ActionExecutor.executeAction()

Executes an action with security validation and cross-platform compatibility.

### Parameters

- `actionConfig` (Object): Action configuration
  - `type` (string): Action type - `keypress`, `command`, or `application`
  - `action` (string): Action to execute
  - `enabled` (boolean): Whether action is enabled
- `context` (string): Execution context for logging

### Returns

Promise<ExecutionResult> where ExecutionResult contains:
- `success` (boolean): Whether execution succeeded
- `result` (any): Action result data
- `error` (string): Error message if success is false
- `executionTime` (number): Execution time in milliseconds

### Example

```javascript
const result = await actionExecutor.executeAction({
  type: 'keypress',
  action: 'cmd+c'
}, 'button1');

if (result.success) {
  console.log(`Action completed in ${result.executionTime}ms`);
}
```

### Documentation Maintenance

- **Update with Changes**: Document new features and API changes
- **Review Accuracy**: Periodically verify examples still work
- **User Feedback**: Incorporate questions and confusion points
- **Link Maintenance**: Keep internal and external links current

## Pull Request Process

### PR Preparation Checklist

Before opening a pull request:

- [ ] **Code is tested** - unit tests pass, manual testing complete
- [ ] **Code is formatted** - `npm run format` applied
- [ ] **Linting passes** - `npm run lint` shows no errors
- [ ] **Documentation updated** - user-facing changes documented
- [ ] **Commit messages** follow conventional commit format
- [ ] **Branch is up-to-date** - rebased on latest main
- [ ] **PR description** explains what and why

### PR Description Template

```markdown
## Description

Brief description of the changes and why they were made.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that breaks existing functionality)
- [ ] Documentation update
- [ ] Code refactoring (no behavior changes)

## Changes Made

- Detailed list of specific changes
- What files were modified and why
- Any new dependencies or configuration changes

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Cross-platform testing (specify platforms)

## Screenshots/Demo

If applicable, add screenshots or GIFs showing the changes.

## Breaking Changes

List any breaking changes and migration instructions.

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added for new functionality
```

### Review Process

1. **Automated Checks**: CI runs tests, linting, builds
2. **Code Review**: Maintainers review code quality and design
3. **Testing**: Changes are tested on multiple platforms
4. **Documentation**: Docs are reviewed for accuracy and completeness
5. **Approval**: Changes are approved by maintainers
6. **Merge**: PR is merged into main branch

### Addressing Review Feedback

- **Be Responsive**: Address feedback promptly
- **Ask Questions**: If feedback is unclear, ask for clarification
- **Explain Decisions**: If you disagree with feedback, explain your reasoning
- **Make Requested Changes**: Update code based on feedback
- **Test Again**: Re-test after making changes

## Issue Guidelines

### Reporting Bugs

Use the bug report template and include:

- **Clear Description**: What happened vs. what was expected
- **Steps to Reproduce**: Detailed steps to trigger the bug
- **Environment**: OS, application version, hardware configuration
- **Logs**: Relevant log excerpts (with sensitive info removed)
- **Screenshots**: Visual evidence if applicable

### Feature Requests

Use the feature request template and include:

- **Problem Description**: What problem does this solve?
- **Proposed Solution**: Your suggested approach
- **Alternatives**: Other solutions you considered
- **Use Cases**: Who would benefit from this feature?
- **Implementation Ideas**: Technical suggestions if you have them

### Issue Labels

We use labels to organize issues:

- **Type**: `bug`, `feature`, `documentation`, `question`
- **Priority**: `critical`, `high`, `medium`, `low`
- **Status**: `needs-triage`, `in-progress`, `blocked`, `ready-to-test`
- **Platform**: `macos`, `windows`, `linux`, `arduino`
- **Component**: `serial`, `actions`, `plugins`, `ui`, `security`
- **Difficulty**: `good-first-issue`, `help-wanted`, `advanced`

## Community Guidelines

### Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/):

- **Be Respectful**: Treat all community members with respect
- **Be Inclusive**: Welcome people of all backgrounds and experience levels
- **Be Collaborative**: Work together to improve the project
- **Be Patient**: Help newcomers learn and grow
- **Be Professional**: Keep discussions focused and constructive

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests, project planning
- **GitHub Discussions**: Questions, ideas, community interaction
- **Pull Requests**: Code review and technical discussion
- **Email**: Security issues and sensitive topics

### Recognition

We recognize contributors through:

- **Contributors List**: All contributors listed in project README
- **Release Notes**: Significant contributions mentioned in releases
- **GitHub Recognition**: Stars, reactions, and comments on contributions
- **Community Highlights**: Showcase interesting contributions

---

## Getting Help

### For New Contributors

- **Start Small**: Look for `good-first-issue` labels
- **Ask Questions**: Use GitHub Discussions for questions
- **Read Documentation**: Familiarize yourself with the project
- **Join Community**: Participate in discussions and help others

### For Experienced Contributors

- **Mentor Others**: Help newcomers get started
- **Review PRs**: Provide constructive feedback on contributions
- **Improve Tooling**: Enhance development experience
- **Share Knowledge**: Write guides and documentation

### Contact Information

- **General Questions**: [GitHub Discussions](https://github.com/jmassardo/macro-keyboard/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/jmassardo/macro-keyboard/issues)
- **Security Issues**: See [SECURITY.md](./SECURITY.md) for reporting
- **Maintainer Contact**: Check repository for current maintainer info

---

**Thank you for contributing to Macro Keyboard!** Your efforts help make this project better for everyone. 🎉
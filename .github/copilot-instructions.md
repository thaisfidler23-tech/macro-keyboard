---
applyTo: '**'
---

# Macro Keyboard Project Development Instructions

You are an expert software engineer and electronics engineer specializing in:
- **Hardware Integration**: Arduino firmware development, serial communication protocols, GPIO management
- **Desktop Application Development**: Electron applications, cross-platform GUI, system tray integration
- **Hardware-Software Communication**: Serial protocols, device management, real-time hardware interaction
- **Testing & Quality Assurance**: Unit testing, integration testing, hardware simulation, code quality

## Project Architecture Overview

This is a macro keyboard project consisting of:
1. **Arduino Firmware** (C++): Handles button matrix scanning, rotary encoder input, serial communication
2. **Electron Desktop App** (JavaScript/Node.js): Cross-platform GUI with system tray integration
3. **Configuration System**: YAML-based config with hot-reload capabilities
4. **Hardware Support**: 8-32 button matrices, up to 8 rotary encoders, Arduino Micro controller

## Development Workflow Requirements

When assigned tasks, you must **autonomously iterate** through each item with the following complete workflow:

### 1. Code Implementation
- Write clean, well-structured code following project patterns
- Implement proper error handling and edge cases
- Follow existing code style and architecture
- Consider both software and hardware constraints
- Implement proper serial communication protocols
- Handle cross-platform differences (macOS/Windows/Linux)

### 2. Testing Implementation
- Write comprehensive unit tests using Jest
- Create integration tests for hardware-software communication
- Test configuration management and hot-reload functionality
- Mock hardware components for CI/CD environments
- Test cross-platform compatibility where applicable
- Validate serial communication protocols

### 3. Documentation
- Update relevant documentation files (README.md, DEVELOPMENT.md)
- Document new configuration options in YAML examples
- Create/update API documentation for new functions
- Document hardware setup procedures if hardware changes
- Include troubleshooting sections for common issues

### 4. Git Commit
- Create meaningful commit messages following conventional commit format
- Include both summary and detailed description
- Reference any issues or requirements addressed
- Use appropriate commit types (feat, fix, docs, test, refactor, etc.)

## Technical Standards & Best Practices

### JavaScript/Node.js (Electron App)
- Use modern ES6+ syntax with proper async/await
- Implement proper error handling with try/catch blocks
- Follow existing logging patterns using Winston
- Validate all user inputs and configuration data
- Handle serial port errors and connection issues gracefully
- Implement proper cleanup on app shutdown

### Arduino C++ (Firmware)
- Follow Arduino coding standards and conventions
- Optimize for memory usage on Arduino Micro
- Implement proper debouncing for buttons
- Use interrupts efficiently for rotary encoders
- Handle serial communication buffering properly
- Include proper error states and recovery mechanisms

### Configuration Management
- Validate YAML configuration syntax and structure
- Implement schema validation for config files
- Support hot-reload without disrupting hardware communication
- Provide meaningful error messages for invalid configurations
- Support backward compatibility where possible

### Hardware Integration
- Implement robust serial communication with error recovery
- Handle device disconnection and reconnection gracefully
- Support multiple button matrix configurations (8, 12, 16, 24, 32 buttons)
- Properly manage rotary encoder state and direction detection
- Implement proper timing for matrix scanning to avoid ghosting

### Testing Requirements
- Mock hardware components for automated testing
- Test configuration validation and error handling
- Verify serial communication protocol compliance
- Test cross-platform functionality
- Include performance tests for button matrix scanning
- Test memory usage and cleanup

### Security & Quality
- Validate all serial input to prevent injection attacks
- Implement proper input sanitization for shell commands
- Use secure defaults for all configuration options
- Follow secure coding practices for system integration
- Implement proper resource cleanup to prevent memory leaks

## Project-Specific Guidelines

### File Organization
- Keep Arduino firmware in `arduino/macro-keyboard-firmware/`
- Electron source in `src/` with proper module separation
- Configuration files in `config/` with examples
- Tests in `tests/` matching source structure
- Documentation in `docs/` with clear organization

### Communication Protocol
- Button presses: `"BTN:<button_id>"`
- Encoder rotation: `"ENC:<encoder_id>:<direction>"` (CW/CCW)
- Configuration commands: `"CONFIG:BUTTONS:<count>"` or `"CONFIG:ENCODERS:<count>"`
- Error responses: `"ERROR:<error_code>:<message>"`

### Configuration Management
- Use YAML for human-readable configuration
- Support hot-reload without hardware disruption
- Validate configuration schema on load
- Provide clear error messages for invalid configs
- Support environment-specific configuration overrides

## Autonomous Operation Expectations

You should:
- **Work independently** until all assigned tasks are complete
- **Continue iterating** through the workflow without waiting for feedback
- **Handle dependencies** by implementing prerequisite features first
- **Resolve blockers** by implementing missing components or documenting limitations
- **Self-validate** your work by running tests and checking functionality
- **Optimize solutions** by considering both performance and maintainability

Only engage the developer when:
- Critical design decisions require clarification
- External dependencies or hardware are unavailable
- Conflicting requirements need resolution
- Security concerns require approval

## Error Handling Philosophy

- **Fail gracefully**: Applications should handle hardware disconnection
- **Provide feedback**: Clear error messages for users and developers
- **Enable recovery**: Automatic reconnection and state restoration
- **Log appropriately**: Comprehensive logging for debugging without performance impact
- **Validate inputs**: All configuration and serial input must be validated

## Performance Considerations

- **Hardware timing**: Button matrix scanning must be optimized for responsiveness
- **Memory management**: Arduino Micro has limited memory - optimize accordingly
- **Serial communication**: Minimize latency while ensuring reliability
- **Cross-platform performance**: Consider platform-specific optimizations
- **Configuration loading**: YAML parsing should be efficient for large configs

Continue working through each assigned task systematically, implementing the complete workflow for each item before moving to the next.
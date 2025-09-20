# Auto-Updater System Documentation

## Overview

The Auto-Updater System provides automatic update checking, downloading, and installation for the Macro Keyboard application using Electron's `electron-updater` package with GitHub releases integration.

## Architecture

The system consists of three main components:

### 1. UpdateManager (Main Process)
- **File**: `src/UpdateManager.js`
- **Purpose**: Core update logic and electron-updater integration
- **Features**:
  - Automatic update checking with configurable intervals
  - Download progress tracking
  - Update statistics collection
  - IPC communication with renderer process
  - GitHub releases integration

### 2. UpdateUI (Renderer Process)
- **File**: `src/renderer/UpdateUI.js`
- **Purpose**: User interface for update notifications and settings
- **Features**:
  - Update notification popups
  - Download progress visualization
  - Settings panel integration
  - User interaction handling

### 3. Main Application Integration
- **File**: `src/main.js`
- **Purpose**: Integration point for UpdateManager lifecycle
- **Features**:
  - UpdateManager initialization
  - IPC handler registration
  - Application shutdown coordination

## Configuration

Updates are configured in `config/default.yaml`:

```yaml
updates:
  enabled: true                    # Enable/disable auto-updates
  checkOnStartup: true            # Check for updates on app startup
  autoDownload: false             # Automatically download updates
  autoInstall: false              # Automatically install updates
  checkInterval: 3600000          # Check interval in milliseconds (1 hour)
  provider: 'github'              # Update provider (github/generic)
  owner: 'your-username'          # GitHub repository owner
  repo: 'macro-keyboard'          # GitHub repository name
  allowPrerelease: false          # Allow pre-release updates
```

## Update Flow

### 1. Automatic Checking
- UpdateManager checks for updates on startup (if enabled)
- Periodic checks run at configured intervals
- Manual checks can be triggered from settings

### 2. Update Available
- Notification appears in top-right corner
- Shows new version number and release notes
- User can choose to download or dismiss

### 3. Download Process
- Progress bar shows download percentage
- Download speed and size information displayed
- Can be cancelled by user

### 4. Installation
- Notification shows "Update Ready" when download complete
- User can install immediately or defer
- Application restarts to complete installation

## User Interface

### Update Notifications
Located in top-right corner with slide-in animation:
- **Update Available**: Blue border, download/dismiss buttons
- **Downloading**: Progress bar with percentage and speed
- **Update Ready**: Green accent, install/later buttons
- **Error**: Red accent, retry/dismiss buttons

### Settings Panel
Integrated into main settings with:
- Auto-update enable/disable toggle
- Manual update check button
- Current version display
- Update statistics (checks, downloads, installs)
- Last check time

## IPC Communication

### From Renderer to Main
- `update-check`: Manual update check
- `update-download`: Start download
- `update-install`: Install and restart
- `update-get-statistics`: Get update statistics
- `update-set-config`: Update configuration

### From Main to Renderer
- `update-available`: New update available
- `update-not-available`: No updates found
- `update-downloaded`: Update ready to install
- `update-download-progress`: Download progress info
- `update-error`: Update error occurred

## Release Integration

The system integrates with GitHub Actions for automated releases:

### Build Process
1. **Version Detection**: Reads version from `package.json`
2. **Asset Generation**: Creates platform-specific installers
3. **GitHub Release**: Publishes release with assets
4. **Auto-Discovery**: electron-updater automatically finds releases

### Supported Platforms
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG and ZIP packages (.dmg, .zip)
- **Linux**: AppImage and Debian packages (.AppImage, .deb)

## Statistics Tracking

UpdateManager tracks usage statistics:
- **Total Checks**: Number of update checks performed
- **Total Downloads**: Number of updates downloaded
- **Total Updates**: Number of successful installations
- **Last Check**: Timestamp of most recent check
- **Current Version**: Currently installed version

Statistics are persisted to `update-stats.json` in the application data directory.

## Error Handling

### Network Errors
- Graceful fallback when update server unavailable
- Retry logic for transient failures
- User notification with retry option

### Download Errors
- Partial download recovery
- Corrupted download detection
- User notification with retry/cancel options

### Installation Errors
- Rollback to previous version if possible
- Error reporting with diagnostic information
- User notification with troubleshooting guidance

## Security Considerations

### Code Signing
- All releases must be code-signed for security
- Unsigned updates will be rejected by electron-updater
- Platform-specific signing requirements enforced

### Update Verification
- Cryptographic signature verification
- Checksum validation for downloaded files
- Secure HTTPS communication only

### User Consent
- Updates require explicit user consent
- Auto-install can be disabled in settings
- Clear notification of update actions

## Development and Testing

### Local Testing
```bash
# Run update tests
npm test -- --testNamePattern="Update"

# Test update UI in isolation
npm run test:ui -- update-ui

# Mock update server for testing
npm run test:update-server
```

### Staging Environment
- Test releases can be published as pre-releases
- Enable `allowPrerelease` in configuration for testing
- Separate GitHub repository for staging releases

### Debug Logging
Enable debug mode for detailed update logging:
```bash
# Set environment variable
export DEBUG=electron-updater

# Or in application configuration
updates.debug: true
```

## Performance Considerations

### Update Checking
- Lightweight HTTP requests to GitHub API
- Cached responses to reduce API usage
- Configurable check intervals to balance freshness and performance

### Download Optimization
- Incremental downloads where possible
- Bandwidth throttling to avoid disrupting other applications
- Resume capability for interrupted downloads

### Storage Management
- Automatic cleanup of old update files
- Configurable cache size limits
- Progress indication to manage user expectations

## Troubleshooting

### Common Issues

#### Updates Not Detected
- Check GitHub repository configuration
- Verify code signing certificates
- Ensure proper release tagging format

#### Download Failures
- Check network connectivity
- Verify available disk space
- Test with different network conditions

#### Installation Problems
- Check application permissions
- Verify platform compatibility
- Review system-specific installation requirements

### Diagnostic Commands
```bash
# Check update configuration
npm run update:config

# Test update connectivity
npm run update:test-connection

# Verify release assets
npm run update:verify-assets

# Clear update cache
npm run update:clear-cache
```

## Future Enhancements

### Planned Features
- **Delta Updates**: Only download changed parts of application
- **Background Updates**: Silent updates with minimal user interaction
- **Rollback Capability**: Automatic rollback for failed updates
- **Update Channels**: Stable, beta, and alpha update channels
- **Custom UI Themes**: Customizable notification styling

### API Extensibility
- Plugin system for custom update sources
- Webhook integration for update notifications
- Enterprise deployment features
- Advanced configuration management

---

*This documentation covers the complete Auto-Updater System implementation for the Macro Keyboard application. For implementation details, see the source code and inline documentation.*
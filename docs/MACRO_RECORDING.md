# Macro Recording & Sequences System

## Overview

The Macro Recording system allows users to record sequences of actions performed on the macro keyboard and replay them later. This powerful automation feature supports complex workflows, conditional execution, and built-in templates for common tasks.

## Features

- **Real-time Action Recording**: Capture button presses, commands, and application launches with precise timing
- **Sequence Playback**: Replay recorded sequences with original delays or custom timing
- **Built-in Templates**: Pre-defined workflows for common tasks (email, development, presentation)
- **Conditional Execution**: Run sequences based on time, system state, or other conditions
- **Sequence Management**: Save, edit, duplicate, delete, and organize macro sequences
- **Statistics Tracking**: Monitor recording and playback activity
- **Visual Progress Tracking**: Real-time playback progress with current step information

## Architecture

### Backend Components

#### MacroRecorder.js
Core recording and playback engine with the following capabilities:
- Event-driven architecture using Node.js EventEmitter
- File-based sequence storage with JSON format
- Integration with ActionExecutor for action execution
- Built-in templates and conditional logic
- Comprehensive error handling and validation

#### ActionExecutor.js Integration
Extended to support macro sequence execution:
- New `macro_sequence` action type
- Inline sequence execution support
- MacroRecorder coordination for complex sequences
- Backward compatibility with existing action types

#### Main Process Integration
- IPC handlers for all macro recording operations
- Real-time event forwarding to renderer process
- Lifecycle management during app startup/shutdown

### Frontend Components

#### MacroRecorderUI.js
Full-featured user interface component:
- Recording controls with real-time status
- Sequence management with grid view
- Playback progress visualization
- Statistics dashboard
- Responsive design for different screen sizes

#### CSS Styling
Comprehensive styling with:
- Modern Material Design inspired interface
- Responsive grid layouts
- Smooth animations and transitions
- Accessibility considerations

## API Reference

### Backend API (MacroRecorder)

#### Constructor
```javascript
const macroRecorder = new MacroRecorder(sequenceDirectory);
```

#### Recording Methods
```javascript
// Start recording with optional name
startRecording(sequenceName = null)
// Returns: { success: boolean, recordingName?: string, error?: string }

// Record an action during recording
recordAction(action)
// action: { type: string, action: string, description?: string }
// Returns: { success: boolean, error?: string }

// Stop and save current recording
stopRecording()
// Returns: { success: boolean, sequenceName?: string, error?: string }

// Cancel current recording without saving
cancelRecording()
// Returns: { success: boolean, error?: string }
```

#### Playback Methods
```javascript
// Play a saved sequence
playSequence(sequenceName)
// Returns: Promise<{ success: boolean, error?: string }>

// Stop current playback
stopPlayback()
// Returns: { success: boolean, error?: string }
```

#### Sequence Management
```javascript
// Get all saved sequences
getSavedSequences()
// Returns: Object<string, SequenceData>

// Delete a sequence
deleteSequence(sequenceName)
// Returns: { success: boolean, error?: string }

// Duplicate a sequence
duplicateSequence(sourceName, targetName)
// Returns: { success: boolean, error?: string }

// Create sequence from template
createFromTemplate(templateName, sequenceName)
// Returns: { success: boolean, error?: string }
```

#### Utility Methods
```javascript
// Get recording and playback statistics
getStatistics()
// Returns: { totalRecordings, totalPlaybacks, savedSequenceCount, averageSequenceLength }

// Get built-in templates
getBuiltInTemplates()
// Returns: Object<string, TemplateData>

// Evaluate conditions for conditional execution
evaluateCondition(condition)
// Returns: boolean
```

### Frontend API (MacroRecorderUI)

#### Initialization
```javascript
const macroRecorderUI = new MacroRecorderUI();
document.body.appendChild(macroRecorderUI.getElement());
```

#### Display Control
```javascript
// Show the macro recorder interface
macroRecorderUI.show();

// Hide the macro recorder interface
macroRecorderUI.hide();
```

#### Event Handling
The UI automatically handles IPC events from the backend:
- `macro-recording-started`
- `macro-action-recorded`
- `macro-recording-stopped`
- `macro-playback-started`
- `macro-playback-progress`
- `macro-playback-completed`
- `macro-playback-stopped`
- `macro-playback-error`

### IPC API (Main Process)

#### Recording Operations
```javascript
// Start recording
ipcMain.handle('start-macro-recording', (event, sequenceName) => { ... });

// Stop recording
ipcMain.handle('stop-macro-recording', () => { ... });

// Cancel recording
ipcMain.handle('cancel-macro-recording', () => { ... });
```

#### Playback Operations
```javascript
// Play sequence
ipcMain.handle('play-macro-sequence', (event, sequenceName) => { ... });

// Stop playback
ipcMain.handle('stop-macro-playback', () => { ... });
```

#### Management Operations
```javascript
// Get saved sequences
ipcMain.handle('get-saved-sequences', () => { ... });

// Delete sequence
ipcMain.handle('delete-macro-sequence', (event, sequenceName) => { ... });

// Duplicate sequence
ipcMain.handle('duplicate-macro-sequence', (event, sourceName, targetName) => { ... });

// Get statistics
ipcMain.handle('get-macro-statistics', () => { ... });
```

## Data Formats

### Sequence File Format
```json
{
  "name": "MySequence",
  "description": "Optional description",
  "type": "recorded",
  "sequence": [
    {
      "type": "keypress",
      "action": "ctrl+c",
      "description": "Copy selected text",
      "delay": 100
    },
    {
      "type": "command",
      "action": "echo Hello World",
      "description": "Output greeting",
      "delay": 500
    }
  ],
  "metadata": {
    "createdAt": "2024-01-15T10:30:00.000Z",
    "duration": 2500,
    "playbackCount": 0,
    "conditions": [
      {
        "type": "time",
        "operator": "between",
        "value": ["09:00", "17:00"]
      }
    ]
  }
}
```

### Action Types
- **keypress**: Keyboard shortcuts and key combinations
- **command**: Shell commands and scripts
- **application**: Launch applications or open files
- **macro_sequence**: Execute another saved sequence

### Condition Types
- **time**: Time-based conditions (between, before, after)
- **day**: Day-of-week conditions
- **app**: Active application conditions
- **system**: System state conditions

## Built-in Templates

### Email Workflow Template
Pre-configured sequence for common email tasks:
- Open email client
- Create new message
- Apply common formatting
- Send or save as draft

### Development Workflow Template
Sequence for development tasks:
- Open terminal
- Navigate to project directory
- Run build commands
- Open editor with project files

### Presentation Workflow Template
Sequence for presentation setup:
- Close unnecessary applications
- Open presentation software
- Enable presentation mode
- Start slideshow

## Usage Examples

### Basic Recording
```javascript
// Start recording
const result = macroRecorder.startRecording('MyWorkflow');

// Actions are automatically recorded when performed
// via the macro keyboard

// Stop and save
const saveResult = macroRecorder.stopRecording();
```

### Programmatic Recording
```javascript
// Start recording
macroRecorder.startRecording('CustomSequence');

// Add actions programmatically
macroRecorder.recordAction({
  type: 'keypress',
  action: 'ctrl+c',
  description: 'Copy text'
});

macroRecorder.recordAction({
  type: 'application',
  action: 'notepad.exe',
  description: 'Open Notepad'
});

macroRecorder.recordAction({
  type: 'keypress',
  action: 'ctrl+v',
  description: 'Paste text'
});

// Stop recording
macroRecorder.stopRecording();
```

### Conditional Playback
```javascript
// Create sequence with conditions
const sequence = {
  name: 'WorkHoursOnly',
  sequence: [/* actions */],
  metadata: {
    conditions: [
      {
        type: 'time',
        operator: 'between',
        value: ['09:00', '17:00']
      }
    ]
  }
};

// Playback will only occur during work hours
macroRecorder.playSequence('WorkHoursOnly');
```

## Error Handling

The system provides comprehensive error handling for:
- File system operations (permissions, disk space)
- Action execution failures during playback
- Invalid sequence data
- Missing dependencies
- Concurrent operation conflicts

All errors are logged and reported through appropriate channels:
- Backend errors emit events to the frontend
- Frontend errors display user-friendly notifications
- Critical errors are logged to the application log system

## Performance Considerations

- **Memory Usage**: Sequences are loaded on-demand to minimize memory footprint
- **File I/O**: Asynchronous file operations prevent UI blocking
- **Timing Precision**: High-resolution timers ensure accurate playback timing
- **Resource Cleanup**: Proper cleanup of resources during playback interruption

## Security Considerations

- **Input Validation**: All sequence data is validated before execution
- **Command Sanitization**: Shell commands are sanitized to prevent injection
- **File Path Validation**: Sequence file paths are validated and restricted
- **Execution Limits**: Playback includes timeouts and resource limits

## Testing

The macro recording system includes comprehensive test coverage:
- Unit tests for all MacroRecorder methods
- Integration tests for ActionExecutor coordination
- UI component tests for MacroRecorderUI
- End-to-end tests for complete workflows
- Error condition testing for robustness

Run tests with:
```bash
npm test macro-recorder
npm test macro-recorder-ui
```

## Future Enhancements

Planned improvements include:
- Visual sequence editor with drag-and-drop
- Advanced conditional logic with AND/OR operators
- Sequence variables and parameter substitution
- Remote sequence sharing and synchronization
- Machine learning-based sequence optimization
- Integration with external automation tools
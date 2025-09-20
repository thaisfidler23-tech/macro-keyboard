/**
 * Keyboard Shortcut Picker Component
 * Provides a visual interface for selecting keyboard shortcuts with cross-platform compatibility
 */
class KeyboardShortcutPicker {
  constructor() {
    this.isListening = false;
    this.currentKeys = new Set();
    this.modifiers = new Set();
    this.keyMap = this.createCrossPlatformKeyMap();
    this.modal = null;
    this.callback = null;
    this.conflicts = new Map();
    
    this.createModal();
    this.setupEventListeners();
  }

  /**
   * Create cross-platform key mapping
   */
  createCrossPlatformKeyMap() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    return {
      // Modifier keys - platform specific display
      modifiers: {
        'Control': isMac ? '⌃' : 'Ctrl',
        'Alt': isMac ? '⌥' : 'Alt', 
        'Shift': '⇧',
        'Meta': isMac ? '⌘' : 'Win',
        'CmdOrCtrl': isMac ? '⌘' : 'Ctrl'
      },
      
      // Special keys with symbols
      special: {
        'Enter': '⏎',
        'Tab': '⇥',
        'Space': '␣',
        'Backspace': '⌫',
        'Delete': '⌦',
        'Escape': '⎋',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Home': '⇱',
        'End': '⇲',
        'PageUp': '⇞',
        'PageDown': '⇟'
      },

      // Function keys
      function: Array.from({length: 24}, (_, i) => `F${i + 1}`),
      
      // Number keys
      numbers: Array.from({length: 10}, (_, i) => i.toString()),
      
      // Letter keys
      letters: Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)),

      // Common symbols
      symbols: [
        '`', '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', 
        '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', 
        '_', '+', '{', '}', '|', ':', '"', '<', '>', '?'
      ]
    };
  }

  /**
   * Create the picker modal HTML structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'keyboard-picker-modal hidden';
    this.modal.innerHTML = `
      <div class="keyboard-picker-overlay"></div>
      <div class="keyboard-picker-content">
        <div class="keyboard-picker-header">
          <h3>Select Keyboard Shortcut</h3>
          <button class="keyboard-picker-close" type="button">&times;</button>
        </div>
        
        <div class="keyboard-picker-body">
          <div class="shortcut-display">
            <div class="shortcut-preview" id="shortcut-preview">
              <span class="preview-text">Press keys to create shortcut...</span>
            </div>
            <div class="shortcut-status" id="shortcut-status"></div>
          </div>
          
          <div class="shortcut-options">
            <div class="modifier-section">
              <h4>Modifier Keys</h4>
              <div class="modifier-buttons">
                <button type="button" class="modifier-btn" data-key="CmdOrCtrl">${this.keyMap.modifiers.CmdOrCtrl}</button>
                <button type="button" class="modifier-btn" data-key="Alt">${this.keyMap.modifiers.Alt}</button>
                <button type="button" class="modifier-btn" data-key="Shift">${this.keyMap.modifiers.Shift}</button>
              </div>
            </div>
            
            <div class="key-sections">
              <div class="key-section">
                <h4>Function Keys</h4>
                <div class="key-grid function-keys">
                  ${this.keyMap.function.map(key => 
                    `<button type="button" class="key-btn" data-key="${key}">${key}</button>`
                  ).join('')}
                </div>
              </div>
              
              <div class="key-section">
                <h4>Letters</h4>
                <div class="key-grid letter-keys">
                  ${this.keyMap.letters.map(key => 
                    `<button type="button" class="key-btn" data-key="${key}">${key}</button>`
                  ).join('')}
                </div>
              </div>
              
              <div class="key-section">
                <h4>Numbers</h4>
                <div class="key-grid number-keys">
                  ${this.keyMap.numbers.map(key => 
                    `<button type="button" class="key-btn" data-key="${key}">${key}</button>`
                  ).join('')}
                </div>
              </div>
              
              <div class="key-section">
                <h4>Special Keys</h4>
                <div class="key-grid special-keys">
                  ${Object.entries(this.keyMap.special).map(([key, symbol]) => 
                    `<button type="button" class="key-btn" data-key="${key}"><span class="key-symbol">${symbol}</span> ${key}</button>`
                  ).join('')}
                </div>
              </div>
              
              <div class="key-section">
                <h4>Symbols</h4>
                <div class="key-grid symbol-keys">
                  ${this.keyMap.symbols.map(symbol => 
                    `<button type="button" class="key-btn" data-key="${symbol}">${symbol}</button>`
                  ).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="keyboard-picker-footer">
          <div class="conflict-warning" id="conflict-warning"></div>
          <div class="picker-actions">
            <button type="button" class="btn secondary" id="clear-shortcut">Clear</button>
            <button type="button" class="btn secondary" id="cancel-picker">Cancel</button>
            <button type="button" class="btn primary" id="apply-shortcut" disabled>Apply</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
  }

  /**
   * Set up event listeners for the picker
   */
  setupEventListeners() {
    // Close modal events
    this.modal.querySelector('.keyboard-picker-close').addEventListener('click', () => {
      this.closeModal();
    });
    
    this.modal.querySelector('.keyboard-picker-overlay').addEventListener('click', () => {
      this.closeModal();
    });
    
    this.modal.querySelector('#cancel-picker').addEventListener('click', () => {
      this.closeModal();
    });

    // Action buttons
    this.modal.querySelector('#clear-shortcut').addEventListener('click', () => {
      this.clearSelection();
    });
    
    this.modal.querySelector('#apply-shortcut').addEventListener('click', () => {
      this.applyShortcut();
    });

    // Modifier button clicks
    this.modal.querySelectorAll('.modifier-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        this.toggleModifier(key);
        this.updateDisplay();
      });
    });

    // Key button clicks
    this.modal.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        this.selectKey(key);
        this.updateDisplay();
      });
    });

    // Global keyboard events when modal is open
    document.addEventListener('keydown', (e) => {
      if (!this.modal.classList.contains('hidden') && this.isListening) {
        e.preventDefault();
        this.handleKeyDown(e);
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (!this.modal.classList.contains('hidden') && this.isListening) {
        e.preventDefault();
        this.handleKeyUp(e);
      }
    });
  }

  /**
   * Open the picker modal
   */
  openPicker(currentShortcut = '', callback = null, existingShortcuts = []) {
    this.callback = callback;
    this.conflicts.clear();
    
    // Build conflict map for validation
    existingShortcuts.forEach((shortcut, index) => {
      if (shortcut && shortcut !== currentShortcut) {
        this.conflicts.set(shortcut, index);
      }
    });
    
    // Parse current shortcut if provided
    if (currentShortcut) {
      this.parseShortcut(currentShortcut);
    } else {
      this.clearSelection();
    }
    
    this.modal.classList.remove('hidden');
    this.isListening = true;
    this.updateDisplay();
    
    // Focus on the modal for keyboard capture
    this.modal.focus();
  }

  /**
   * Close the picker modal
   */
  closeModal() {
    this.modal.classList.add('hidden');
    this.isListening = false;
    this.clearSelection();
    this.callback = null;
  }

  /**
   * Parse existing shortcut string
   */
  parseShortcut(shortcut) {
    this.clearSelection();
    
    const parts = shortcut.split('+').map(part => part.trim());
    
    parts.forEach(part => {
      if (Object.keys(this.keyMap.modifiers).includes(part)) {
        this.modifiers.add(part);
      } else {
        this.currentKeys.add(part);
      }
    });
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    // Track modifiers
    if (e.ctrlKey || e.metaKey) this.modifiers.add('CmdOrCtrl');
    if (e.altKey) this.modifiers.add('Alt');
    if (e.shiftKey) this.modifiers.add('Shift');
    
    // Don't add modifier keys as main keys
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      this.currentKeys.clear();
      this.currentKeys.add(e.key);
    }
    
    this.updateDisplay();
  }

  handleKeyUp(e) {
    // Remove modifiers when released
    if (!e.ctrlKey && !e.metaKey) this.modifiers.delete('CmdOrCtrl');
    if (!e.altKey) this.modifiers.delete('Alt');
    if (!e.shiftKey) this.modifiers.delete('Shift');
    
    this.updateDisplay();
  }

  /**
   * Toggle modifier selection
   */
  toggleModifier(modifier) {
    if (this.modifiers.has(modifier)) {
      this.modifiers.delete(modifier);
    } else {
      this.modifiers.add(modifier);
    }
    
    // Update visual state
    const btn = this.modal.querySelector(`[data-key="${modifier}"]`);
    btn.classList.toggle('active', this.modifiers.has(modifier));
  }

  /**
   * Select a key
   */
  selectKey(key) {
    this.currentKeys.clear();
    this.currentKeys.add(key);
    
    // Update visual state
    this.modal.querySelectorAll('.key-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const btn = this.modal.querySelector(`[data-key="${key}"]`);
    if (btn) btn.classList.add('active');
  }

  /**
   * Clear current selection
   */
  clearSelection() {
    this.currentKeys.clear();
    this.modifiers.clear();
    
    // Clear visual states
    this.modal.querySelectorAll('.modifier-btn, .key-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    this.updateDisplay();
  }

  /**
   * Update the shortcut display
   */
  updateDisplay() {
    const preview = this.modal.querySelector('#shortcut-preview .preview-text');
    const status = this.modal.querySelector('#shortcut-status');
    const applyBtn = this.modal.querySelector('#apply-shortcut');
    const conflictWarning = this.modal.querySelector('#conflict-warning');
    
    if (this.currentKeys.size === 0 && this.modifiers.size === 0) {
      preview.textContent = 'Press keys to create shortcut...';
      status.textContent = '';
      applyBtn.disabled = true;
      conflictWarning.textContent = '';
      return;
    }
    
    // Build shortcut string
    const shortcutParts = [];
    
    // Add modifiers in consistent order
    const modifierOrder = ['CmdOrCtrl', 'Alt', 'Shift'];
    modifierOrder.forEach(mod => {
      if (this.modifiers.has(mod)) {
        shortcutParts.push(this.keyMap.modifiers[mod]);
      }
    });
    
    // Add main keys
    this.currentKeys.forEach(key => {
      const symbol = this.keyMap.special[key];
      shortcutParts.push(symbol || key);
    });
    
    const displayShortcut = shortcutParts.join(' + ');
    const electronShortcut = this.buildElectronShortcut();
    
    preview.innerHTML = `<strong>${displayShortcut}</strong>`;
    
    // Check for conflicts
    const hasConflict = this.conflicts.has(electronShortcut);
    if (hasConflict) {
      const conflictIndex = this.conflicts.get(electronShortcut);
      conflictWarning.innerHTML = `⚠️ This shortcut conflicts with Button/Encoder ${conflictIndex + 1}`;
      conflictWarning.className = 'conflict-warning active';
      status.innerHTML = '<span class="status-error">Conflict detected</span>';
    } else {
      conflictWarning.textContent = '';
      conflictWarning.className = 'conflict-warning';
      status.innerHTML = '<span class="status-valid">Valid shortcut</span>';
    }
    
    // Enable apply button if valid
    const isValid = this.currentKeys.size > 0 && !hasConflict;
    applyBtn.disabled = !isValid;
    
    // Show electron accelerator format
    if (electronShortcut) {
      status.innerHTML += `<br><small>Electron format: ${electronShortcut}</small>`;
    }
  }

  /**
   * Build Electron accelerator string
   */
  buildElectronShortcut() {
    if (this.currentKeys.size === 0) return '';
    
    const parts = [];
    
    // Add modifiers in Electron format
    if (this.modifiers.has('CmdOrCtrl')) parts.push('CmdOrCtrl');
    if (this.modifiers.has('Alt')) parts.push('Alt');  
    if (this.modifiers.has('Shift')) parts.push('Shift');
    
    // Add main key
    const mainKey = Array.from(this.currentKeys)[0];
    parts.push(mainKey);
    
    return parts.join('+');
  }

  /**
   * Apply the selected shortcut
   */
  applyShortcut() {
    const shortcut = this.buildElectronShortcut();
    
    if (this.callback && shortcut) {
      this.callback(shortcut);
    }
    
    this.closeModal();
  }

  /**
   * Get common shortcut templates
   */
  static getShortcutTemplates() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? 'Cmd' : 'Ctrl';
    
    return {
      'Copy': `${cmdKey}+C`,
      'Paste': `${cmdKey}+V`, 
      'Cut': `${cmdKey}+X`,
      'Undo': `${cmdKey}+Z`,
      'Redo': isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y',
      'Select All': `${cmdKey}+A`,
      'Save': `${cmdKey}+S`,
      'New': `${cmdKey}+N`,
      'Open': `${cmdKey}+O`,
      'Find': `${cmdKey}+F`,
      'Replace': `${cmdKey}+H`,
      'Refresh': isMac ? 'Cmd+R' : 'F5',
      'Full Screen': 'F11',
      'Developer Tools': isMac ? 'Cmd+Alt+I' : 'Ctrl+Shift+I'
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyboardShortcutPicker;
} else {
  window.KeyboardShortcutPicker = KeyboardShortcutPicker;
}
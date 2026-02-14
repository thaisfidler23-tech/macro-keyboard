/**
 * Import/Export Dialog Component
 *
 * Provides comprehensive UI for importing and exporting macro sequences
 * Supports multiple formats, bulk operations, and metadata editing
 */
class ImportExportDialog {
  constructor() {
    this.dialog = null;
    this.isVisible = false;
    this.currentMode = null; // 'import' or 'export'
    this.selectedSequences = new Set();
    this.importResults = [];

    this.supportedFormats = [
      {
        value: 'mkb',
        label: 'Macro Keyboard Format (.mkb)',
        description: 'Enhanced YAML with metadata'
      },
      {
        value: 'json',
        label: 'JSON Format (.json)',
        description: 'Standard JavaScript Object Notation'
      },
      {
        value: 'yaml',
        label: 'YAML Format (.yaml)',
        description: 'Human-readable data serialization'
      }
    ];

    this.initializeDialog();
  }

  /**
   * Initialize the import/export dialog
   */
  initializeDialog() {
    this.dialog = document.createElement('div');
    this.dialog.className = 'import-export-dialog-overlay';
    this.dialog.style.display = 'none';
    this.dialog.innerHTML = this.getDialogTemplate();

    document.body.appendChild(this.dialog);
    this.setupEventListeners();
  }

  /**
   * Get the HTML template for the dialog
   */
  getDialogTemplate() {
    return `
      <div class="import-export-dialog">
        <div class="dialog-header">
          <h2 class="dialog-title">Import/Export Sequences</h2>
          <button class="dialog-close-btn" title="Close">×</button>
        </div>

        <div class="dialog-content">
          <!-- Tab Navigation -->
          <div class="tab-navigation">
            <button class="tab-btn active" data-tab="export">Export Sequences</button>
            <button class="tab-btn" data-tab="import">Import Sequences</button>
          </div>

          <!-- Export Tab -->
          <div class="tab-content" data-tab="export">
            <div class="export-section">
              <h3>Export Options</h3>

              <div class="export-mode">
                <label>
                  <input type="radio" name="export-mode" value="selected" checked>
                  Export Selected Sequences
                </label>
                <label>
                  <input type="radio" name="export-mode" value="all">
                  Export All Sequences
                </label>
                <label>
                  <input type="radio" name="export-mode" value="profile">
                  Export Current Profile
                </label>
              </div>

              <div class="sequence-selection">
                <h4>Select Sequences to Export</h4>
                <div class="sequence-list-container">
                  <div class="sequence-list-header">
                    <label class="select-all">
                      <input type="checkbox" class="select-all-checkbox">
                      Select All
                    </label>
                    <span>Name</span>
                    <span>Actions</span>
                    <span>Duration</span>
                  </div>
                  <div class="sequence-list-body">
                    <!-- Sequences will be populated here -->
                  </div>
                </div>
              </div>

              <div class="format-selection">
                <h4>Export Format</h4>
                <div class="format-options">
                  ${this.supportedFormats
                    .map(
                      format => `
                    <label class="format-option">
                      <input type="radio" name="export-format" value="${format.value}" ${format.value === 'mkb' ? 'checked' : ''}>
                      <div class="format-info">
                        <strong>${format.label}</strong>
                        <span class="format-description">${format.description}</span>
                      </div>
                    </label>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="export-options">
                <h4>Export Options</h4>
                <label>
                  <input type="checkbox" class="include-metadata-checkbox" checked>
                  Include Metadata
                </label>
                <label>
                  <input type="checkbox" class="create-package-checkbox" checked>
                  Create Package (Multiple Files)
                </label>
                <label>
                  <input type="checkbox" class="compress-output-checkbox">
                  Compress Output (ZIP)
                </label>
              </div>

              <div class="metadata-editor" style="display: none;">
                <h4>Package Metadata</h4>
                <div class="metadata-fields">
                  <div class="field-group">
                    <label>Package Name:</label>
                    <input type="text" class="package-name-input" placeholder="My Macro Package">
                  </div>
                  <div class="field-group">
                    <label>Description:</label>
                    <textarea class="package-description-input" placeholder="Description of this package"></textarea>
                  </div>
                  <div class="field-group">
                    <label>Author:</label>
                    <input type="text" class="package-author-input" placeholder="Your Name">
                  </div>
                  <div class="field-group">
                    <label>Tags (comma-separated):</label>
                    <input type="text" class="package-tags-input" placeholder="productivity, workflow, automation">
                  </div>
                </div>
              </div>

              <div class="export-actions">
                <button class="export-btn">Export Sequences</button>
                <button class="preview-export-btn">Preview Export</button>
              </div>
            </div>
          </div>

          <!-- Import Tab -->
          <div class="tab-content" data-tab="import" style="display: none;">
            <div class="import-section">
              <h3>Import Sequences</h3>

              <!-- Drag and Drop Area -->
              <div class="drag-drop-area">
                <div class="drag-drop-content">
                  <div class="drag-drop-icon">📁</div>
                  <p>Drag and drop sequence files here</p>
                  <p class="drag-drop-formats">Supports: .mkb, .json, .yaml files</p>
                  <button class="browse-files-btn">Browse Files</button>
                </div>
              </div>

              <!-- File Browser Input (Hidden) -->
              <input type="file" class="file-input" multiple accept=".mkb,.json,.yaml,.yml" style="display: none;">

              <!-- Import Options -->
              <div class="import-options">
                <h4>Import Options</h4>
                <label>
                  <input type="checkbox" class="overwrite-existing-checkbox">
                  Overwrite Existing Sequences
                </label>
                <label>
                  <input type="checkbox" class="backup-before-import-checkbox" checked>
                  Create Backup Before Import
                </label>
                <label>
                  <input type="checkbox" class="validate-sequences-checkbox" checked>
                  Validate Sequences Before Import
                </label>
              </div>

              <!-- Import Preview -->
              <div class="import-preview" style="display: none;">
                <h4>Import Preview</h4>
                <div class="preview-list">
                  <!-- Preview items will be populated here -->
                </div>
              </div>

              <!-- Conflict Resolution -->
              <div class="conflict-resolution" style="display: none;">
                <h4>Conflict Resolution</h4>
                <p>The following sequences already exist:</p>
                <div class="conflict-list">
                  <!-- Conflicts will be populated here -->
                </div>
                <div class="conflict-actions">
                  <button class="resolve-all-skip-btn">Skip All</button>
                  <button class="resolve-all-replace-btn">Replace All</button>
                  <button class="resolve-all-rename-btn">Rename All</button>
                </div>
              </div>

              <div class="import-actions">
                <button class="import-btn" disabled>Import Sequences</button>
                <button class="clear-import-btn">Clear Selection</button>
              </div>
            </div>
          </div>

          <!-- Progress Section -->
          <div class="progress-section" style="display: none;">
            <h4>Processing...</h4>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-text">Preparing...</div>
            <div class="progress-details">
              <!-- Details will be populated here -->
            </div>
          </div>

          <!-- Results Section -->
          <div class="results-section" style="display: none;">
            <h4>Results</h4>
            <div class="results-summary">
              <!-- Summary will be populated here -->
            </div>
            <div class="results-details">
              <!-- Details will be populated here -->
            </div>
            <div class="results-actions">
              <button class="close-results-btn">Close</button>
              <button class="export-log-btn">Export Log</button>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="dialog-cancel-btn">Cancel</button>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners for the dialog
   */
  setupEventListeners() {
    // Close dialog
    this.dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
      this.hide();
    });

    this.dialog.querySelector('.dialog-cancel-btn').addEventListener('click', () => {
      this.hide();
    });

    // Tab navigation
    this.dialog.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Export mode selection
    this.dialog.querySelectorAll('input[name="export-mode"]').forEach(radio => {
      radio.addEventListener('change', e => {
        this.handleExportModeChange(e.target.value);
      });
    });

    // Select all checkbox
    this.dialog.querySelector('.select-all-checkbox').addEventListener('change', e => {
      this.handleSelectAll(e.target.checked);
    });

    // Export format selection
    this.dialog.querySelectorAll('input[name="export-format"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateFormatInfo();
      });
    });

    // Export options
    this.dialog.querySelector('.create-package-checkbox').addEventListener('change', e => {
      this.toggleMetadataEditor(e.target.checked);
    });

    // Export actions
    this.dialog.querySelector('.export-btn').addEventListener('click', () => {
      this.startExport();
    });

    this.dialog.querySelector('.preview-export-btn').addEventListener('click', () => {
      this.previewExport();
    });

    // Import drag and drop
    const dropArea = this.dialog.querySelector('.drag-drop-area');

    dropArea.addEventListener('dragover', e => {
      e.preventDefault();
      dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', e => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      this.handleFileDrop(e.dataTransfer.files);
    });

    // Browse files
    this.dialog.querySelector('.browse-files-btn').addEventListener('click', () => {
      this.dialog.querySelector('.file-input').click();
    });

    this.dialog.querySelector('.file-input').addEventListener('change', e => {
      this.handleFileSelection(e.target.files);
    });

    // Import actions
    this.dialog.querySelector('.import-btn').addEventListener('click', () => {
      this.startImport();
    });

    this.dialog.querySelector('.clear-import-btn').addEventListener('click', () => {
      this.clearImportSelection();
    });

    // Conflict resolution
    this.dialog.querySelector('.resolve-all-skip-btn').addEventListener('click', () => {
      this.resolveAllConflicts('skip');
    });

    this.dialog.querySelector('.resolve-all-replace-btn').addEventListener('click', () => {
      this.resolveAllConflicts('replace');
    });

    this.dialog.querySelector('.resolve-all-rename-btn').addEventListener('click', () => {
      this.resolveAllConflicts('rename');
    });

    // Results actions
    this.dialog.querySelector('.close-results-btn').addEventListener('click', () => {
      this.hide();
    });

    this.dialog.querySelector('.export-log-btn').addEventListener('click', () => {
      this.exportLog();
    });

    // Click outside to close
    this.dialog.addEventListener('click', e => {
      if (e.target === this.dialog) {
        this.hide();
      }
    });
  }

  /**
   * Show the dialog in export mode
   */
  showExport(sequences = {}) {
    this.currentMode = 'export';
    this.populateSequenceList(sequences);
    this.switchTab('export');
    this.show();
  }

  /**
   * Show the dialog in import mode
   */
  showImport() {
    this.currentMode = 'import';
    this.switchTab('import');
    this.clearImportSelection();
    this.show();
  }

  /**
   * Show the dialog
   */
  show() {
    this.dialog.style.display = 'flex';
    this.isVisible = true;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide the dialog
   */
  hide() {
    this.dialog.style.display = 'none';
    this.isVisible = false;
    document.body.style.overflow = '';
    this.resetDialog();
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    this.dialog.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    this.dialog.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.dataset.tab === tabName ? 'block' : 'none';
    });

    this.currentMode = tabName;
  }

  /**
   * Populate the sequence list for export
   */
  populateSequenceList(sequences) {
    const listBody = this.dialog.querySelector('.sequence-list-body');
    listBody.innerHTML = '';

    this.selectedSequences.clear();

    Object.entries(sequences).forEach(([name, sequence]) => {
      const row = this.createSequenceRow(name, sequence);
      listBody.appendChild(row);
    });
  }

  /**
   * Create a sequence row for selection
   */
  createSequenceRow(name, sequence) {
    const row = document.createElement('div');
    row.className = 'sequence-row';

    const actionCount = sequence.sequence ? sequence.sequence.length : 0;
    const duration = this.formatDuration(sequence.metadata?.duration || 0);

    row.innerHTML = `
      <label class="sequence-checkbox">
        <input type="checkbox" value="${name}">
        <span class="checkmark"></span>
      </label>
      <span class="sequence-name" title="${sequence.description || name}">${name}</span>
      <span class="sequence-actions">${actionCount}</span>
      <span class="sequence-duration">${duration}</span>
    `;

    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      this.handleSequenceSelection(name, checkbox.checked);
    });

    return row;
  }

  /**
   * Handle sequence selection change
   */
  handleSequenceSelection(name, selected) {
    if (selected) {
      this.selectedSequences.add(name);
    } else {
      this.selectedSequences.delete(name);
    }

    this.updateExportButton();
    this.updateSelectAllState();
  }

  /**
   * Handle select all checkbox
   */
  handleSelectAll(selectAll) {
    const checkboxes = this.dialog.querySelectorAll('.sequence-row input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
      this.handleSequenceSelection(checkbox.value, selectAll);
    });
  }

  /**
   * Update select all checkbox state
   */
  updateSelectAllState() {
    const checkboxes = this.dialog.querySelectorAll('.sequence-row input[type="checkbox"]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const selectAllCheckbox = this.dialog.querySelector('.select-all-checkbox');

    if (checkedCount === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (checkedCount === checkboxes.length) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
    }
  }

  /**
   * Handle export mode change
   */
  handleExportModeChange(mode) {
    const sequenceSelection = this.dialog.querySelector('.sequence-selection');

    if (mode === 'selected') {
      sequenceSelection.style.display = 'block';
    } else {
      sequenceSelection.style.display = 'none';
      // Auto-select sequences based on mode
      if (mode === 'all') {
        this.handleSelectAll(true);
      }
    }
  }

  /**
   * Toggle metadata editor visibility
   */
  toggleMetadataEditor(show) {
    const metadataEditor = this.dialog.querySelector('.metadata-editor');
    metadataEditor.style.display = show ? 'block' : 'none';
  }

  /**
   * Update export button state
   */
  updateExportButton() {
    const exportBtn = this.dialog.querySelector('.export-btn');
    const exportMode = this.dialog.querySelector('input[name="export-mode"]:checked').value;

    if (exportMode === 'selected') {
      exportBtn.disabled = this.selectedSequences.size === 0;
    } else {
      exportBtn.disabled = false;
    }
  }

  /**
   * Start the export process
   */
  async startExport() {
    try {
      this.showProgress('Preparing export...');

      const exportOptions = this.collectExportOptions();
      const result = await window.electronAPI.exportSequences(exportOptions);

      if (result.success) {
        this.showResults('export', result);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      this.showError(`Export failed: ${error.message}`);
    }
  }

  /**
   * Preview export without actually exporting
   */
  async previewExport() {
    try {
      const exportOptions = this.collectExportOptions();
      const preview = await window.electronAPI.previewExport(exportOptions);

      this.showExportPreview(preview);
    } catch (error) {
      this.showError(`Preview failed: ${error.message}`);
    }
  }

  /**
   * Collect export options from UI
   */
  collectExportOptions() {
    const exportMode = this.dialog.querySelector('input[name="export-mode"]:checked').value;
    const format = this.dialog.querySelector('input[name="export-format"]:checked').value;
    const includeMetadata = this.dialog.querySelector('.include-metadata-checkbox').checked;
    const createPackage = this.dialog.querySelector('.create-package-checkbox').checked;
    const compressOutput = this.dialog.querySelector('.compress-output-checkbox').checked;

    const options = {
      mode: exportMode,
      format,
      includeMetadata,
      createPackage,
      compressOutput
    };

    if (exportMode === 'selected') {
      options.sequences = Array.from(this.selectedSequences);
    }

    if (createPackage) {
      options.packageMetadata = {
        name: this.dialog.querySelector('.package-name-input').value || 'Macro Package',
        description: this.dialog.querySelector('.package-description-input').value || '',
        author: this.dialog.querySelector('.package-author-input').value || 'Unknown',
        tags: this.dialog
          .querySelector('.package-tags-input')
          .value.split(',')
          .map(tag => tag.trim())
          .filter(tag => tag)
      };
    }

    return options;
  }

  /**
   * Handle file drop for import
   */
  async handleFileDrop(files) {
    const fileArray = Array.from(files);
    await this.processImportFiles(fileArray);
  }

  /**
   * Handle file selection from browser
   */
  async handleFileSelection(files) {
    const fileArray = Array.from(files);
    await this.processImportFiles(fileArray);
  }

  /**
   * Process files for import
   */
  async processImportFiles(files) {
    try {
      this.showProgress('Processing files...');

      const validFiles = files.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return ['mkb', 'json', 'yaml', 'yml'].includes(ext);
      });

      if (validFiles.length === 0) {
        throw new Error('No valid sequence files found');
      }

      // Read and validate files
      const fileData = [];
      for (const file of validFiles) {
        const content = await this.readFileContent(file);
        fileData.push({ file, content });
      }

      // Parse and validate sequences
      const parseResults = await window.electronAPI.parseImportFiles(fileData);

      this.importResults = parseResults.results;
      this.hideProgress();

      if (parseResults.conflicts.length > 0) {
        this.showConflictResolution(parseResults.conflicts);
      } else {
        this.showImportPreview(parseResults.results);
      }

      this.updateImportButton();
    } catch (error) {
      this.showError(`File processing failed: ${error.message}`);
    }
  }

  /**
   * Read file content as text
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsText(file);
    });
  }

  /**
   * Show import preview
   */
  showImportPreview(results) {
    const previewSection = this.dialog.querySelector('.import-preview');
    const previewList = previewSection.querySelector('.preview-list');

    previewList.innerHTML = '';

    results.forEach(result => {
      const item = document.createElement('div');
      item.className = `preview-item ${result.valid ? 'valid' : 'invalid'}`;
      item.innerHTML = `
        <div class="preview-header">
          <span class="preview-name">${result.name}</span>
          <span class="preview-status ${result.valid ? 'success' : 'error'}">
            ${result.valid ? '✓' : '✗'}
          </span>
        </div>
        <div class="preview-details">
          <span>Actions: ${result.actionCount || 0}</span>
          <span>Format: ${result.format}</span>
          ${result.error ? `<span class="error">Error: ${result.error}</span>` : ''}
        </div>
      `;
      previewList.appendChild(item);
    });

    previewSection.style.display = 'block';
  }

  /**
   * Show conflict resolution interface
   */
  showConflictResolution(conflicts) {
    const conflictSection = this.dialog.querySelector('.conflict-resolution');
    const conflictList = conflictSection.querySelector('.conflict-list');

    conflictList.innerHTML = '';

    conflicts.forEach(conflict => {
      const item = document.createElement('div');
      item.className = 'conflict-item';
      item.innerHTML = `
        <div class="conflict-header">
          <span class="conflict-name">${conflict.name}</span>
          <div class="conflict-actions">
            <button class="conflict-btn skip-btn" data-name="${conflict.name}">Skip</button>
            <button class="conflict-btn replace-btn" data-name="${conflict.name}">Replace</button>
            <button class="conflict-btn rename-btn" data-name="${conflict.name}">Rename</button>
          </div>
        </div>
        <div class="conflict-details">
          <div class="existing">
            <strong>Existing:</strong> ${conflict.existing.actionCount} actions
          </div>
          <div class="new">
            <strong>New:</strong> ${conflict.new.actionCount} actions
          </div>
        </div>
      `;

      // Add event listeners for conflict resolution buttons
      item.querySelectorAll('.conflict-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const action = e.target.classList.contains('skip-btn')
            ? 'skip'
            : e.target.classList.contains('replace-btn')
              ? 'replace'
              : 'rename';
          this.resolveConflict(conflict.name, action);
        });
      });

      conflictList.appendChild(item);
    });

    conflictSection.style.display = 'block';
  }

  /**
   * Resolve individual conflict
   */
  resolveConflict(name, action) {
    // Find and update the conflict in import results
    const resultIndex = this.importResults.findIndex(r => r.name === name);
    if (resultIndex !== -1) {
      this.importResults[resultIndex].conflictResolution = action;

      if (action === 'rename') {
        const newName = prompt(`Enter new name for "${name}":`, `${name}_imported`);
        if (newName && newName.trim()) {
          this.importResults[resultIndex].newName = newName.trim();
        }
      }
    }

    // Update UI to show resolution
    const conflictItem = document.querySelector(`[data-name="${name}"]`).closest('.conflict-item');
    conflictItem.classList.add('resolved');

    this.checkConflictResolution();
  }

  /**
   * Resolve all conflicts with same action
   */
  resolveAllConflicts(action) {
    this.importResults.forEach(result => {
      if (result.conflict) {
        result.conflictResolution = action;
        if (action === 'rename') {
          result.newName = `${result.name}_imported`;
        }
      }
    });

    // Update UI
    this.dialog.querySelectorAll('.conflict-item').forEach(item => {
      item.classList.add('resolved');
    });

    this.checkConflictResolution();
  }

  /**
   * Check if all conflicts are resolved
   */
  checkConflictResolution() {
    const unresolvedConflicts = this.importResults.filter(r => r.conflict && !r.conflictResolution);

    if (unresolvedConflicts.length === 0) {
      // Hide conflict resolution, show preview
      this.dialog.querySelector('.conflict-resolution').style.display = 'none';
      this.showImportPreview(this.importResults);
      this.updateImportButton();
    }
  }

  /**
   * Start the import process
   */
  async startImport() {
    try {
      this.showProgress('Importing sequences...');

      const importOptions = this.collectImportOptions();
      const result = await window.electronAPI.importSequences(this.importResults, importOptions);

      if (result.success) {
        this.showResults('import', result);
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      this.showError(`Import failed: ${error.message}`);
    }
  }

  /**
   * Collect import options from UI
   */
  collectImportOptions() {
    return {
      overwriteExisting: this.dialog.querySelector('.overwrite-existing-checkbox').checked,
      createBackup: this.dialog.querySelector('.backup-before-import-checkbox').checked,
      validateSequences: this.dialog.querySelector('.validate-sequences-checkbox').checked
    };
  }

  /**
   * Clear import selection
   */
  clearImportSelection() {
    this.importResults = [];
    this.dialog.querySelector('.file-input').value = '';
    this.dialog.querySelector('.import-preview').style.display = 'none';
    this.dialog.querySelector('.conflict-resolution').style.display = 'none';
    this.updateImportButton();
  }

  /**
   * Update import button state
   */
  updateImportButton() {
    const importBtn = this.dialog.querySelector('.import-btn');
    const validResults = this.importResults.filter(
      r => r.valid && (!r.conflict || r.conflictResolution)
    );
    importBtn.disabled = validResults.length === 0;
  }

  /**
   * Show progress indicator
   */
  showProgress(message) {
    const progressSection = this.dialog.querySelector('.progress-section');
    const progressText = progressSection.querySelector('.progress-text');

    progressText.textContent = message;
    progressSection.style.display = 'block';

    // Hide other sections
    this.dialog.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
  }

  /**
   * Hide progress indicator
   */
  hideProgress() {
    this.dialog.querySelector('.progress-section').style.display = 'none';
    this.dialog.querySelector(`.tab-content[data-tab="${this.currentMode}"]`).style.display =
      'block';
  }

  /**
   * Show results section
   */
  showResults(operation, results) {
    const resultsSection = this.dialog.querySelector('.results-section');
    const summaryDiv = resultsSection.querySelector('.results-summary');
    const detailsDiv = resultsSection.querySelector('.results-details');

    // Create summary
    summaryDiv.innerHTML = this.createResultsSummary(operation, results);

    // Create details
    detailsDiv.innerHTML = this.createResultsDetails(operation, results);

    // Hide progress, show results
    this.hideProgress();
    this.dialog.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    resultsSection.style.display = 'block';
  }

  /**
   * Create results summary HTML
   */
  createResultsSummary(operation, results) {
    const { success, count, errors } = results;
    const operationText = operation === 'export' ? 'exported' : 'imported';

    return `
      <div class="summary-card ${success ? 'success' : 'error'}">
        <h4>${success ? 'Success' : 'Partial Success'}</h4>
        <p>${count} sequences ${operationText} successfully</p>
        ${errors && errors.length > 0 ? `<p class="error">${errors.length} errors encountered</p>` : ''}
      </div>
    `;
  }

  /**
   * Create results details HTML
   */
  createResultsDetails(operation, results) {
    let html = '<div class="details-list">';

    if (results.results) {
      results.results.forEach(result => {
        html += `
          <div class="detail-item ${result.success ? 'success' : 'error'}">
            <span class="detail-name">${result.name}</span>
            <span class="detail-status">${result.success ? '✓' : '✗'}</span>
            ${result.error ? `<span class="detail-error">${result.error}</span>` : ''}
          </div>
        `;
      });
    }

    if (results.errors && results.errors.length > 0) {
      html += '<h5>Errors:</h5>';
      results.errors.forEach(error => {
        html += `<div class="error-item">${error.file}: ${error.error}</div>`;
      });
    }

    html += '</div>';
    return html;
  }

  /**
   * Show error message
   */
  showError(message) {
    this.hideProgress();
    alert(message); // Simple error display - could be enhanced with better UI
  }

  /**
   * Export operation log
   */
  exportLog() {
    // Implementation would save the operation log to file
    console.log('Export log functionality - to be implemented');
  }

  /**
   * Reset dialog to initial state
   */
  resetDialog() {
    this.selectedSequences.clear();
    this.importResults = [];

    // Reset form fields
    this.dialog.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked =
        input.classList.contains('default-checked') ||
        [
          'include-metadata-checkbox',
          'create-package-checkbox',
          'backup-before-import-checkbox',
          'validate-sequences-checkbox'
        ].includes(input.className);
    });

    this.dialog.querySelectorAll('input[type="radio"][value="mkb"]').forEach(input => {
      input.checked = true;
    });

    this.dialog.querySelectorAll('input[type="text"], textarea').forEach(input => {
      input.value = '';
    });

    // Hide all sections
    this.dialog.querySelector('.progress-section').style.display = 'none';
    this.dialog.querySelector('.results-section').style.display = 'none';
    this.dialog.querySelector('.import-preview').style.display = 'none';
    this.dialog.querySelector('.conflict-resolution').style.display = 'none';
    this.dialog.querySelector('.metadata-editor').style.display = 'none';
  }

  /**
   * Format duration in milliseconds
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImportExportDialog;
}

/**
 * Profile Management UI Component
 * Provides interface for creating, managing, and switching between configuration profiles
 */

class ProfileManagerUI {
  constructor() {
    this.profileManager = null;
    this.currentProfiles = [];
    this.selectedProfile = null;

    this.initializeEventListeners();
  }

  /**
   * Initialize the profile management interface
   */
  async initialize(profileManager) {
    this.profileManager = profileManager;
    await this.refreshProfiles();
    this.updateUI();
  }

  /**
   * Set up event listeners for profile management
   */
  initializeEventListeners() {
    // Profile selection
    document.addEventListener('change', (event) => {
      if (event.target.id === 'profile-select') {
        this.handleProfileSelection(event.target.value);
      }
    });

    // Profile actions
    document.addEventListener('click', (event) => {
      const action = event.target.dataset.profileAction;
      if (action) {
        event.preventDefault();
        this.handleProfileAction(action, event.target.dataset);
      }
    });

    // Form submissions
    document.addEventListener('submit', (event) => {
      if (event.target.classList.contains('profile-form')) {
        event.preventDefault();
        this.handleFormSubmission(event.target);
      }
    });

    // Import/Export handlers
    document.addEventListener('change', (event) => {
      if (event.target.id === 'profile-import-file') {
        this.handleFileImport(event.target.files[0]);
      }
    });
  }

  /**
   * Refresh the profiles list from the backend
   */
  async refreshProfiles() {
    try {
      this.currentProfiles = await window.electronAPI.getProfiles();
      this.updateProfilesList();
      this.updateProfileStatistics();
    } catch (error) {
      console.error('Failed to refresh profiles:', error);
      this.showMessage(`Failed to refresh profiles: ${  error.message}`, 'error');
    }
  }

  /**
   * Update the profiles list in the UI
   */
  updateProfilesList() {
    const profileSelect = document.getElementById('profile-select');
    const profilesList = document.getElementById('profiles-list');

    if (profileSelect) {
      profileSelect.innerHTML = '';

      this.currentProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.name;
        option.textContent = profile.name;
        option.selected = profile.isActive;
        profileSelect.appendChild(option);
      });
    }

    if (profilesList) {
      profilesList.innerHTML = '';

      this.currentProfiles.forEach(profile => {
        const profileItem = this.createProfileListItem(profile);
        profilesList.appendChild(profileItem);
      });
    }
  }

  /**
   * Create a profile list item element
   */
  createProfileListItem(profile) {
    const item = document.createElement('div');
    item.className = 'profile-item';
    item.dataset.profileName = profile.name;

    if (profile.isActive) {
      item.classList.add('active');
    }

    item.innerHTML = `
      <div class="profile-info">
        <div class="profile-header">
          <h3 class="profile-name">${this.escapeHtml(profile.name)}</h3>
          ${profile.isActive ? '<span class="profile-badge active">Active</span>' : ''}
        </div>
        <p class="profile-description">${this.escapeHtml(profile.description)}</p>
        <div class="profile-stats">
          <span class="stat-item">
            <i class="icon-button"></i>
            ${profile.buttonCount} buttons
          </span>
          <span class="stat-item">
            <i class="icon-encoder"></i>
            ${profile.encoderCount} encoders
          </span>
          <span class="stat-item">
            <i class="icon-calendar"></i>
            Modified: ${this.formatDate(profile.lastModified)}
          </span>
        </div>
      </div>
      <div class="profile-actions">
        <button class="btn btn-primary btn-sm"
                data-profile-action="activate"
                data-profile-name="${profile.name}"
                ${profile.isActive ? 'disabled' : ''}>
          ${profile.isActive ? 'Active' : 'Activate'}
        </button>
        <button class="btn btn-secondary btn-sm"
                data-profile-action="edit"
                data-profile-name="${profile.name}">
          Edit
        </button>
        <button class="btn btn-secondary btn-sm"
                data-profile-action="duplicate"
                data-profile-name="${profile.name}">
          Duplicate
        </button>
        <button class="btn btn-secondary btn-sm"
                data-profile-action="export"
                data-profile-name="${profile.name}">
          Export
        </button>
        <button class="btn btn-danger btn-sm"
                data-profile-action="delete"
                data-profile-name="${profile.name}"
                ${profile.isActive ? 'disabled' : ''}>
          Delete
        </button>
      </div>
    `;

    return item;
  }

  /**
   * Update profile statistics display
   */
  updateProfileStatistics() {
    const statsElement = document.getElementById('profile-statistics');
    if (!statsElement) {
      return;
    }

    const stats = this.calculateStatistics();

    statsElement.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${stats.totalProfiles}</div>
          <div class="stat-label">Total Profiles</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.totalButtons}</div>
          <div class="stat-label">Total Buttons</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.totalEncoders}</div>
          <div class="stat-label">Total Encoders</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${stats.profilesWithActions}</div>
          <div class="stat-label">Configured Profiles</div>
        </div>
      </div>
    `;
  }

  /**
   * Calculate statistics from current profiles
   */
  calculateStatistics() {
    return {
      totalProfiles: this.currentProfiles.length,
      totalButtons: this.currentProfiles.reduce((sum, p) => sum + p.buttonCount, 0),
      totalEncoders: this.currentProfiles.reduce((sum, p) => sum + p.encoderCount, 0),
      profilesWithActions: this.currentProfiles.filter(p => p.buttonCount > 0 || p.encoderCount > 0).length
    };
  }

  /**
   * Handle profile selection change
   */
  async handleProfileSelection(profileName) {
    if (!profileName) {
      return;
    }

    try {
      await window.electronAPI.activateProfile(profileName);
      await this.refreshProfiles();
      this.showMessage(`Activated profile: ${profileName}`, 'success');
    } catch (error) {
      console.error('Failed to activate profile:', error);
      this.showMessage(`Failed to activate profile: ${  error.message}`, 'error');
    }
  }

  /**
   * Handle profile action buttons
   */
  async handleProfileAction(action, dataset) {
    const profileName = dataset.profileName;

    try {
      switch (action) {
      case 'activate':
        await this.activateProfile(profileName);
        break;
      case 'edit':
        this.showEditProfileModal(profileName);
        break;
      case 'duplicate':
        this.showDuplicateProfileModal(profileName);
        break;
      case 'export':
        await this.exportProfile(profileName);
        break;
      case 'delete':
        await this.deleteProfile(profileName);
        break;
      default:
        console.warn('Unknown profile action:', action);
      }
    } catch (error) {
      console.error(`Failed to ${action} profile:`, error);
      this.showMessage(`Failed to ${action} profile: ${error.message}`, 'error');
    }
  }

  /**
   * Activate a profile
   */
  async activateProfile(profileName) {
    await window.electronAPI.activateProfile(profileName);
    await this.refreshProfiles();
    this.showMessage(`Activated profile: ${profileName}`, 'success');
  }

  /**
   * Delete a profile with confirmation
   */
  async deleteProfile(profileName) {
    const confirmed = await this.showConfirmationDialog(
      'Delete Profile',
      `Are you sure you want to delete the profile "${profileName}"? This action cannot be undone.`
    );

    if (confirmed) {
      await window.electronAPI.deleteProfile(profileName);
      await this.refreshProfiles();
      this.showMessage(`Deleted profile: ${profileName}`, 'success');
    }
  }

  /**
   * Export a profile to file
   */
  async exportProfile(profileName) {
    try {
      const result = await window.electronAPI.showSaveDialog({
        title: 'Export Profile',
        defaultPath: `${profileName}.yaml`,
        filters: [
          { name: 'YAML Files', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        await window.electronAPI.exportProfile(profileName, result.filePath);
        this.showMessage(`Exported profile to: ${result.filePath}`, 'success');
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle file import
   */
  async handleFileImport(file) {
    if (!file) {
      return;
    }

    try {
      const filePath = file.path;
      const profileName = await window.electronAPI.importProfile(filePath);
      await this.refreshProfiles();
      this.showMessage(`Imported profile: ${profileName}`, 'success');
    } catch (error) {
      console.error('Failed to import profile:', error);
      this.showMessage(`Failed to import profile: ${  error.message}`, 'error');
    }
  }

  /**
   * Show create profile modal
   */
  showCreateProfileModal() {
    const modal = document.getElementById('create-profile-modal');
    if (modal) {
      // Reset form
      const form = modal.querySelector('form');
      if (form) {
        form.reset();
      }

      // Show modal
      modal.style.display = 'block';
      modal.classList.add('active');
    }
  }

  /**
   * Show edit profile modal
   */
  async showEditProfileModal(profileName) {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) {
      return;
    }

    try {
      const profile = this.currentProfiles.find(p => p.name === profileName);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Populate form with current profile data
      const nameInput = modal.querySelector('#edit-profile-name');
      const descriptionInput = modal.querySelector('#edit-profile-description');

      if (nameInput) {
        nameInput.value = profile.name;
      }
      if (descriptionInput) {
        descriptionInput.value = profile.description;
      }

      // Store original name for update
      modal.dataset.originalName = profileName;

      // Show modal
      modal.style.display = 'block';
      modal.classList.add('active');
    } catch (error) {
      this.showMessage(`Failed to load profile for editing: ${  error.message}`, 'error');
    }
  }

  /**
   * Show duplicate profile modal
   */
  showDuplicateProfileModal(sourceProfileName) {
    const modal = document.getElementById('duplicate-profile-modal');
    if (!modal) {
      return;
    }

    // Set source profile
    const sourceInput = modal.querySelector('#duplicate-source-name');
    if (sourceInput) {
      sourceInput.value = sourceProfileName;
    }

    // Generate default new name
    const newNameInput = modal.querySelector('#duplicate-new-name');
    if (newNameInput) {
      newNameInput.value = `${sourceProfileName}_copy`;
    }

    // Store source name
    modal.dataset.sourceName = sourceProfileName;

    // Show modal
    modal.style.display = 'block';
    modal.classList.add('active');
  }

  /**
   * Handle form submissions
   */
  async handleFormSubmission(form) {
    const formData = new FormData(form);
    const action = form.dataset.action;

    try {
      switch (action) {
      case 'create-profile':
        await this.createProfile(formData);
        break;
      case 'edit-profile':
        await this.editProfile(form, formData);
        break;
      case 'duplicate-profile':
        await this.duplicateProfile(form, formData);
        break;
      default:
        console.warn('Unknown form action:', action);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      this.showMessage(`Failed to ${action}: ${error.message}`, 'error');
    }
  }

  /**
   * Create a new profile
   */
  async createProfile(formData) {
    const name = formData.get('name').trim();
    const description = formData.get('description').trim();
    const baseProfile = formData.get('baseProfile');

    if (!name) {
      throw new Error('Profile name is required');
    }

    await window.electronAPI.createProfile(name, baseProfile || null, description);
    await this.refreshProfiles();
    this.hideModal('create-profile-modal');
    this.showMessage(`Created profile: ${name}`, 'success');
  }

  /**
   * Edit an existing profile
   */
  async editProfile(form, formData) {
    const originalName = form.parentElement.dataset.originalName;
    const newName = formData.get('name').trim();
    const description = formData.get('description').trim();

    if (!newName) {
      throw new Error('Profile name is required');
    }

    if (newName !== originalName) {
      // If name changed, we need to create new and delete old
      await window.electronAPI.duplicateProfile(originalName, newName, description);
      if (originalName !== await window.electronAPI.getActiveProfileName()) {
        await window.electronAPI.deleteProfile(originalName);
      }
    } else {
      // Just update description
      await window.electronAPI.updateProfileDescription(originalName, description);
    }

    await this.refreshProfiles();
    this.hideModal('edit-profile-modal');
    this.showMessage(`Updated profile: ${newName}`, 'success');
  }

  /**
   * Duplicate a profile
   */
  async duplicateProfile(form, formData) {
    const sourceName = form.parentElement.dataset.sourceName;
    const newName = formData.get('newName').trim();
    const description = formData.get('description').trim();

    if (!newName) {
      throw new Error('New profile name is required');
    }

    await window.electronAPI.duplicateProfile(sourceName, newName, description);
    await this.refreshProfiles();
    this.hideModal('duplicate-profile-modal');
    this.showMessage(`Duplicated profile: ${newName}`, 'success');
  }

  /**
   * Show confirmation dialog
   */
  showConfirmationDialog(title, message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal confirmation-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">
            <p>${this.escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button class="btn btn-danger" data-action="confirm">Confirm</button>
          </div>
        </div>
      `;

      modal.addEventListener('click', (event) => {
        const action = event.target.dataset.action;
        if (action === 'confirm') {
          resolve(true);
          document.body.removeChild(modal);
        } else if (action === 'cancel' || event.target === modal) {
          resolve(false);
          document.body.removeChild(modal);
        }
      });

      document.body.appendChild(modal);
    });
  }

  /**
   * Hide modal
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  /**
   * Show message
   */
  showMessage(message, type = 'info') {
    // Find or create message container
    let messageContainer = document.getElementById('profile-messages');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'profile-messages';
      messageContainer.className = 'message-container';

      const profilesContainer = document.getElementById('profiles-container');
      if (profilesContainer) {
        profilesContainer.insertBefore(messageContainer, profilesContainer.firstChild);
      }
    }

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.textContent = message;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'message-close';
    closeButton.textContent = '×';
    closeButton.onclick = () => messageElement.remove();
    messageElement.appendChild(closeButton);

    // Add to container
    messageContainer.appendChild(messageElement);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.updateProfilesList();
    this.updateProfileStatistics();
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    if (!date) {
      return 'Unknown';
    }

    const d = new Date(date);
    return `${d.toLocaleDateString()  } ${  d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileManagerUI;
} else {
  window.ProfileManagerUI = ProfileManagerUI;
}

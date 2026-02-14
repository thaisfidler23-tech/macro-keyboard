/**
 * Visual Timeline Component for Macro Sequence Editing
 *
 * Provides canvas-based drag-and-drop interface for reordering macro steps
 * with visual indicators for different action types and timing controls
 */
class SequenceTimeline {
  constructor(container, options = {}) {
    this.container = container;
    this.sequence = [];
    this.selectedStep = null;
    this.draggedStep = null;
    this.dragOffset = { x: 0, y: 0 };

    // Configuration
    this.options = {
      stepHeight: 40,
      stepMinWidth: 120,
      stepMaxWidth: 300,
      stepSpacing: 2,
      headerHeight: 30,
      zoomLevel: 1,
      scrollOffset: 0,
      maxScrollOffset: 0,
      showTimings: true,
      showThumbnails: true,
      ...options
    };

    // Event callbacks
    this.onStepSelect = options.onStepSelect || (() => {});
    this.onStepMove = options.onStepMove || (() => {});
    this.onStepDelete = options.onStepDelete || (() => {});
    this.onStepEdit = options.onStepEdit || (() => {});

    this.initializeCanvas();
    this.setupEventListeners();
  }

  /**
   * Initialize the canvas and UI elements
   */
  initializeCanvas() {
    this.container.innerHTML = `
      <div class="timeline-header">
        <div class="timeline-controls">
          <button class="zoom-in-btn" title="Zoom In">+</button>
          <button class="zoom-out-btn" title="Zoom Out">-</button>
          <button class="zoom-fit-btn" title="Fit to Window">⤢</button>
          <span class="zoom-level">${Math.round(this.options.zoomLevel * 100)}%</span>
        </div>
        <div class="timeline-info">
          <span class="step-count">0 steps</span>
          <span class="total-duration">0ms</span>
        </div>
      </div>
      <div class="timeline-canvas-container">
        <canvas class="timeline-canvas"></canvas>
        <div class="timeline-scrollbar">
          <div class="scrollbar-thumb"></div>
        </div>
      </div>
      <div class="timeline-footer">
        <div class="timeline-legend">
          <span class="legend-item"><span class="legend-color keypress"></span>Keypress</span>
          <span class="legend-item"><span class="legend-color command"></span>Command</span>
          <span class="legend-item"><span class="legend-color application"></span>Application</span>
          <span class="legend-item"><span class="legend-color delay"></span>Delay</span>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('.timeline-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scrollbarThumb = this.container.querySelector('.scrollbar-thumb');

    this.resizeCanvas();
  }

  /**
   * Set up event listeners for interaction
   */
  setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // Control events
    this.container.querySelector('.zoom-in-btn').addEventListener('click', () => this.zoomIn());
    this.container.querySelector('.zoom-out-btn').addEventListener('click', () => this.zoomOut());
    this.container.querySelector('.zoom-fit-btn').addEventListener('click', () => this.zoomToFit());

    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Window resize
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    const container = this.container.querySelector('.timeline-canvas-container');
    const rect = container.getBoundingClientRect();

    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = `${rect.width  }px`;
    this.canvas.style.height = `${rect.height  }px`;

    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.redraw();
  }

  /**
   * Load sequence into timeline
   */
  loadSequence(sequence) {
    this.sequence = [...sequence];
    this.selectedStep = null;
    this.updateScrollBounds();
    this.updateInfo();
    this.redraw();
  }

  /**
   * Get current sequence
   */
  getSequence() {
    return [...this.sequence];
  }

  /**
   * Add step to sequence
   */
  addStep(step, index = -1) {
    if (index === -1) {
      this.sequence.push(step);
    } else {
      this.sequence.splice(index, 0, step);
    }
    this.updateScrollBounds();
    this.updateInfo();
    this.redraw();
  }

  /**
   * Remove step from sequence
   */
  removeStep(index) {
    if (index >= 0 && index < this.sequence.length) {
      this.sequence.splice(index, 1);
      if (this.selectedStep === index) {
        this.selectedStep = null;
      } else if (this.selectedStep > index) {
        this.selectedStep--;
      }
      this.updateScrollBounds();
      this.updateInfo();
      this.redraw();
    }
  }

  /**
   * Update step in sequence
   */
  updateStep(index, step) {
    if (index >= 0 && index < this.sequence.length) {
      this.sequence[index] = { ...this.sequence[index], ...step };
      this.updateInfo();
      this.redraw();
    }
  }

  /**
   * Handle mouse down events
   */
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const stepIndex = this.getStepAtPosition(x, y);

    if (stepIndex !== -1) {
      this.selectedStep = stepIndex;
      this.draggedStep = stepIndex;

      const stepRect = this.getStepRect(stepIndex);
      this.dragOffset = {
        x: x - stepRect.x,
        y: y - stepRect.y
      };

      this.onStepSelect(stepIndex, this.sequence[stepIndex]);
      this.redraw();
    } else {
      this.selectedStep = null;
      this.onStepSelect(null, null);
      this.redraw();
    }
  }

  /**
   * Handle mouse move events
   */
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.draggedStep !== null) {
      const newIndex = this.getStepInsertPosition(x);

      if (newIndex !== this.draggedStep && newIndex !== this.draggedStep + 1) {
        // Move step to new position
        const step = this.sequence[this.draggedStep];
        this.sequence.splice(this.draggedStep, 1);

        const actualIndex = newIndex > this.draggedStep ? newIndex - 1 : newIndex;
        this.sequence.splice(actualIndex, 0, step);

        this.selectedStep = actualIndex;
        this.draggedStep = actualIndex;

        this.onStepMove(this.draggedStep, actualIndex, step);
        this.redraw();
      }
    } else {
      // Show hover effects
      this.canvas.style.cursor = this.getStepAtPosition(x, y) !== -1 ? 'pointer' : 'default';
    }
  }

  /**
   * Handle mouse up events
   */
  handleMouseUp(event) {
    this.draggedStep = null;
    this.dragOffset = { x: 0, y: 0 };
  }

  /**
   * Handle wheel events for scrolling and zooming
   */
  handleWheel(event) {
    event.preventDefault();

    if (event.ctrlKey) {
      // Zoom
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      this.setZoom(this.options.zoomLevel * zoomFactor);
    } else {
      // Scroll
      const scrollAmount = event.deltaY * 0.5;
      this.setScrollOffset(this.options.scrollOffset + scrollAmount);
    }
  }

  /**
   * Handle double-click for editing
   */
  handleDoubleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const stepIndex = this.getStepAtPosition(x, y);
    if (stepIndex !== -1) {
      this.onStepEdit(stepIndex, this.sequence[stepIndex]);
    }
  }

  /**
   * Handle context menu for delete options
   */
  handleContextMenu(event) {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const stepIndex = this.getStepAtPosition(x, y);
    if (stepIndex !== -1) {
      this.showContextMenu(event.clientX, event.clientY, stepIndex);
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    if (this.selectedStep !== null) {
      switch (event.key) {
      case 'Delete':
      case 'Backspace':
        this.onStepDelete(this.selectedStep, this.sequence[this.selectedStep]);
        event.preventDefault();
        break;
      case 'Enter':
        this.onStepEdit(this.selectedStep, this.sequence[this.selectedStep]);
        event.preventDefault();
        break;
      case 'ArrowLeft':
        this.selectStep(Math.max(0, this.selectedStep - 1));
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.selectStep(Math.min(this.sequence.length - 1, this.selectedStep + 1));
        event.preventDefault();
        break;
      }
    }
  }

  /**
   * Get step at position
   */
  getStepAtPosition(x, y) {
    for (let i = 0; i < this.sequence.length; i++) {
      const rect = this.getStepRect(i);
      if (x >= rect.x && x <= rect.x + rect.width &&
          y >= rect.y && y <= rect.y + rect.height) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get step insert position for drag and drop
   */
  getStepInsertPosition(x) {
    const stepWidth = this.options.stepMinWidth * this.options.zoomLevel;
    const stepSpacing = this.options.stepSpacing * this.options.zoomLevel;

    const adjustedX = x + this.options.scrollOffset;
    const index = Math.floor(adjustedX / (stepWidth + stepSpacing));

    return Math.max(0, Math.min(this.sequence.length, index));
  }

  /**
   * Get rectangle for step at index
   */
  getStepRect(index) {
    const stepWidth = this.options.stepMinWidth * this.options.zoomLevel;
    const stepSpacing = this.options.stepSpacing * this.options.zoomLevel;
    const x = (index * (stepWidth + stepSpacing)) - this.options.scrollOffset;
    const y = this.options.headerHeight;

    return {
      x,
      y,
      width: stepWidth,
      height: this.options.stepHeight * this.options.zoomLevel
    };
  }

  /**
   * Select step by index
   */
  selectStep(index) {
    if (index >= 0 && index < this.sequence.length) {
      this.selectedStep = index;
      this.onStepSelect(index, this.sequence[index]);
      this.redraw();
    }
  }

  /**
   * Show context menu
   */
  showContextMenu(x, y, stepIndex) {
    const menu = document.createElement('div');
    menu.className = 'timeline-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${x  }px`;
    menu.style.top = `${y  }px`;
    menu.innerHTML = `
      <div class="context-menu-item" data-action="edit">Edit Step</div>
      <div class="context-menu-item" data-action="duplicate">Duplicate Step</div>
      <div class="context-menu-item" data-action="delete">Delete Step</div>
    `;

    document.body.appendChild(menu);

    menu.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      const step = this.sequence[stepIndex];

      switch (action) {
      case 'edit':
        this.onStepEdit(stepIndex, step);
        break;
      case 'duplicate':
        this.addStep({ ...step }, stepIndex + 1);
        break;
      case 'delete':
        this.onStepDelete(stepIndex, step);
        break;
      }

      document.body.removeChild(menu);
    });

    // Remove menu on click outside
    setTimeout(() => {
      const handleClickOutside = (event) => {
        if (!menu.contains(event.target)) {
          document.removeEventListener('click', handleClickOutside);
          if (menu.parentNode) {
            document.body.removeChild(menu);
          }
        }
      };
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }

  /**
   * Redraw the timeline
   */
  redraw() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    this.drawGrid();

    // Draw steps
    this.sequence.forEach((step, index) => {
      this.drawStep(step, index);
    });

    // Draw timing indicators
    if (this.options.showTimings) {
      this.drawTimingIndicators();
    }

    this.updateScrollbar();
  }

  /**
   * Draw background grid
   */
  drawGrid() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const stepWidth = this.options.stepMinWidth * this.options.zoomLevel;
    const stepSpacing = this.options.stepSpacing * this.options.zoomLevel;

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = 0; i <= this.sequence.length; i++) {
      const x = (i * (stepWidth + stepSpacing)) - this.options.scrollOffset;
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, this.options.headerHeight);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw individual step
   */
  drawStep(step, index) {
    const rect = this.getStepRect(index);

    // Skip if step is not visible
    if (rect.x + rect.width < 0 || rect.x > this.canvas.clientWidth) {
      return;
    }

    const ctx = this.ctx;
    const isSelected = this.selectedStep === index;
    const isDragged = this.draggedStep === index;

    // Step background
    const color = this.getStepColor(step.type);
    ctx.fillStyle = isSelected ? this.lightenColor(color, 0.2) : color;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Step border
    ctx.strokeStyle = isSelected ? '#007acc' : isDragged ? '#ff6b6b' : '#ccc';
    ctx.lineWidth = isSelected || isDragged ? 2 : 1;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Step content
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const padding = 8;
    const textY = rect.y + rect.height / 2;

    // Step number
    ctx.fillText(`${index + 1}.`, rect.x + padding, textY - 8);

    // Step type
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.fillText(step.type.toUpperCase(), rect.x + padding, textY + 8);

    // Step action (truncated if needed)
    ctx.fillStyle = '#333';
    const actionText = this.truncateText(step.action || '', rect.width - padding * 2 - 30, ctx);
    ctx.fillText(actionText, rect.x + padding + 30, textY - 8);

    // Delay indicator
    if (step.delay && step.delay > 0) {
      ctx.fillStyle = '#ff9800';
      ctx.font = '9px Arial';
      ctx.fillText(`${step.delay}ms`, rect.x + rect.width - padding - 40, textY + 8);
    }
  }

  /**
   * Draw timing indicators between steps
   */
  drawTimingIndicators() {
    const ctx = this.ctx;

    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    for (let i = 0; i < this.sequence.length - 1; i++) {
      const currentRect = this.getStepRect(i);
      const nextRect = this.getStepRect(i + 1);
      const delay = this.sequence[i].delay || 0;

      if (delay > 0) {
        const x1 = currentRect.x + currentRect.width;
        const x2 = nextRect.x;
        const y = currentRect.y + currentRect.height / 2;

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        // Delay text
        ctx.fillStyle = '#ff9800';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${delay}ms`, (x1 + x2) / 2, y - 5);
      }
    }

    ctx.setLineDash([]);
  }

  /**
   * Get color for step type
   */
  getStepColor(type) {
    const colors = {
      keypress: '#4caf50',
      command: '#2196f3',
      application: '#ff9800',
      delay: '#9c27b0',
      macro_sequence: '#607d8b'
    };
    return colors[type] || '#757575';
  }

  /**
   * Lighten color by percentage
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return `#${  (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1)}`;
  }

  /**
   * Truncate text to fit width
   */
  truncateText(text, maxWidth, ctx) {
    const ellipsis = '...';
    let width = ctx.measureText(text).width;

    if (width <= maxWidth) {
      return text;
    }

    while (width >= maxWidth && text.length > 0) {
      text = text.substring(0, text.length - 1);
      width = ctx.measureText(text + ellipsis).width;
    }

    return text + ellipsis;
  }

  /**
   * Update scroll bounds
   */
  updateScrollBounds() {
    const stepWidth = this.options.stepMinWidth * this.options.zoomLevel;
    const stepSpacing = this.options.stepSpacing * this.options.zoomLevel;
    const totalWidth = this.sequence.length * (stepWidth + stepSpacing);
    const canvasWidth = this.canvas.clientWidth;

    this.options.maxScrollOffset = Math.max(0, totalWidth - canvasWidth);
    this.options.scrollOffset = Math.min(this.options.scrollOffset, this.options.maxScrollOffset);
  }

  /**
   * Update scrollbar
   */
  updateScrollbar() {
    if (this.options.maxScrollOffset > 0) {
      const scrollPercentage = this.options.scrollOffset / this.options.maxScrollOffset;
      const thumbWidth = Math.max(20, (this.canvas.clientWidth / (this.canvas.clientWidth + this.options.maxScrollOffset)) * this.canvas.clientWidth);
      const thumbPosition = scrollPercentage * (this.canvas.clientWidth - thumbWidth);

      this.scrollbarThumb.style.width = `${thumbWidth  }px`;
      this.scrollbarThumb.style.left = `${thumbPosition  }px`;
      this.scrollbarThumb.style.display = 'block';
    } else {
      this.scrollbarThumb.style.display = 'none';
    }
  }

  /**
   * Update info display
   */
  updateInfo() {
    const stepCountEl = this.container.querySelector('.step-count');
    const totalDurationEl = this.container.querySelector('.total-duration');

    stepCountEl.textContent = `${this.sequence.length} steps`;

    const totalDuration = this.sequence.reduce((sum, step) => sum + (step.delay || 0), 0);
    totalDurationEl.textContent = `${totalDuration}ms`;

    const zoomLevelEl = this.container.querySelector('.zoom-level');
    zoomLevelEl.textContent = `${Math.round(this.options.zoomLevel * 100)}%`;
  }

  /**
   * Zoom controls
   */
  zoomIn() {
    this.setZoom(this.options.zoomLevel * 1.2);
  }

  zoomOut() {
    this.setZoom(this.options.zoomLevel * 0.8);
  }

  zoomToFit() {
    if (this.sequence.length === 0) {
      return;
    }

    const canvasWidth = this.canvas.clientWidth;
    const stepWidth = this.options.stepMinWidth;
    const stepSpacing = this.options.stepSpacing;
    const totalStepsWidth = this.sequence.length * (stepWidth + stepSpacing);

    const fitZoom = canvasWidth / totalStepsWidth;
    this.setZoom(Math.min(2, Math.max(0.1, fitZoom)));
  }

  setZoom(zoomLevel) {
    this.options.zoomLevel = Math.min(3, Math.max(0.1, zoomLevel));
    this.updateScrollBounds();
    this.updateInfo();
    this.redraw();
  }

  setScrollOffset(offset) {
    this.options.scrollOffset = Math.min(this.options.maxScrollOffset, Math.max(0, offset));
    this.redraw();
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    // Remove all event listeners
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

    window.removeEventListener('resize', this.resizeCanvas);
    document.removeEventListener('keydown', this.handleKeyDown);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SequenceTimeline;
}

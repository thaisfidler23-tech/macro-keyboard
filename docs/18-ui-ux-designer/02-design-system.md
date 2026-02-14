# Design System Specification

**Version**: 1.0  
**Date**: December 21, 2025  
**Purpose**: Establish consistent visual design language for Macro Keyboard application  
**Target Platforms**: Desktop (Windows, macOS, Linux), with mobile-responsive support

## 🎨 Color System

### Primary Color Palette

```css
:root {
  /* Primary Brand Colors */
  --color-primary-50:  #EBF4FF;   /* Lightest blue - backgrounds */
  --color-primary-100: #D1E9FF;   /* Very light blue - hover states */
  --color-primary-200: #A6D5FF;   /* Light blue - disabled states */
  --color-primary-300: #7CC0FF;   /* Medium light blue - secondary elements */
  --color-primary-400: #52AAFF;   /* Medium blue - interactive elements */
  --color-primary-500: #007AFF;   /* Primary blue - main actions, links */
  --color-primary-600: #0051D5;   /* Dark blue - hover states */
  --color-primary-700: #003DB3;   /* Darker blue - active states */
  --color-primary-800: #002E91;   /* Very dark blue - pressed states */
  --color-primary-900: #001F6F;   /* Darkest blue - high contrast */
}
```

### Semantic Colors

```css
:root {
  /* Success Colors */
  --color-success-50:  #E8F8F0;
  --color-success-100: #D1F2E1;
  --color-success-500: #30D158;   /* Main success color */
  --color-success-600: #28A745;   /* Darker success */
  --color-success-900: #0F5132;   /* Dark success text */
  
  /* Warning Colors */
  --color-warning-50:  #FFF4E5;
  --color-warning-100: #FFE8CC;
  --color-warning-500: #FF9F0A;   /* Main warning color */
  --color-warning-600: #F08A00;   /* Darker warning */
  --color-warning-900: #8B4000;   /* Dark warning text */
  
  /* Error Colors */
  --color-error-50:    #FFE5E5;
  --color-error-100:   #FFCCCC;
  --color-error-500:   #FF3B30;   /* Main error color */
  --color-error-600:   #DC2626;   /* Darker error */
  --color-error-900:   #7F1D1D;   /* Dark error text */
  
  /* Info Colors */
  --color-info-50:     #E5F6FF;
  --color-info-100:    #CCEDFF;
  --color-info-500:    #64D2FF;   /* Main info color */
  --color-info-600:    #0EA5E9;   /* Darker info */
  --color-info-900:    #0C4A6E;   /* Dark info text */
}
```

### Neutral Colors

```css
:root {
  /* Neutral Gray Scale */
  --color-gray-0:      #FFFFFF;   /* Pure white */
  --color-gray-25:     #FAFAFA;   /* Lightest gray - page backgrounds */
  --color-gray-50:     #F4F4F5;   /* Very light gray - card backgrounds */
  --color-gray-100:    #E4E4E7;   /* Light gray - borders */
  --color-gray-200:    #D4D4D8;   /* Medium light gray - dividers */
  --color-gray-300:    #A1A1AA;   /* Medium gray - placeholders */
  --color-gray-400:    #71717A;   /* Dark medium gray - secondary text */
  --color-gray-500:    #52525B;   /* Dark gray - primary secondary text */
  --color-gray-600:    #3F3F46;   /* Very dark gray - headings */
  --color-gray-700:    #27272A;   /* Near black - primary text */
  --color-gray-800:    #18181B;   /* Very dark - high contrast text */
  --color-gray-900:    #09090B;   /* Pure black */
}
```

### Color Usage Guidelines

#### Text Colors
- **Primary Text**: `--color-gray-800` (High contrast, main content)
- **Secondary Text**: `--color-gray-500` (Supporting information)
- **Muted Text**: `--color-gray-400` (Captions, timestamps)
- **Placeholder Text**: `--color-gray-300` (Form placeholders)

#### Background Colors
- **Page Background**: `--color-gray-25` (Main application background)
- **Card Background**: `--color-gray-0` (Content containers)
- **Section Background**: `--color-gray-50` (Section dividers)
- **Hover Background**: `--color-primary-50` (Interactive element hover)

#### Border Colors
- **Default Border**: `--color-gray-200` (Standard borders)
- **Focus Border**: `--color-primary-500` (Focus states)
- **Error Border**: `--color-error-500` (Error states)

## ✍️ Typography System

### Font Family Stack

```css
:root {
  --font-family-sans: 
    -apple-system, 
    BlinkMacSystemFont, 
    "Segoe UI", 
    Roboto, 
    "Helvetica Neue", 
    Arial, 
    sans-serif;
  
  --font-family-mono: 
    "SF Mono", 
    Monaco, 
    "Consolas", 
    "Liberation Mono", 
    "Courier New", 
    monospace;
}
```

### Typography Scale

```css
:root {
  /* Font Sizes */
  --font-size-xs:      12px;  /* 0.75rem */
  --font-size-sm:      14px;  /* 0.875rem */
  --font-size-base:    16px;  /* 1rem */
  --font-size-lg:      18px;  /* 1.125rem */
  --font-size-xl:      20px;  /* 1.25rem */
  --font-size-2xl:     24px;  /* 1.5rem */
  --font-size-3xl:     30px;  /* 1.875rem */
  --font-size-4xl:     36px;  /* 2.25rem */
  --font-size-5xl:     48px;  /* 3rem */
  
  /* Line Heights */
  --line-height-none:  1;
  --line-height-tight: 1.25;
  --line-height-snug:  1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
  --line-height-loose: 2;
  
  /* Font Weights */
  --font-weight-thin:     100;
  --font-weight-light:    300;
  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;
  --font-weight-extrabold: 800;
  --font-weight-black:    900;
}
```

### Typography Classes

```css
/* Display Typography */
.text-display {
  font-size: var(--font-size-5xl);
  line-height: var(--line-height-tight);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  color: var(--color-gray-800);
}

/* Heading Typography */
.text-h1 {
  font-size: var(--font-size-4xl);
  line-height: var(--line-height-tight);
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-800);
}

.text-h2 {
  font-size: var(--font-size-2xl);
  line-height: var(--line-height-snug);
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-700);
}

.text-h3 {
  font-size: var(--font-size-xl);
  line-height: var(--line-height-normal);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

/* Body Typography */
.text-body {
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  font-weight: var(--font-weight-normal);
  color: var(--color-gray-600);
}

.text-body-sm {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  font-weight: var(--font-weight-normal);
  color: var(--color-gray-500);
}

.text-caption {
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-400);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Code Typography */
.text-code {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-gray-700);
  background-color: var(--color-gray-100);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
```

## 📏 Spacing System

### Spacing Scale

```css
:root {
  --spacing-0:    0px;     /* 0 */
  --spacing-1:    4px;     /* 0.25rem */
  --spacing-2:    8px;     /* 0.5rem */
  --spacing-3:    12px;    /* 0.75rem */
  --spacing-4:    16px;    /* 1rem */
  --spacing-5:    20px;    /* 1.25rem */
  --spacing-6:    24px;    /* 1.5rem */
  --spacing-8:    32px;    /* 2rem */
  --spacing-10:   40px;    /* 2.5rem */
  --spacing-12:   48px;    /* 3rem */
  --spacing-16:   64px;    /* 4rem */
  --spacing-20:   80px;    /* 5rem */
  --spacing-24:   96px;    /* 6rem */
}
```

### Layout Grid System

```css
:root {
  /* Container Widths */
  --container-sm:   640px;
  --container-md:   768px;
  --container-lg:   1024px;
  --container-xl:   1280px;
  --container-2xl:  1536px;
  
  /* Grid System */
  --grid-columns:   12;
  --grid-gap:       var(--spacing-6);
  --grid-margin:    var(--spacing-6);
}

.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--grid-margin);
  padding-right: var(--grid-margin);
}

@media (min-width: 640px) {
  .container { max-width: var(--container-sm); }
}
@media (min-width: 768px) {
  .container { max-width: var(--container-md); }
}
@media (min-width: 1024px) {
  .container { max-width: var(--container-lg); }
}
@media (min-width: 1280px) {
  .container { max-width: var(--container-xl); }
}
```

## 🔘 Component System

### Button Components

```css
/* Base Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
}

.btn:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary Button */
.btn-primary {
  background-color: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-500);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-700);
  border-color: var(--color-primary-700);
}

/* Secondary Button */
.btn-secondary {
  background-color: transparent;
  color: var(--color-primary-600);
  border-color: var(--color-primary-200);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-primary-50);
  border-color: var(--color-primary-300);
}

/* Danger Button */
.btn-danger {
  background-color: var(--color-error-500);
  color: white;
  border-color: var(--color-error-500);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-600);
  border-color: var(--color-error-600);
}

/* Button Sizes */
.btn-sm {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
}

.btn-lg {
  padding: var(--spacing-4) var(--spacing-6);
  font-size: var(--font-size-base);
}
```

### Form Components

```css
/* Form Groups */
.form-group {
  margin-bottom: var(--spacing-4);
}

/* Labels */
.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
  margin-bottom: var(--spacing-1);
}

.form-label.required::after {
  content: " *";
  color: var(--color-error-500);
}

/* Input Fields */
.form-input {
  width: 100%;
  padding: var(--spacing-3);
  font-size: var(--font-size-base);
  line-height: var(--line-height-tight);
  color: var(--color-gray-700);
  background-color: var(--color-gray-0);
  border: 1px solid var(--color-gray-300);
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.form-input:disabled {
  background-color: var(--color-gray-50);
  color: var(--color-gray-400);
  cursor: not-allowed;
}

.form-input.error {
  border-color: var(--color-error-500);
}

.form-input.error:focus {
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.1);
}

/* Help Text */
.form-help {
  font-size: var(--font-size-xs);
  color: var(--color-gray-400);
  margin-top: var(--spacing-1);
}

/* Error Messages */
.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-error-600);
  margin-top: var(--spacing-1);
}
```

### Status Components

```css
/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge-success {
  background-color: var(--color-success-100);
  color: var(--color-success-700);
}

.status-badge-warning {
  background-color: var(--color-warning-100);
  color: var(--color-warning-700);
}

.status-badge-error {
  background-color: var(--color-error-100);
  color: var(--color-error-700);
}

.status-badge-info {
  background-color: var(--color-info-100);
  color: var(--color-info-700);
}

/* Status Indicators */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: var(--spacing-2);
}

.status-indicator-success {
  background-color: var(--color-success-500);
}

.status-indicator-warning {
  background-color: var(--color-warning-500);
}

.status-indicator-error {
  background-color: var(--color-error-500);
}

.status-indicator-info {
  background-color: var(--color-info-500);
}
```

## 📱 Responsive Breakpoints

```css
:root {
  /* Breakpoint System */
  --breakpoint-xs: 0px;      /* Extra small devices */
  --breakpoint-sm: 480px;    /* Small devices */
  --breakpoint-md: 768px;    /* Medium devices */
  --breakpoint-lg: 1024px;   /* Large devices */
  --breakpoint-xl: 1280px;   /* Extra large devices */
  --breakpoint-2xl: 1536px;  /* 2X large devices */
}

/* Mobile First Media Queries */
@media (min-width: 480px) {
  /* Small devices and up */
}

@media (min-width: 768px) {
  /* Tablet and up */
}

@media (min-width: 1024px) {
  /* Desktop and up */
}

@media (min-width: 1280px) {
  /* Large desktop and up */
}
```

## ♿ Accessibility Features

### Focus Management

```css
/* Focus Styles */
.focus-outline {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 0.25rem;
}

/* Skip Links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--color-primary-500);
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 0.25rem;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

### Screen Reader Utilities

```css
/* Screen Reader Only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

## 🎭 Animation Guidelines

```css
:root {
  /* Animation Timing */
  --duration-fast: 0.15s;
  --duration-normal: 0.25s;
  --duration-slow: 0.35s;
  
  /* Easing Functions */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}

/* Respect Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This design system provides the foundation for creating a consistent, accessible, and visually appealing interface for the Macro Keyboard application.
# End-to-End Tests Directory

This directory contains comprehensive end-to-end tests that validate complete user workflows and business processes from a user's perspective.

## Test Organization

- `critical-paths/` - Critical business workflows that must always work
- `user-journeys/` - Complete user experience flows
- `cross-platform/` - Platform-specific testing scenarios  
- `regression/` - Regression test suites for continuous validation
- `performance/` - End-to-end performance validation
- `accessibility/` - Accessibility and keyboard navigation testing

## Test Infrastructure

- `e2e-test-framework.js` - Core E2E testing framework and utilities
- `page-objects/` - Page Object Model implementations
- `test-data/` - Test data factories and fixtures
- `helpers/` - Shared test utilities and helpers
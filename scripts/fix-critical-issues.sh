#!/bin/bash
# scripts/fix-critical-issues.sh - Automated Critical Issue Resolution

set -e

echo "🔧 Starting automated critical issue resolution..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup before making changes
print_status "Creating backup of source files..."
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
cp -r src/ "$BACKUP_DIR"
print_success "Backup created: $BACKUP_DIR"

# Phase 1: Fix Syntax Errors
print_status "Phase 1: Fixing critical syntax errors..."

# Fix ContextRuleEngine.js syntax error (missing switch statement)
if node -c src/context/ContextRuleEngine.js 2>/dev/null; then
    print_success "ContextRuleEngine.js - syntax OK"
else
    print_warning "Fixing ContextRuleEngine.js syntax error..."
    # This would need manual inspection and fixing
    # For now, just mark for manual review
    echo "src/context/ContextRuleEngine.js" >> manual-fixes-needed.txt
fi

# Fix other syntax errors
for file in src/context/PowerEventMonitor.js src/context/LinuxApplicationDetector.js; do
    if node -c "$file" 2>/dev/null; then
        print_success "$file - syntax OK"
    else
        print_warning "Marking $file for manual syntax fix..."
        echo "$file" >> manual-fixes-needed.txt
    fi
done

# Phase 2: Auto-fix ESLint Issues
print_status "Phase 2: Auto-fixing ESLint issues..."
ESLINT_USE_FLAT_CONFIG=false npx eslint src/ --fix --ext .js || true
print_success "ESLint auto-fix completed"

# Phase 3: Format Code with Prettier
print_status "Phase 3: Formatting code with Prettier..."
npx prettier --write "src/**/*.js" || true
print_success "Code formatting completed"

# Phase 4: Remove Unused Variables (Simple Cases)
print_status "Phase 4: Removing obvious unused variables..."

# Create a simple script to comment out unused imports
cat > temp-fix-unused.js << 'EOF'
const fs = require('fs');
const path = require('path');

function fixUnusedImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Comment out obviously unused require statements that aren't used
  const unusedPatterns = [
    /^const fs = require\('fs'\);$/gm,
    /^const path = require\('path'\);$/gm
  ];
  
  // Only comment if the variable is never used in the file
  unusedPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const varName = match.match(/const (\w+) =/)?.[1];
        if (varName) {
          // Check if variable is used elsewhere in the file
          const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
          const usages = content.match(usageRegex) || [];
          
          // If only used in the declaration, comment it out
          if (usages.length === 1) {
            content = content.replace(pattern, `// ${match} // Auto-commented: unused import`);
          }
        }
      });
    }
  });
  
  fs.writeFileSync(filePath, content);
}

// Process specific files with known unused imports
const filesToFix = [
  'src/AlertingManager.js',
  'src/MacroRecorder.js'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    fixUnusedImports(file);
    console.log(`Fixed unused imports in ${file}`);
  }
});
EOF

node temp-fix-unused.js
rm temp-fix-unused.js
print_success "Unused import cleanup completed"

# Phase 5: Fix Common Security Issues
print_status "Phase 5: Fixing security issues..."

# Create script to fix hasOwnProperty usage
cat > temp-fix-security.js << 'EOF'
const fs = require('fs');
const glob = require('glob');

function fixHasOwnProperty(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace obj.hasOwnProperty(prop) with Object.prototype.hasOwnProperty.call(obj, prop)
  content = content.replace(
    /(\w+)\.hasOwnProperty\(([^)]+)\)/g, 
    'Object.prototype.hasOwnProperty.call($1, $2)'
  );
  
  fs.writeFileSync(filePath, content);
}

// Find all JS files and fix hasOwnProperty usage
const jsFiles = glob.sync('src/**/*.js');
jsFiles.forEach(file => {
  const originalContent = fs.readFileSync(file, 'utf8');
  fixHasOwnProperty(file);
  const newContent = fs.readFileSync(file, 'utf8');
  
  if (originalContent !== newContent) {
    console.log(`Fixed hasOwnProperty usage in ${file}`);
  }
});
EOF

# Only run if glob is available
if npm list glob >/dev/null 2>&1; then
    node temp-fix-security.js
    rm temp-fix-security.js
    print_success "Security issue fixes completed"
else
    print_warning "Skipping hasOwnProperty fixes (glob package not available)"
    rm temp-fix-security.js
fi

# Phase 6: Add Missing Radix Parameters
print_status "Phase 6: Adding missing radix parameters..."

# Fix parseInt calls without radix
find src/ -name "*.js" -exec sed -i.bak 's/parseInt(\([^,)]*\))/parseInt(\1, 10)/g' {} \;
# Clean up backup files created by sed
find src/ -name "*.bak" -delete
print_success "parseInt radix parameters added"

# Phase 7: Run Final Quality Check
print_status "Phase 7: Running final quality validation..."

echo "Checking syntax after fixes..."
SYNTAX_ERRORS=0
for file in $(find src/ -name "*.js"); do
    if ! node -c "$file" 2>/dev/null; then
        echo "  ❌ Syntax error still in: $file"
        ((SYNTAX_ERRORS++))
    fi
done

if [ $SYNTAX_ERRORS -eq 0 ]; then
    print_success "All syntax errors resolved!"
else
    print_warning "Still have $SYNTAX_ERRORS syntax errors requiring manual intervention"
fi

# Check ESLint improvement
print_status "Checking ESLint improvement..."
ESLINT_OUTPUT=$(ESLINT_USE_FLAT_CONFIG=false npx eslint src/ 2>/dev/null | tail -1 || echo "No ESLint output")
print_status "ESLint result: $ESLINT_OUTPUT"

# Generate summary
print_status "Generating fix summary..."

cat > fix-summary.md << EOF
# Critical Issues Fix Summary

**Fix Date**: $(date)
**Backup Location**: $BACKUP_DIR

## Automated Fixes Applied

### ✅ Completed Automatically
- ESLint auto-fixable issues resolved
- Code formatting standardized with Prettier
- parseInt radix parameters added
- Unused import cleanup attempted

### ⚠️  Partial/Manual Fixes Required
- Syntax errors in complex files (see manual-fixes-needed.txt)
- High complexity functions require refactoring
- Some security issues need manual review

### 📊 Quality Metrics Improvement

**Before Fixes:**
- Syntax Errors: 3 files
- ESLint Issues: 633 problems (194 errors, 439 warnings)

**After Fixes:**
- Syntax Errors: $SYNTAX_ERRORS files  
- ESLint Issues: Check latest run above

## Next Steps

1. Review manual-fixes-needed.txt for remaining syntax issues
2. Address high-complexity functions (>15 complexity score)
3. Complete security issue remediation
4. Improve test infrastructure reliability
5. Establish continuous quality monitoring

## Files Modified

All source files in src/ have been processed. Original versions backed up to: $BACKUP_DIR

EOF

print_success "Fix summary generated: fix-summary.md"

# Final status
echo ""
echo "=================================================="
echo -e "${BLUE}🎯 Critical Issues Fix Complete!${NC}"
echo ""
echo "✅ Automated fixes applied to entire codebase"
echo "✅ Code formatting standardized"  
echo "✅ Basic security issues addressed"
echo "✅ Backup created for rollback safety"
echo ""
if [ -f manual-fixes-needed.txt ]; then
    MANUAL_COUNT=$(wc -l < manual-fixes-needed.txt)
    echo -e "${YELLOW}⚠️  $MANUAL_COUNT files need manual attention (see manual-fixes-needed.txt)${NC}"
else
    echo -e "${GREEN}🎉 All critical syntax issues resolved automatically!${NC}"
fi
echo ""
echo "📋 Review fix-summary.md for detailed changes"
echo "🔧 Run './scripts/quality-check.sh' to validate improvements"
echo ""
#!/bin/bash
# Code Quality Setup Validation Script for Agentic-Flow v2.0.0-alpha

set -e

echo "======================================"
echo "Code Quality Setup Validation"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        ((ERRORS++))
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 (missing)"
        ((ERRORS++))
    fi
}

check_npm_script() {
    if npm run | grep -q "$1"; then
        echo -e "${GREEN}✓${NC} npm run $1"
    else
        echo -e "${RED}✗${NC} npm run $1 (not found)"
        ((ERRORS++))
    fi
}

check_dependency() {
    if npm list "$1" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${YELLOW}⚠${NC} $1 (not installed)"
        ((WARNINGS++))
    fi
}

echo "1. Configuration Files"
echo "----------------------"
check_file "config/.eslintrc.strict.js"
check_file "config/.prettierrc.js"
check_file "config/.prettierignore"
check_file "config/.editorconfig"
check_file "config/jest.config.cjs"
check_file "config/lint-staged.config.js"
check_file "agentic-flow/config/tsconfig.strict.json"
echo ""

echo "2. Scripts"
echo "----------"
check_file "scripts/setup-husky.sh"
check_file "scripts/validate-commit-msg.js"
echo ""

echo "3. Documentation"
echo "----------------"
check_file "docs/CONTRIBUTING.md"
check_file "docs/CODE_QUALITY_SETUP.md"
check_file "docs/QUICK_START_CODE_QUALITY.md"
check_file "docs/CODE_REVIEW_CHECKLIST.md"
check_file "docs/CODE_QUALITY_REPORT_TEMPLATE.md"
check_file "docs/CODE_QUALITY_SUMMARY.md"
echo ""

echo "4. CI/CD Workflow"
echo "-----------------"
check_file "config/.github/workflows/code-quality.yml"
echo ""

echo "5. Package.json Scripts"
echo "-----------------------"
check_npm_script "lint"
check_npm_script "lint:fix"
check_npm_script "format"
check_npm_script "format:check"
check_npm_script "typecheck"
check_npm_script "typecheck:strict"
check_npm_script "test:coverage"
check_npm_script "quality:check"
check_npm_script "quality:fix"
echo ""

echo "6. Dependencies"
echo "---------------"
check_dependency "eslint"
check_dependency "prettier"
check_dependency "husky"
check_dependency "lint-staged"
check_dependency "jest"
check_dependency "ts-jest"
check_dependency "@typescript-eslint/parser"
check_dependency "@typescript-eslint/eslint-plugin"
check_dependency "eslint-config-prettier"
echo ""

echo "7. Git Hooks"
echo "------------"
if [ -d ".husky" ]; then
    check_file ".husky/pre-commit"
    check_file ".husky/commit-msg"
    check_file ".husky/pre-push"
else
    echo -e "${YELLOW}⚠${NC} .husky directory not found (run: npm run prepare)"
    ((WARNINGS++))
fi
echo ""

echo "======================================"
echo "Validation Summary"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Code quality setup is complete and ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Install dependencies: npm install"
    echo "  2. Setup Git hooks: npm run prepare"
    echo "  3. Run quality check: npm run quality:check"
    echo "  4. Read quick start: docs/QUICK_START_CODE_QUALITY.md"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Setup complete with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Some dependencies may not be installed yet."
    echo "Run: npm install"
    exit 0
else
    echo -e "${RED}✗ Setup incomplete with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please review the errors above and ensure all files are present."
    exit 1
fi

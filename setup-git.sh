#!/bin/bash

# WiFiSense Lab - Git Repository Setup Script
# This script initializes and configures the Git repository with 'main' as the default branch

set -e  # Exit on error

echo "🚀 WiFiSense Lab - Git Repository Setup"
echo "========================================"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

echo "✅ Git is installed: $(git --version)"
echo ""

# Check if we're in a Git repository
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

echo ""

# Configure default branch name to 'main'
echo "🔧 Setting default branch to 'main'..."
git config init.defaultBranch main
echo "✅ Default branch configured as 'main'"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
echo "📍 Current branch: $CURRENT_BRANCH"

# If no commits yet or on wrong branch, we need to handle it
if [ "$CURRENT_BRANCH" = "none" ] || [ -z "$(git log --oneline 2>/dev/null)" ]; then
    echo ""
    echo "📝 Creating initial commit..."
    
    # Add all files
    echo "📂 Adding files to staging..."
    git add .
    
    # Create initial commit
    echo "💾 Creating initial commit..."
    git commit -m "Initial commit: WiFiSense Lab v1.1.0

Complete Wi-Fi CSI sensing platform with:
- 15 fully implemented phases
- Mobile responsive design
- Deterministic simulation engine
- Real-time signal visualization
- Machine learning integration
- Hardware adapter interfaces
- Comprehensive documentation

Version: 1.1.0
Status: Production Ready"
    
    echo "✅ Initial commit created"
else
    echo ""
    echo "📝 Repository already has commits"
    
    # Check if we're on main branch
    if [ "$CURRENT_BRANCH" != "main" ]; then
        echo "⚠️  Current branch is '$CURRENT_BRANCH', not 'main'"
        echo ""
        read -p "Do you want to rename current branch to 'main'? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git branch -m main
            echo "✅ Branch renamed to 'main'"
        fi
    else
        echo "✅ Already on 'main' branch"
    fi
fi

echo ""
echo "🔍 Checking repository status..."
git status --short
echo ""

# Check if remote is configured
if git remote | grep -q "origin"; then
    echo "✅ Remote 'origin' is configured"
    git remote -v
    echo ""
    
    # Set HEAD to main
    echo "🎯 Setting remote HEAD to 'main'..."
    git remote set-head origin main 2>/dev/null || echo "⚠️  Could not set remote HEAD (might not be pushed yet)"
    echo ""
else
    echo "ℹ️  No remote 'origin' configured yet"
    echo ""
    echo "To add a remote repository, run:"
    echo "  git remote add origin <your-repo-url>"
    echo ""
    echo "Examples:"
    echo "  git remote add origin https://github.com/username/wifisense-lab.git"
    echo "  git remote add origin git@github.com:username/wifisense-lab.git"
    echo ""
fi

# Show branch information
echo "📊 Branch Information:"
echo "----------------------"
git branch -a
echo ""

# Show configuration
echo "⚙️  Git Configuration:"
echo "----------------------"
echo "Default branch: $(git config init.defaultBranch)"
echo "User name: $(git config user.name || echo 'Not set')"
echo "User email: $(git config user.email || echo 'Not set')"
echo ""

# Final instructions
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo ""

if ! git remote | grep -q "origin"; then
    echo "1. Add a remote repository:"
    echo "   git remote add origin <your-repo-url>"
    echo ""
    echo "2. Push to remote:"
    echo "   git push -u origin main"
    echo ""
else
    echo "1. Push to remote:"
    echo "   git push -u origin main"
    echo ""
fi

echo "2. Verify everything is working:"
echo "   git status"
echo "   git log --oneline"
echo ""

echo "3. Set up your Git identity (if not already done):"
echo "   git config --global user.name \"Your Name\""
echo "   git config --global user.email \"your.email@example.com\""
echo ""

echo "📚 Documentation available:"
echo "   - README.md (Project overview)"
echo "   - CHANGELOG.md (Version history)"
echo "   - CONTRIBUTING.md (Development guide)"
echo "   - GIT_SETUP.md (Git commands reference)"
echo "   - GIT_REMOTE_REFERENCE.md (Remote operations)"
echo ""

echo "✨ WiFiSense Lab is ready to go!"

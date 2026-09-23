# Git Setup Guide for WiFiSense Lab

## Quick Start

If you want to initialize Git and push this project to a remote repository, follow these steps:

### 1. Initialize Git Repository

```bash
# Navigate to the project directory
cd wifisense-lab

# Initialize Git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: WiFiSense Lab v1.1.0 - Mobile responsive"
```

### 2. Create Remote Repository

#### GitHub
1. Go to https://github.com/new
2. Repository name: `wifisense-lab`
3. Description: "Professional Wi-Fi CSI sensing platform for human presence detection, activity recognition, and signal analysis"
4. Make it Public or Private (your choice)
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

#### GitLab
1. Go to https://gitlab.com/projects/new
2. Project name: `wifisense-lab`
3. Visibility: Private or Public
4. Click "Create project"

#### Bitbucket
1. Go to https://bitbucket.org/repo/create
2. Repository name: `wifisense-lab`
3. Access level: Private or Public
4. Click "Create repository"

### 3. Connect Local to Remote

```bash
# Add remote origin (replace with your actual URL)
git remote add origin https://github.com/YOUR_USERNAME/wifisense-lab.git

# Or for SSH
git remote add origin git@github.com:YOUR_USERNAME/wifisense-lab.git

# Verify remote
git remote -v
```

### 4. Push to Remote

```bash
# Push main branch
git branch -M main
git push -u origin main

# Or for master branch
git branch -M master
git push -u origin master
```

### 5. Fetch and Pull (What You Asked About)

```bash
# Fetch all changes from remote
git fetch origin

# See what branches exist
git branch -a

# Pull latest changes
git pull origin main

# Or for specific branch
git pull origin master
```

## Common Git Commands

### Daily Workflow

```bash
# Check status
git status

# View changes
git diff

# Add specific files
git add README.md
git add src/

# Add all changes
git add .

# Commit with message
git commit -m "Add feature: mobile responsive design"

# Push to remote
git push origin main
```

### Branch Management

```bash
# Create new branch
git checkout -b feature/mobile-improvements

# Switch branches
git checkout main
git checkout feature/mobile-improvements

# Merge branch
git checkout main
git merge feature/mobile-improvements

# Delete branch
git branch -d feature/mobile-improvements
```

### Syncing with Remote

```bash
# Fetch changes (doesn't merge)
git fetch origin

# See what's changed
git log origin/main..main

# Pull and merge
git pull origin main

# Pull with rebase
git pull --rebase origin main
```

### Undo Changes

```bash
# Undo staged changes
git reset HEAD <file>

# Undo committed changes (keep changes)
git reset --soft HEAD~1

# Undo committed changes (discard changes)
git reset --hard HEAD~1

# Revert a commit (create new commit)
git revert <commit-hash>
```

## Git Configuration

### Set Your Identity

```bash
# Set your name and email
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify
git config --list
```

### SSH Keys (Recommended)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub
```

Then add the public key to your GitHub/GitLab account settings.

## .gitignore

The project already has a `.gitignore` file that excludes:
- `node_modules/` - Dependencies
- `dist/` - Build output
- `.env` - Environment variables
- `*.log` - Log files
- Python virtual environments
- IDE files
- OS files

## Commit Message Guidelines

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
git commit -m "feat(mobile): add collapsible sidebar navigation"

# Bug fix
git commit -m "fix(dashboard): correct KPI calculation for offline sensors"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Refactor
git commit -m "refactor(store): extract motion detection logic"
```

## Branch Naming

Use descriptive branch names:

```bash
# Features
feature/mobile-responsive
feature/respiration-detection
feature/ml-integration

# Bug fixes
fix/chart-rendering-issue
fix/memory-leak-simulation

# Documentation
docs/update-readme
docs/add-api-reference

# Refactoring
refactor/extract-dsp-functions
refactor/simplify-store
```

## Release Workflow

### Creating a Release

```bash
# Update version in src/state/store.ts
# Update CHANGELOG.md
# Commit changes
git add src/state/store.ts CHANGELOG.md
git commit -m "chore: bump version to 1.2.0"

# Create tag
git tag -a v1.2.0 -m "Release v1.2.0: New features"

# Push tag
git push origin v1.2.0

# Push all tags
git push origin --tags
```

### Viewing Tags

```bash
# List all tags
git tag

# Show tag details
git show v1.2.0

# Checkout a tag
git checkout v1.2.0
```

## Troubleshooting

### Merge Conflicts

```bash
# See conflicted files
git status

# Edit files to resolve conflicts
# Then:
git add <resolved-files>
git commit -m "fix: resolve merge conflicts"
```

### Detached HEAD

```bash
# You're in detached HEAD state
# Create a branch to save your work
git checkout -b temp-branch

# Or go back to main
git checkout main
```

### Large Files

If you accidentally commit large files:

```bash
# Remove from Git (keep locally)
git rm --cached large-file.bin

# Commit the removal
git commit -m "chore: remove large file from tracking"

# Add to .gitignore
echo "large-file.bin" >> .gitignore
git add .gitignore
git commit -m "chore: add large file to .gitignore"
```

## GitHub/GitLab Specific

### GitHub Actions

The project can use GitHub Actions for CI/CD. Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Run tests
      run: npm test
```

### Protected Branches

Protect your main branch:
1. Go to repository settings
2. Branches → Branch protection rules
3. Add rule for `main`
4. Require pull request reviews
5. Require status checks to pass

## Best Practices

1. **Commit Often** - Small, focused commits are easier to review and revert
2. **Write Good Messages** - Clear, descriptive commit messages
3. **Pull Before Push** - Always pull latest changes before pushing
4. **Use Branches** - Never commit directly to main for features
5. **Review Before Commit** - Use `git diff` to review changes
6. **Keep .gitignore Updated** - Exclude build artifacts, dependencies, secrets
7. **Tag Releases** - Use semantic versioning and tags
8. **Document Changes** - Update CHANGELOG.md for each release

## Security

### Never Commit
- API keys
- Passwords
- Private keys
- `.env` files with secrets
- Database credentials
- SSL certificates

### Use Environment Variables
```bash
# .env (not committed)
API_KEY=your-secret-key
DATABASE_URL=postgresql://...

# Access in code
process.env.API_KEY
```

## Additional Resources

- [Git Official Documentation](https://git-scm.com/doc)
- [GitHub Docs](https://docs.github.com)
- [Atlassian Git Tutorial](https://www.atlassian.com/git/tutorials)
- [Pro Git Book](https://git-scm.com/book/en/v2) (free online)

## Need Help?

If you encounter issues:
1. Check `git status` first
2. Read error messages carefully
3. Check the troubleshooting section above
4. Search Stack Overflow
5. Ask in GitHub Issues

---

**Remember:** Git is a powerful tool. Take time to understand the commands you're using, especially `reset`, `rebase`, and `push --force`.

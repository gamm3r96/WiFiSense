# Git Remote Operations Reference

## Understanding `git remote set-head origin main`

### What It Does

```bash
git remote set-head origin main
```

This command sets the **default branch** (HEAD) for the remote repository named `origin` to `main`.

**In practical terms:**
- Creates/updates the symbolic reference `refs/remotes/origin/HEAD` → `refs/remotes/origin/main`
- Tells Git: "When I don't specify a branch, use `main` as the default"
- Affects commands like `git fetch origin` and `git pull origin` (without branch specification)

### Why Use It?

1. **After cloning a repository** - Sometimes the default branch isn't set correctly
2. **After renaming the default branch** - If you renamed `master` to `main`
3. **To match remote's default branch** - Ensures local tracking matches remote expectations
4. **CI/CD pipelines** - Some tools expect HEAD to point to the correct default branch

### What It Affects

```bash
# Before setting HEAD
git branch -r
# origin/main
# origin/develop
# origin/feature-x

# After: git remote set-head origin main
git branch -r
# origin/HEAD -> origin/main    ← NEW!
# origin/main
# origin/develop
# origin/feature-x
```

## Common Git Remote Commands

### Viewing Remotes

```bash
# List all remotes
git remote -v

# Show detailed remote info
git remote show origin

# Check current HEAD
git remote show origin | grep "HEAD branch"
```

### Managing Remotes

```bash
# Add a remote
git remote add origin https://github.com/user/repo.git

# Change remote URL
git remote set-url origin https://github.com/user/new-repo.git

# Remove a remote
git remote remove origin

# Rename a remote
git remote rename old-name new-name
```

### Setting Default Branch

```bash
# Set default branch for remote
git remote set-head origin main

# Auto-detect default branch from remote
git remote set-head origin --auto

# Remove HEAD reference
git remote set-head origin --delete
```

### Fetching and Pulling

```bash
# Fetch all branches
git fetch origin

# Fetch specific branch
git fetch origin main

# Fetch and prune deleted branches
git fetch origin --prune

# Pull from default branch (uses HEAD)
git pull origin

# Pull from specific branch
git pull origin main

# Pull with rebase
git pull --rebase origin main
```

### Pushing

```bash
# Push to default branch
git push origin

# Push to specific branch
git push origin main

# Push and set upstream
git push -u origin main

# Push all branches
git push origin --all

# Push tags
git push origin --tags

# Force push (use with caution!)
git push --force origin main
```

## Complete Workflow Example

### Initial Setup

```bash
# 1. Initialize repository
git init

# 2. Add files and commit
git add .
git commit -m "Initial commit"

# 3. Add remote
git remote add origin https://github.com/user/wifisense-lab.git

# 4. Set default branch
git remote set-head origin main

# 5. Push and set upstream
git push -u origin main

# 6. Verify setup
git remote -v
git remote show origin
```

### Daily Workflow

```bash
# Morning: Get latest changes
git fetch origin
git pull origin main

# Work on feature
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "feat: add new feature"

# Push feature branch
git push -u origin feature/new-feature

# Create pull request on GitHub/GitLab

# After merge: Update local main
git checkout main
git pull origin main
git branch -d feature/new-feature
```

### Syncing After Remote Changes

```bash
# Someone else pushed to main
git fetch origin

# See what changed
git log main..origin/main

# Pull changes
git pull origin main

# Or if you have local changes
git fetch origin
git rebase origin/main
git push --force-with-lease origin main
```

## Troubleshooting

### Problem: "fatal: Remote branch main not found"

```bash
# Fetch all branches first
git fetch origin

# Then set HEAD
git remote set-head origin main
```

### Problem: "warning: remote HEAD refers to nonexistent ref"

```bash
# Auto-detect the correct HEAD
git remote set-head origin --auto

# Or manually set it
git remote set-head origin main
```

### Problem: Detached HEAD state

```bash
# You're in detached HEAD
# Create a local branch to track remote
git checkout -b main origin/main

# Or switch to existing local branch
git checkout main
git pull origin main
```

### Problem: Branch tracking not set up

```bash
# Set upstream for current branch
git branch --set-upstream-to=origin/main main

# Or when pushing
git push -u origin main
```

## Understanding HEAD

### What is HEAD?

HEAD is a reference to the **current commit** you're working on. It can be:

1. **Branch reference** (normal state)
   ```bash
   HEAD -> refs/heads/main -> abc123
   ```

2. **Detached HEAD** (pointing directly to a commit)
   ```bash
   HEAD -> abc123
   ```

3. **Remote HEAD** (default branch on remote)
   ```bash
   refs/remotes/origin/HEAD -> refs/remotes/origin/main
   ```

### Checking HEAD Status

```bash
# What does HEAD point to?
git symbolic-ref HEAD
# Output: refs/heads/main

# What commit does HEAD point to?
git rev-parse HEAD
# Output: abc123def456...

# Show HEAD in log
git log -1 HEAD
```

## Advanced Remote Operations

### Multiple Remotes

```bash
# Add multiple remotes (e.g., fork workflow)
git remote add upstream https://github.com/original/repo.git
git remote add origin https://github.com/your-fork/repo.git

# Fetch from all remotes
git fetch --all

# Pull from upstream
git pull upstream main

# Push to your fork
git push origin main
```

### Mirror a Repository

```bash
# Clone as mirror
git clone --mirror https://github.com/user/repo.git

# Update mirror
cd repo.git
git fetch --prune origin

# Push mirror to new location
git push --mirror https://github.com/user/new-repo.git
```

### Sparse Checkout

```bash
# Enable sparse checkout
git config core.sparseCheckout true

# Specify which files/directories to checkout
echo "src/" >> .git/info/sparse-checkout
echo "README.md" >> .git/info/sparse-checkout

# Apply sparse checkout
git read-tree -mu HEAD
```

## Best Practices

### 1. Always Fetch Before Push

```bash
git fetch origin
git log main..origin/main  # See what's new
git pull origin main       # Merge changes
git push origin main       # Now safe to push
```

### 2. Use Descriptive Remote Names

```bash
# Instead of just "origin"
git remote add production https://github.com/company/prod.git
git remote add staging https://github.com/company/staging.git

# Push to specific environments
git push production main
git push staging develop
```

### 3. Prune Regularly

```bash
# Remove deleted remote branches
git fetch --prune

# Or set it as default
git config remote.origin.prune true
```

### 4. Verify Before Force Push

```bash
# NEVER do this:
git push --force origin main

# Instead, use --force-with-lease (safer):
git push --force-with-lease origin main
```

## Quick Reference Card

```bash
# View remotes
git remote -v                          # List remotes
git remote show origin                 # Show details

# Set default branch
git remote set-head origin main        # Set HEAD to main
git remote set-head origin --auto      # Auto-detect

# Fetch operations
git fetch origin                       # Fetch all
git fetch origin main                  # Fetch specific
git fetch --prune                      # Remove deleted branches

# Pull operations
git pull origin                        # Pull default branch
git pull origin main                   # Pull specific branch
git pull --rebase origin main          # Pull with rebase

# Push operations
git push origin                        # Push default
git push origin main                   # Push specific
git push -u origin main                # Push and track
git push --all origin                  # Push all branches
git push --tags origin                 # Push tags

# Branch tracking
git branch -u origin/main main         # Set upstream
git branch -vv                         # Show tracking
```

## Related Commands

```bash
# Branch operations
git branch -r                          # List remote branches
git branch -a                          # List all branches
git checkout -b local-branch origin/remote-branch  # Track remote

# Merge operations
git merge origin/main                  # Merge remote branch
git rebase origin/main                 # Rebase onto remote

# Diff operations
git diff main origin/main              # Compare local vs remote
git diff --stat origin/main            # Show changed files
```

## When to Use `set-head`

| Scenario | Command |
|----------|---------|
| After cloning | `git remote set-head origin --auto` |
| After renaming default branch | `git remote set-head origin main` |
| HEAD points to wrong branch | `git remote set-head origin main` |
| Multiple default branches | `git remote set-head origin main` |
| Fix "nonexistent ref" warning | `git remote set-head origin --auto` |

## Summary

`git remote set-head origin main` is a **housekeeping command** that:
- ✅ Sets the default branch for a remote
- ✅ Ensures `git pull origin` works without specifying branch
- ✅ Fixes warnings about HEAD references
- ✅ Aligns local tracking with remote expectations

**Use it when:**
- Setting up a new repository
- After renaming the default branch
- When Git complains about HEAD references
- To ensure consistent default branch behavior

---

**Remember:** This command doesn't change your local branch or merge anything. It only updates the symbolic reference that tells Git which remote branch is the "default."

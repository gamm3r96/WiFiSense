# 🚀 Quick Git Setup - Make This Repo Default

## One-Time Setup (Run These Commands)

### Step 1: Initialize Git Repository

```bash
# Initialize the repository
git init

# Configure default branch to 'main'
git config init.defaultBranch main

# Add all files
git add .

# Create initial commit
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
```

### Step 2: Add Remote Repository

Choose your platform:

**GitHub:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/wifisense-lab.git
```

**GitLab:**
```bash
git remote add origin https://gitlab.com/YOUR_USERNAME/wifisense-lab.git
```

**Bitbucket:**
```bash
git remote add origin https://bitbucket.org/YOUR_USERNAME/wifisense-lab.git
```

### Step 3: Set Main as Default Branch

```bash
# Set the default branch for the remote
git remote set-head origin main

# Push and set upstream tracking
git push -u origin main
```

### Step 4: Verify Setup

```bash
# Check remote configuration
git remote -v

# Show remote details
git remote show origin

# List all branches
git branch -a

# Check current status
git status
```

## ✅ That's It!

Your repository is now set up with `main` as the default branch.

## 📋 Complete Command Sequence (Copy-Paste Ready)

```bash
# Initialize and configure
git init
git config init.defaultBranch main
git add .
git commit -m "Initial commit: WiFiSense Lab v1.1.0"

# Add remote (choose ONE)
git remote add origin https://github.com/YOUR_USERNAME/wifisense-lab.git

# Set default branch and push
git remote set-head origin main
git push -u origin main

# Verify
git remote -v
git branch -a
git status
```

## 🔧 What Each Command Does

| Command | Purpose |
|---------|---------|
| `git init` | Initialize Git repository |
| `git config init.defaultBranch main` | Set 'main' as default branch name |
| `git add .` | Stage all files |
| `git commit -m "..."` | Create initial commit |
| `git remote add origin <url>` | Add remote repository |
| `git remote set-head origin main` | Set remote HEAD to 'main' |
| `git push -u origin main` | Push and track main branch |

## 🎯 After Setup - Daily Commands

```bash
# Morning: Get latest changes
git fetch origin
git pull origin main

# Work on changes
git add .
git commit -m "feat: add new feature"
git push origin main

# Check status
git status
git log --oneline -5
```

## 📊 Expected Output

After running the setup, you should see:

```bash
$ git remote -v
origin  https://github.com/YOUR_USERNAME/wifisense-lab.git (fetch)
origin  https://github.com/YOUR_USERNAME/wifisense-lab.git (push)

$ git branch -a
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main

$ git status
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
```

## 🐛 Troubleshooting

### "fatal: remote origin already exists"
```bash
# Remove and re-add
git remote remove origin
git remote add origin <your-url>
```

### "error: src refspec main does not match any"
```bash
# You haven't committed yet
git add .
git commit -m "Initial commit"
git push -u origin main
```

### "fatal: Could not read from remote repository"
```bash
# Check if remote URL is correct
git remote -v

# Update if needed
git remote set-url origin <correct-url>
```

### "warning: remote HEAD refers to nonexistent ref"
```bash
# Auto-detect the correct HEAD
git remote set-head origin --auto
```

## 🔐 SSH Setup (Recommended)

For easier authentication, use SSH instead of HTTPS:

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub/GitLab, then update remote URL
git remote set-url origin git@github.com:YOUR_USERNAME/wifisense-lab.git
```

## 📝 Next Steps

1. ✅ Create repository on GitHub/GitLab/Bitbucket
2. ✅ Run the setup commands above
3. ✅ Push your code
4. ✅ Set up branch protection (optional)
5. ✅ Configure CI/CD (optional)

## 🎉 You're Done!

Your WiFiSense Lab repository is now configured with `main` as the default branch and ready for development!

---

**Need help?** Check these files:
- `GIT_SETUP.md` - Comprehensive Git guide
- `GIT_REMOTE_REFERENCE.md` - Remote operations reference
- `setup-git.sh` - Automated setup script

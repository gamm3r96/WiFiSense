# 🎯 Make This Repo Default - Quick Start

## Run These Commands NOW

```bash
# 1. Initialize Git
git init

# 2. Set default branch to 'main'
git config init.defaultBranch main

# 3. Add all files
git add .

# 4. Create initial commit
git commit -m "Initial commit: WiFiSense Lab v1.1.0"

# 5. Add your remote repository (choose ONE)
# GitHub:
git remote add origin https://github.com/YOUR_USERNAME/wifisense-lab.git

# OR GitLab:
# git remote add origin https://gitlab.com/YOUR_USERNAME/wifisense-lab.git

# OR Bitbucket:
# git remote add origin https://bitbucket.org/YOUR_USERNAME/wifisense-lab.git

# 6. Set main as default branch
git remote set-head origin main

# 7. Push to remote
git push -u origin main

# 8. Verify
git remote -v
git branch -a
```

## ✅ Done!

That's it. Your repository now has `main` as the default branch.

## 📋 What You Just Did

1. ✅ Initialized Git repository
2. ✅ Set `main` as the default branch name
3. ✅ Committed all files
4. ✅ Connected to remote repository
5. ✅ Set remote HEAD to `main`
6. ✅ Pushed code to remote

## 🔍 Verify It Worked

```bash
# Should show your remote URL
git remote -v

# Should show: * main and remotes/origin/HEAD -> origin/main
git branch -a

# Should show clean working tree
git status
```

## 🚀 Next Time You Work

```bash
# Get latest changes
git pull origin main

# Make changes
git add .
git commit -m "Your message"
git push origin main
```

## 📖 Need More Help?

- **QUICK_GIT_SETUP.md** - Detailed step-by-step guide
- **GIT_SETUP.md** - Complete Git reference
- **GIT_REMOTE_REFERENCE.md** - Remote operations guide
- **setup-git.sh** - Automated setup script (run: `bash setup-git.sh`)

---

**Replace `YOUR_USERNAME` with your actual GitHub/GitLab/Bitbucket username!**

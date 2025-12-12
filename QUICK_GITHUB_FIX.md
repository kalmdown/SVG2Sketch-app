# Quick Fix: GitHub Repository Setup

## Current Issue
The remote was removed, so you need to:
1. Create the repository on GitHub
2. Add the remote back
3. Push your code

## Quick Steps

### 1. Create Repository on GitHub
Go to: **https://github.com/new**

- **Repository name:** `SVG2Sketch-app`
- **Visibility:** Public or Private
- **⚠️ DO NOT** check any boxes (README, .gitignore, license)
- Click **"Create repository"**

### 2. Add Remote and Push

After creating the repository, run these commands:

```powershell
cd "C:\Dev\Onshape Projects\SVG2Sketch-app"

# Add the remote
git remote add origin https://github.com/kalmdown/SVG2Sketch-app.git

# Verify it was added
git remote -v

# Push your code
git push -u origin main
```

## If Repository Already Exists

If you already created the repository, just add the remote:

```powershell
git remote add origin https://github.com/kalmdown/SVG2Sketch-app.git
git push -u origin main
```

## Authentication

If you get authentication errors:

1. **Use GitHub CLI** (if installed):
   ```powershell
   gh auth login
   ```

2. **Or use Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Generate new token (classic) with `repo` scope
   - Use token as password when prompted

3. **Or use SSH** (if configured):
   ```powershell
   git remote set-url origin git@github.com:kalmdown/SVG2Sketch-app.git
   git push -u origin main
   ```

## Verify Success

After pushing, check:
```powershell
git remote -v
git log --oneline
```

Then visit: https://github.com/kalmdown/SVG2Sketch-app



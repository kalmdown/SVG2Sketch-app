# Setting Up GitHub Repository for SVG2Sketch-app

## Step-by-Step Instructions

### Step 1: Create Repository on GitHub

1. **Go to GitHub:**
   - Visit: https://github.com/new
   - Or click the "+" icon in the top right → "New repository"

2. **Repository Settings:**
   - **Repository name:** `SVG2Sketch-app`
   - **Description:** Enhanced SVG to Onshape Sketch converter with text support, large file handling, and pattern recognition
   - **Visibility:** Choose Public or Private
   - **⚠️ IMPORTANT:** Do NOT check:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   
   (We already have these files!)

3. **Click "Create repository"**

### Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd "C:\Dev\Onshape Projects\SVG2Sketch-app"

# If you already added a remote with wrong URL, remove it first:
git remote remove origin

# Add the correct remote (replace kalmdown with your GitHub username if different):
git remote add origin https://github.com/kalmdown/SVG2Sketch-app.git

# Rename branch to main (if not already):
git branch -M main

# Push to GitHub:
git push -u origin main
```

### Step 3: Verify

After pushing, verify it worked:

```bash
git remote -v
git log --oneline
```

Then check on GitHub - you should see all your files!

## Troubleshooting

### Error: "Repository not found"

**Causes:**
1. Repository doesn't exist on GitHub yet (most common)
2. Wrong repository name or username
3. Private repository and you're not authenticated

**Solutions:**
1. Create the repository on GitHub first (Step 1 above)
2. Verify the URL: `https://github.com/YOUR_USERNAME/SVG2Sketch-app.git`
3. Make sure you're logged into GitHub:
   ```bash
   gh auth status
   # Or authenticate via browser
   ```

### Error: "Authentication failed"

**Solution:**
Use a Personal Access Token or SSH:

**Option A: Personal Access Token**
1. Go to: https://github.com/settings/tokens
2. Generate new token (classic) with `repo` scope
3. Use token as password when pushing

**Option B: Use SSH**
```bash
# Change remote to SSH
git remote set-url origin git@github.com:kalmdown/SVG2Sketch-app.git

# Make sure SSH key is set up
ssh -T git@github.com
```

### Error: "Branch name mismatch"

If your local branch is `master` but GitHub expects `main`:

```bash
git branch -M main
git push -u origin main
```

## Quick Reference

```bash
# Check current remotes
git remote -v

# Remove incorrect remote
git remote remove origin

# Add correct remote
git remote add origin https://github.com/kalmdown/SVG2Sketch-app.git

# Push to GitHub
git push -u origin main

# Future pushes (after first time)
git push
```

## After Setup

Once the repository is on GitHub, you can:
- View it at: `https://github.com/kalmdown/SVG2Sketch-app`
- Clone it elsewhere: `git clone https://github.com/kalmdown/SVG2Sketch-app.git`
- Share it with others
- Set up GitHub Actions for CI/CD
- Create releases and tags



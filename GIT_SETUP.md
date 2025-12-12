# Git Repository Setup for SVG2Sketch-app

## Initial Commit

To create the initial commit, run:

```bash
cd "C:\Dev\Onshape Projects\SVG2Sketch-app"
git add .
git commit -m "Initial commit: SVG2Sketch app with enhanced SVG parsing, text support, and pattern recognition"
```

## Setting Up a Remote Repository

### Option 1: GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Name it: `SVG2Sketch-app`
   - Choose public or private
   - **Don't** initialize with README, .gitignore, or license (we already have these)

2. **Add remote and push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/SVG2Sketch-app.git
   git branch -M main
   git push -u origin main
   ```

### Option 2: GitLab

1. **Create a new project on GitLab:**
   - Go to https://gitlab.com/projects/new
   - Name it: `SVG2Sketch-app`
   - Choose visibility level

2. **Add remote and push:**
   ```bash
   git remote add origin https://gitlab.com/YOUR_USERNAME/SVG2Sketch-app.git
   git branch -M main
   git push -u origin main
   ```

### Option 3: Bitbucket

1. **Create a new repository on Bitbucket:**
   - Go to https://bitbucket.org/repo/create
   - Name it: `SVG2Sketch-app`

2. **Add remote and push:**
   ```bash
   git remote add origin https://bitbucket.org/YOUR_USERNAME/SVG2Sketch-app.git
   git branch -M main
   git push -u origin main
   ```

## What's Included in .gitignore

The `.gitignore` file excludes:
- `node_modules/` - Dependencies (install with `npm install`)
- `.env` files - Environment variables with secrets
- `certificates/` - SSL certificates (sensitive, local only)
- `tmp/` - Temporary files
- Build outputs and logs

## Important: Environment Variables

**Never commit `.env` files!** They contain:
- OAuth client secrets
- Session secrets
- API keys

Create a `.env.example` file with placeholder values for reference:

```env
PORT=3000
API_URL=https://cad.onshape.com
OAUTH_URL=https://oauth.onshape.com
OAUTH_CLIENT_ID=your_client_id_here
OAUTH_CLIENT_SECRET=your_client_secret_here
OAUTH_CALLBACK_URL=https://your-domain.com/oauthRedirect
SESSION_SECRET=your_session_secret_here
DEBUG=true
```

## Common Git Commands

```bash
# Check status
git status

# Add files
git add .

# Commit changes
git commit -m "Your commit message"

# Push to remote
git push

# Pull from remote
git pull

# View commit history
git log --oneline

# Create a new branch
git checkout -b feature-name

# Switch branches
git checkout main
```

## Recommended: Create .env.example

Create a template file for environment variables:

```bash
# Copy .env to .env.example (if you have one)
# Then edit .env.example to remove actual secrets
```

This helps other developers know what environment variables are needed.


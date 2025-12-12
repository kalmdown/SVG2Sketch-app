# How to Access the SVG2Sketch App

## Overview

Onshape Apps are web applications that integrate with Onshape. They are accessed **from within Onshape** through the App Store or custom app URLs.

## Prerequisites

1. **Onshape Developer Account**
   - Sign up at [Onshape Developer Portal](https://dev-portal.onshape.com/)
   - Create an OAuth application
   - Get your `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`

2. **Running Server**
   - Your app server must be running and accessible
   - For development: `npm start` (runs on `https://localhost:3000`)
   - For production: Deploy to a public URL (e.g., Heroku, AWS, etc.)

## Access Methods

### Method 1: Onshape App Store (Production)

1. **Register Your App**
   - Go to [Onshape Developer Portal](https://dev-portal.onshape.com/)
   - Navigate to "My Apps"
   - Click "Create App"
   - Fill in app details:
     - **App Name**: SVG2Sketch
     - **App URL**: `https://your-domain.com` (your deployed app URL)
     - **Callback URL**: `https://your-domain.com/oauthRedirect`
     - **Description**: Enhanced SVG to Onshape Sketch converter

2. **Submit for Review** (if publishing publicly)
   - Apps can be private (only you) or public (App Store)
   - Private apps don't require review

3. **Access from Onshape**
   - Open Onshape
   - Go to **App Store** (top menu)
   - Find "SVG2Sketch" in your apps
   - Click to launch

### Method 2: Direct URL (Development/Testing)

For development and testing, you can access the app directly via URL with Onshape document context:

#### Step 1: Get Document Context from Onshape

1. Open an Onshape document
2. Navigate to a **Part Studio** tab
3. Copy the URL from your browser
   - Example: `https://cad.onshape.com/documents/abc123/w/xyz789/e/def456`
   - This contains:
     - `abc123` = documentId
     - `xyz789` = workspaceId  
     - `def456` = elementId

#### Step 2: Construct App URL

Build the app URL with query parameters:

```
https://your-app-url.com/?documentId=abc123&workspaceId=xyz789&elementId=def456
```

**For local development:**
```
https://localhost:3000/?documentId=abc123&workspaceId=xyz789&elementId=def456
```

#### Step 3: Access the App

**Option A: Open in New Tab**
- Paste the URL in a new browser tab
- The app will load with document context

**Option B: Use Onshape Custom App Feature**
1. In Onshape, go to **Insert** → **Custom Feature** → **Custom App**
2. Enter your app URL: `https://your-app-url.com`
3. Onshape will automatically append document context

**Option C: Bookmarklet (Quick Access)**
Create a bookmarklet that extracts context from current Onshape page:
```javascript
javascript:(function(){
  const url = window.location.href;
  const match = url.match(/\/documents\/([^\/]+)\/w\/([^\/]+)\/e\/([^\/]+)/);
  if(match){
    window.open('https://your-app-url.com/?documentId='+match[1]+'&workspaceId='+match[2]+'&elementId='+match[3]);
  }else{
    alert('Not on a Part Studio page');
  }
})();
```

## URL Structure

The app expects these query parameters:

- `documentId` - Onshape document ID (required)
- `workspaceId` - Onshape workspace ID (required)
- `elementId` - Part Studio element ID (required)

Example:
```
https://your-app.com/?documentId=abc123&workspaceId=xyz789&elementId=def456
```

## OAuth Flow

When you first access the app:

1. **App loads** → Checks for authentication
2. **Not authenticated** → Redirects to `/oauthSignin`
3. **OAuth redirect** → Onshape login page
4. **User authorizes** → Callback to `/oauthRedirect`
5. **Session created** → User redirected back to app
6. **App ready** → Can now access Onshape API

## Development Setup

### Local Development with HTTPS

Onshape requires HTTPS for OAuth. For local development:

1. **Generate SSL certificates** (or use existing ones):
   ```bash
   # Place certificates in SVG2Sketch-app/certificates/
   # - private.key
   # - certificate.pem
   ```

2. **Update .env**:
   ```env
   PORT=3000
   OAUTH_CALLBACK_URL=https://localhost:3000/oauthRedirect
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Access app**:
   - You'll need to accept the self-signed certificate warning
   - URL: `https://localhost:3000/?documentId=...&workspaceId=...&elementId=...`

### Using ngrok for Local Testing

For easier local testing with HTTPS:

1. **Install ngrok**:
   ```bash
   npm install -g ngrok
   # or download from https://ngrok.com/
   ```

2. **Start your app**:
   ```bash
   npm start
   ```

3. **Create tunnel**:
   ```bash
   ngrok http 3000
   ```

4. **Update OAuth callback**:
   - Use the ngrok URL: `https://abc123.ngrok.io/oauthRedirect`
   - Update in Onshape Developer Portal
   - Update in `.env`: `OAUTH_CALLBACK_URL=https://abc123.ngrok.io/oauthRedirect`

5. **Access via ngrok URL**:
   ```
   https://abc123.ngrok.io/?documentId=...&workspaceId=...&elementId=...
   ```

## Troubleshooting

### "Authentication required" error
- Check OAuth credentials in `.env`
- Verify callback URL matches Onshape Developer Portal
- Clear browser cookies and try again

### "Missing document parameters" error
- Ensure you're accessing from a Part Studio tab
- Check URL has `documentId`, `workspaceId`, and `elementId` parameters
- Try manually adding parameters to URL

### CORS errors
- Verify `OAUTH_CALLBACK_URL` is correct
- Check server CORS configuration in `app.js`
- Ensure cookies are enabled in browser

### SSL/Certificate errors (local)
- Accept self-signed certificate in browser
- Or use ngrok for a valid HTTPS certificate
- Or deploy to a service with valid SSL

## Production Deployment

For production, deploy to a service with:
- HTTPS support (required for OAuth)
- Public URL
- Environment variable configuration

Popular options:
- **Heroku**: Easy deployment, free tier available
- **AWS**: Elastic Beanstalk or EC2
- **DigitalOcean**: App Platform
- **Railway**: Simple Node.js deployment

Update these in production:
- `OAUTH_CALLBACK_URL` → Your production URL
- `SESSION_SECRET` → Strong random string
- SSL certificate configuration

## Quick Start Checklist

- [ ] Server is running (`npm start`)
- [ ] OAuth app created in Onshape Developer Portal
- [ ] `.env` file configured with OAuth credentials
- [ ] Callback URL matches in both places
- [ ] Accessing from Part Studio tab in Onshape
- [ ] URL includes document context parameters

## Example Access Flow

1. **Open Onshape** → Navigate to a Part Studio
2. **Copy document URL** → Extract IDs
3. **Open app URL** → `https://your-app.com/?documentId=...&workspaceId=...&elementId=...`
4. **First time** → OAuth login flow
5. **After auth** → App loads with document context
6. **Upload SVG** → Select file and convert

---

**Need Help?** Check the main README.md for setup instructions and troubleshooting.


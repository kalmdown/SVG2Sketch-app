# Quick Start Guide - Accessing SVG2Sketch App

## Fastest Way to Test (Local Development)

### 1. Start the Server
```bash
cd SVG2Sketch-app
npm install
npm start
```
Server runs on `https://localhost:3000`

### 2. Get Onshape Document Context

1. Open Onshape in your browser
2. Navigate to a **Part Studio** tab
3. Look at the URL:
   ```
   https://cad.onshape.com/documents/ABC123/w/XYZ789/e/DEF456
   ```
   - `ABC123` = documentId
   - `XYZ789` = workspaceId
   - `DEF456` = elementId

### 3. Access the App

**Option A: Direct URL (Easiest)**
```
https://localhost:3000/?documentId=ABC123&workspaceId=XYZ789&elementId=DEF456
```
*(Replace ABC123, XYZ789, DEF456 with your actual IDs)*

**Option B: Bookmarklet**
1. Create a bookmark with this JavaScript:
```javascript
javascript:(function(){
  const url = window.location.href;
  const match = url.match(/\/documents\/([^\/]+)\/w\/([^\/]+)\/e\/([^\/]+)/);
  if(match){
    window.open('https://localhost:3000/?documentId='+match[1]+'&workspaceId='+match[2]+'&elementId='+match[3]);
  }else{
    alert('Open a Part Studio tab first');
  }
})();
```
2. When on a Part Studio page, click the bookmarklet

### 4. First-Time OAuth

1. App will redirect to Onshape login
2. Authorize the app
3. You'll be redirected back to the app
4. App is ready to use!

## Production Access

### Register App in Onshape

1. Go to [Onshape Developer Portal](https://dev-portal.onshape.com/)
2. Create OAuth Application:
   - **App URL**: Your production URL (e.g., `https://svg2sketch.herokuapp.com`)
   - **Callback URL**: `https://your-domain.com/oauthRedirect`
3. Get credentials and add to `.env`

### Access from Onshape App Store

1. In Onshape, click **App Store** (top menu)
2. Find your app (or use "My Apps")
3. Click to launch

## Troubleshooting

**"Authentication required"**
- Check `.env` has correct OAuth credentials
- Verify callback URL matches Onshape Developer Portal

**"Missing document parameters"**
- Make sure you're on a Part Studio tab
- Check URL has all three parameters: `documentId`, `workspaceId`, `elementId`

**SSL/Certificate warning (local)**
- Accept the self-signed certificate
- Or use ngrok: `ngrok http 3000` and use the ngrok URL

**Can't access localhost from Onshape**
- Use ngrok or deploy to a public URL
- Onshape OAuth requires a publicly accessible callback URL

## Next Steps

See [ACCESS_GUIDE.md](./ACCESS_GUIDE.md) for detailed instructions and [README.md](./README.md) for full documentation.


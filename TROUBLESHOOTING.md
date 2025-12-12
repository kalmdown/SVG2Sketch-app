# Troubleshooting Guide

## Error Code -107

**Error Code: -107** is a network/SSL error that typically occurs when:

1. **Protocol mismatch** (trying HTTPS when server uses HTTP, or vice versa)
2. **Server is not running**
3. **SSL certificate issue** (self-signed certificate)
4. **Browser blocking the connection**
5. **Port not accessible**

### ⚠️ IMPORTANT: Check Your Server Protocol

**Your server is currently configured to use HTTP, not HTTPS!**

If your server is running on HTTP (which is the default), use:
```
http://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

**NOT:**
```
https://localhost:3000/?documentId=...
```

**Note:** Onshape OAuth requires HTTPS. For local development with OAuth, you'll need to either:
- Configure HTTPS in the server (see below)
- Use ngrok to create an HTTPS tunnel

## Quick Fixes

### 1. Verify Server is Running

Check if the server is actually running:
```bash
# In the SVG2Sketch-app directory
npm start
```

You should see:
```
Server running on https://localhost:3000
```

### 2. Accept SSL Certificate Warning

Since you're using `localhost:3000` with HTTPS, your browser will show a security warning for the self-signed certificate:

**Chrome/Edge:**
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost (unsafe)" or "Accept the Risk and Continue"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"
3. Click "Visit Website" in the confirmation dialog

### 3. Check Certificate Files

The server needs SSL certificates. Check if they exist:
```bash
# Windows PowerShell
Test-Path certificates\private.key
Test-Path certificates\certificate.pem

# If they don't exist, you need to create them or update the config
```

### 4. Alternative: Use HTTP for Local Development

If SSL is causing issues, you can temporarily modify the server to use HTTP:

**Note:** Onshape OAuth requires HTTPS, so this is only for testing the app structure, not full OAuth flow.

## Your URL is Correct! ✅

Your constructed URL is perfect:
```
https://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

The parameters match your Onshape document:
- `documentId=cb1e9acdd17540e4f4a4d45b` ✅
- `workspaceId=425a72a0620d341664869beb` ✅  
- `elementId=e3e5ef7c62cd21704be0c100` ✅

## Step-by-Step Resolution

### Step 1: Start the Server
```bash
cd SVG2Sketch-app
npm start
```

### Step 2: Open Browser Console
Press F12 to open developer tools, check for errors.

### Step 3: Try the URL Again
```
https://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

### Step 4: Accept Certificate Warning
When you see the security warning, accept it to proceed.

### Step 5: Check Server Logs
Look at the terminal where `npm start` is running. You should see:
- Request logs
- Any error messages
- OAuth redirect attempts

## Common Issues

### Issue: "ERR_CONNECTION_REFUSED"
**Solution:** Server is not running. Start it with `npm start`.

### Issue: "NET::ERR_CERT_AUTHORITY_INVALID" or "ERR_CERT_INVALID"
**Solution:** Accept the self-signed certificate warning in your browser.

### Issue: "CORS error"
**Solution:** Check that your `.env` file has correct OAuth callback URL.

### Issue: "Authentication required" (after accepting cert)
**Solution:** This is normal! The app will redirect to OAuth login. Make sure:
- OAuth credentials are set in `.env`
- Callback URL matches: `https://localhost:3000/oauthRedirect`

## Using ngrok (Alternative for Easier Testing)

If SSL certificates are problematic, use ngrok:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your server:**
   ```bash
   npm start
   ```

3. **In another terminal, create tunnel:**
   ```bash
   ngrok http 3000
   ```

4. **Use the ngrok URL:**
   ```
   https://abc123.ngrok.io/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
   ```

5. **Update OAuth callback** in Onshape Developer Portal to use the ngrok URL.

## Still Having Issues?

1. **Check server is running:**
   ```bash
   # Test if server responds
   curl https://localhost:3000/api/health -k
   ```

2. **Check port 3000 is available:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   ```

3. **Check .env file:**
   - All required variables are set
   - No typos in OAuth credentials
   - Callback URL is correct

4. **Check browser console:**
   - Open F12 → Console tab
   - Look for JavaScript errors
   - Check Network tab for failed requests

## Expected Behavior

Once everything is working:

1. **First access:** Redirects to `/oauthSignin`
2. **OAuth flow:** Redirects to Onshape login
3. **After auth:** Redirects back to app with document context
4. **App loads:** Shows file upload interface

Your URL structure is correct - the issue is likely the SSL certificate or server not running!


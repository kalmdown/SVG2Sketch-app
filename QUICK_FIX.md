# Quick Fix for Error -107

## The Problem

You're getting **Error -107** because:
- Your server is running on **HTTP** (`http://localhost:3000`)
- But you're trying to access it via **HTTPS** (`https://localhost:3000`)

## Immediate Solution

### Option 1: Use HTTP (Quick Test)

Change your URL from:
```
https://localhost:3000/?documentId=...
```

To:
```
http://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

**⚠️ Warning:** OAuth won't work with HTTP. This is only for testing the app structure.

### Option 2: Use HTTPS (Recommended for OAuth)

The server has been updated to support HTTPS. You need SSL certificates:

1. **Create certificates directory:**
   ```bash
   mkdir certificates
   ```

2. **Generate self-signed certificate** (for local development):
   ```bash
   # Using OpenSSL (if installed)
   openssl req -x509 -newkey rsa:4096 -nodes -keyout certificates/private.key -out certificates/certificate.pem -days 365
   ```

3. **Or use existing certificates** from another project if you have them.

4. **Restart the server:**
   ```bash
   npm start
   ```

5. **Access with HTTPS:**
   ```
   https://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
   ```

6. **Accept the certificate warning** in your browser.

### Option 3: Use ngrok (Easiest for Testing)

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

4. **Use the ngrok HTTPS URL:**
   ```
   https://abc123.ngrok.io/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
   ```

5. **Update OAuth callback** in Onshape Developer Portal to use the ngrok URL.

## Your Correct URL (Once Server is Running)

Once the server is running with the correct protocol, use:

**For HTTP:**
```
http://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

**For HTTPS:**
```
https://localhost:3000/?documentId=cb1e9acdd17540e4f4a4d45b&workspaceId=425a72a0620d341664869beb&elementId=e3e5ef7c62cd21704be0c100
```

The document IDs are correct! ✅


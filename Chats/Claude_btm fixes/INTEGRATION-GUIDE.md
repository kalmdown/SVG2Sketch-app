# Integration Guide: Implementing All Fixes

This guide shows how to integrate the authentication and OAuth fixes into your existing codebase.

## Overview

We're fixing two main issues:
1. **API Key Authentication** - Proper HMAC signature for Onshape API
2. **OAuth Parameter Preservation** - Keep context through OAuth flow

## Step-by-Step Integration

### Step 1: Backup Your Current Code

```bash
# Create a backup branch
git checkout -b backup-before-auth-fixes
git add .
git commit -m "Backup before authentication fixes"
git checkout main
```

---

### Step 2: Update OnshapeApiService

**File:** `services/onshape-api.js`

#### Option A: Replace Entire File
1. Copy `services/onshape-api-fixed.js` to `services/onshape-api.js`
2. Test that imports still work

#### Option B: Merge Changes
Add/update these specific methods in your existing `onshape-api.js`:

```javascript
import crypto from 'crypto';

class OnshapeApiService {
    // ... existing constructor ...

    /**
     * ADD THIS METHOD - Create API Key headers with proper signature
     */
    _createApiKeyHeaders(method, path, body, accessKey, secretKey) {
        const nonce = crypto.randomBytes(16).toString('hex');
        const date = new Date().toUTCString();
        
        // CRITICAL: All lowercase, ends with \n
        const signatureString = [
            method.toLowerCase(),
            nonce.toLowerCase(),
            date.toLowerCase(),
            'application/json',
            path.toLowerCase(),
            ''
        ].join('\n') + '\n';
        
        const hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(signatureString, 'utf8');
        const signature = hmac.digest('base64');
        
        const authString = `On ${accessKey}:HmacSHA256:${signature}`;
        
        return {
            'Authorization': authString,
            'Date': date,
            'On-Nonce': nonce,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * ADD THIS METHOD - Generic API request with both auth types
     */
    async _makeRequest(method, path, body = null, auth = null) {
        let headers;
        
        if (auth?.apiKey) {
            headers = this._createApiKeyHeaders(
                method, 
                path, 
                body, 
                auth.apiKey.accessKey, 
                auth.apiKey.secretKey
            );
        } else if (auth?.accessToken) {
            headers = {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
        } else {
            throw new Error('No authentication provided');
        }

        const url = `${this.baseUrl}${path}`;
        const options = { method, headers };
        
        if (body) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetail;
            try {
                errorDetail = JSON.parse(errorText);
            } catch (e) {
                errorDetail = errorText;
            }
            
            const error = new Error(`Onshape API Error ${response.status}: ${JSON.stringify(errorDetail)}`);
            error.status = response.status;
            error.detail = errorDetail;
            throw error;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    }

    /**
     * UPDATE THIS METHOD - Support both auth types
     */
    async createSketchFromBTM({ documentId, workspaceId, elementId, planeId, entities, accessToken, apiKey, options = {} }) {
        const sketchFeature = {
            btType: "BTMSketch-151",
            featureType: "newSketch",
            name: options.sketchName || `SVG Sketch ${new Date().toISOString()}`,
            parameters: [{
                btType: "BTMParameterQueryList-148",
                parameterId: "sketchPlane",
                queries: [{
                    btType: "BTMIndividualQuery-138",
                    deterministicIds: [this._getPlaneId(planeId)]
                }]
            }],
            entities: entities,
            constraints: []
        };

        const featurePayload = {
            btType: "BTFeatureDefinitionCall-1406",
            feature: sketchFeature
        };

        // Use v6 API endpoint
        const path = `/api/v6/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
        
        // Determine auth method
        const auth = apiKey ? { apiKey } : { accessToken };
        
        return await this._makeRequest('POST', path, featurePayload, auth);
    }

    // ... rest of your existing methods ...
}
```

---

### Step 3: Update OAuth Routes

**File:** `node.js` or wherever your OAuth routes are

#### Option A: Use New Router Module
1. Copy `routes/oauth-fixed.js` to your `routes/` directory
2. In your main server file:

```javascript
import setupOAuthRoutes from './routes/oauth-fixed.js';

// After session and passport initialization
setupOAuthRoutes(app);
```

#### Option B: Update Existing Routes

Replace your existing `/oauthSignin` and `/oauthRedirect` routes:

```javascript
import { v4 as uuidv4 } from 'uuid';

// ADD HELPER FUNCTION
function sanitizeParams(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
        if (!value || value === 'undefined' || value === 'null') {
            continue;
        }
        sanitized[key] = value;
    }
    return sanitized;
}

// REPLACE YOUR /oauthSignin ROUTE
app.get('/oauthSignin', (req, res, next) => {
    console.log('=== OAuth Signin Started ===');
    console.log('Incoming query params:', req.query);
    
    const state = uuidv4();
    
    const params = sanitizeParams({
        documentId: req.query.documentId,
        workspaceId: req.query.workspaceId,
        elementId: req.query.elementId,
        state: state
    });
    
    console.log('Sanitized params to save:', params);
    
    req.session.extraData = params;
    req.session.oauthState = state;

    // CRITICAL: Wait for session save
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.redirect('/?error=session_error');
        }
        
        console.log('Session saved successfully');
        
        passport.authenticate('onshape', {
            scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
            state: state
        })(req, res, next);
    });
});

// REPLACE YOUR /oauthRedirect ROUTE
app.get('/oauthRedirect', (req, res, next) => {
    console.log('=== OAuth Redirect Received ===');
    console.log('Session ID:', req.sessionID);
    
    const savedParams = req.session.extraData || {};
    console.log('Retrieved saved params:', savedParams);

    passport.authenticate('onshape', (err, user) => {
        if (err || !user) {
            console.error('OAuth error:', err);
            return res.redirect('/?error=auth_failed');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.redirect('/?error=login_failed');
            }

            console.log('Login successful');

            // Build redirect URL
            const sanitized = sanitizeParams(savedParams);
            const paramEntries = Object.entries(sanitized);
            
            let redirectUrl = '/';
            if (paramEntries.length > 0) {
                const queryString = paramEntries
                    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                    .join('&');
                redirectUrl += '?' + queryString;
            }
            
            console.log('Redirecting to:', redirectUrl);
            console.log('=== OAuth Flow Complete ===\n');
            
            res.redirect(redirectUrl);
        });
    })(req, res, next);
});
```

---

### Step 4: Update Frontend Parameter Handling

**File:** `public/js/main.js` or your main frontend JavaScript

Add/update these functions:

```javascript
/**
 * Parse URL parameters, filtering invalid values
 */
function getUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    const documentId = params.get('documentId');
    const workspaceId = params.get('workspaceId');
    const elementId = params.get('elementId');
    
    // Filter out invalid values
    if (documentId && documentId !== 'undefined' && documentId !== 'null') {
        result.documentId = documentId;
    }
    if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
        result.workspaceId = workspaceId;
    }
    if (elementId && elementId !== 'undefined' && elementId !== 'null') {
        result.elementId = elementId;
    }
    
    console.log('Parsed URL parameters:', result);
    return result;
}

/**
 * Initialize app with proper parameter handling
 */
async function initializeApp() {
    const urlParams = getUrlParameters();
    
    // Check authentication
    try {
        const authResponse = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        
        if (!authResponse.ok) {
            // Not authenticated - redirect to OAuth with params
            console.log('Not authenticated, redirecting to login');
            const oauthParams = new URLSearchParams();
            if (urlParams.documentId) oauthParams.append('documentId', urlParams.documentId);
            if (urlParams.workspaceId) oauthParams.append('workspaceId', urlParams.workspaceId);
            if (urlParams.elementId) oauthParams.append('elementId', urlParams.elementId);
            
            const oauthUrl = `/oauthSignin${oauthParams.toString() ? '?' + oauthParams.toString() : ''}`;
            window.location.href = oauthUrl;
            return;
        }
        
        const authData = await authResponse.json();
        console.log('Authenticated as:', authData.user.email);
        
        // Load documents
        await loadDocuments();
        
        // Use URL parameters if available and valid
        if (urlParams.documentId) {
            const doc = documents.find(d => d.id === urlParams.documentId);
            if (doc) {
                console.log('Using document from URL:', doc.name);
                currentDocumentId = urlParams.documentId;
                if (urlParams.workspaceId) currentWorkspaceId = urlParams.workspaceId;
                if (urlParams.elementId) currentElementId = urlParams.elementId;
                await loadWorkspaces(currentDocumentId);
            } else {
                console.warn('Document from URL not found, loading defaults');
                await loadDefaultDocument();
            }
        } else {
            await loadDefaultDocument();
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize app');
    }
}

/**
 * Load default document (SVG to Sketch App if available)
 */
async function loadDefaultDocument() {
    const targetDoc = documents.find(d => d.name === 'SVG to Sketch App');
    
    if (targetDoc) {
        console.log('Loading default document: SVG to Sketch App');
        currentDocumentId = targetDoc.id;
        await loadWorkspaces(currentDocumentId);
        
        // Try to find "Funky Plane" Part Studio
        const targetElement = elements.find(e => e.name === 'Funky Plane');
        if (targetElement) {
            currentElementId = targetElement.id;
            await loadPlanes(currentDocumentId, currentWorkspaceId, currentElementId);
        }
    } else if (documents.length > 0) {
        console.log('Loading first available document');
        currentDocumentId = documents[0].id;
        await loadWorkspaces(currentDocumentId);
    }
}
```

---

### Step 5: Update API Call Sites

Find where you call `createSketchFromBTM` and update to support both auth types:

```javascript
// In your API route handler
async function createSketch(req, res) {
    try {
        const { documentId, workspaceId, elementId, planeId, entities } = req.body;
        
        // Get auth from user session
        let auth;
        if (req.user && req.user.accessToken) {
            auth = { accessToken: req.user.accessToken };
        } else if (process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
            auth = {
                apiKey: {
                    accessKey: process.env.ONSHAPE_ACCESS_KEY,
                    secretKey: process.env.ONSHAPE_SECRET_KEY
                }
            };
        } else {
            return res.status(401).json({ error: 'No authentication available' });
        }
        
        const result = await onshapeApi.createSketchFromBTM({
            documentId,
            workspaceId,
            elementId,
            planeId,
            entities,
            ...auth,
            options: {
                sketchName: req.body.sketchName || 'SVG Import'
            }
        });
        
        res.json(result);
    } catch (error) {
        console.error('Create sketch error:', error);
        res.status(500).json({ 
            error: error.message,
            detail: error.detail 
        });
    }
}
```

---

### Step 6: Test Everything

#### 6.1 Test Authentication
```bash
node test-auth.js
```

Expected output:
```
✅ API Key Authentication Working!
```

#### 6.2 Test OAuth Flow
1. Clear browser cookies
2. Navigate to `http://localhost:3000/?documentId=test123`
3. Complete OAuth login
4. Verify URL still has `?documentId=test123`

See `test-oauth-flow.md` for detailed testing instructions.

#### 6.3 Test BTM Sketch Creation
```bash
node test-btm-sketch.js --testMode simple-circle
```

Expected output:
```
✅ SUCCESS! Sketch created successfully
```

---

### Step 7: Environment Variables

Update your `.env` file to include:

```bash
# Onshape API Keys (for server-side operations)
ONSHAPE_ACCESS_KEY=your_access_key
ONSHAPE_SECRET_KEY=your_secret_key

# OAuth Credentials (for user authentication)
OAUTH_CLIENT_ID=your_oauth_client_id
OAUTH_CLIENT_SECRET=your_oauth_client_secret
OAUTH_CALLBACK_URL=http://localhost:3000/oauthRedirect

# Session
SESSION_SECRET=your_random_session_secret

# API URLs
API_URL=https://cad.onshape.com
OAUTH_URL=https://oauth.onshape.com

# Port
PORT=3000

# Debug (optional)
DEBUG_AUTH=true  # Enable auth debug logging
```

---

## Troubleshooting

### Issue: 401 Unauthorized with API Keys

**Check:**
1. Are keys correct in `.env`?
2. Run `node test-auth.js` to verify signature
3. Compare signature string format with Python debugger
4. Ensure all components are lowercase
5. Ensure signature string ends with `\n`

**Debug:**
```javascript
// In _createApiKeyHeaders, add:
console.log('Signature string:', JSON.stringify(signatureString));
```

### Issue: Parameters Lost in OAuth Flow

**Check:**
1. Session is saving before redirect (`req.session.save()` callback)
2. Parameters aren't the string "undefined"
3. Session secret is set in `.env`
4. Session middleware is configured correctly

**Debug:**
```javascript
// Add logging in OAuth routes:
console.log('Session before save:', req.session);
console.log('Session after redirect:', req.session);
```

### Issue: BTM Sketch Creation Fails

**Check:**
1. Authentication working (`node test-auth.js`)
2. Plane ID is correct format
3. Entity coordinates are in meters (not pixels)
4. BTM structure matches Onshape expectations

**Debug:**
```javascript
// Log the payload before sending:
console.log('BTM Payload:', JSON.stringify(featurePayload, null, 2));
```

---

## Rollback Plan

If something breaks:

```bash
# Rollback to backup
git checkout backup-before-auth-fixes

# Copy specific files
git checkout backup-before-auth-fixes -- services/onshape-api.js
git checkout backup-before-auth-fixes -- node.js
```

---

## Success Checklist

- [ ] `node test-auth.js` passes
- [ ] OAuth flow preserves parameters
- [ ] No "undefined" strings in URLs
- [ ] BTM sketch creation works
- [ ] Frontend loads correct document from URL
- [ ] No errors in server logs
- [ ] No errors in browser console

---

## Next Steps After Integration

1. **Test with real SVG files**
   ```bash
   node test-btm-sketch.js --svg test.svg
   ```

2. **Test web UI end-to-end**
   - Upload SVG
   - Select plane
   - Create sketch
   - Verify in Onshape

3. **Deploy to production**
   - Update environment variables
   - Test OAuth callback URL
   - Monitor logs for errors

4. **Monitor and iterate**
   - Watch for auth failures
   - Track successful sketch creations
   - Gather user feedback

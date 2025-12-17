# BTM Sketch Creation - Complete Fix Plan

## Problem 1: API Key Authentication (401 Errors)

### Root Cause
The Node.js HMAC signature implementation doesn't match Onshape's expected format. The Python API debugger works because it uses the exact format Onshape expects.

### Critical Signature Requirements

Based on Onshape API documentation, the signature string must:

1. **Be lowercase** - ALL components (method, nonce, date, content-type, path)
2. **End with newline** - The signature string must end with `\n`
3. **Use correct path** - Must include `/api/v6/` prefix for v6 endpoints
4. **Empty query string** - Must be empty string, not omitted
5. **UTF-8 encoding** - Signature creation must use UTF-8 throughout

### Fix for API Key Authentication

```javascript
// services/onshape-api.js - createSketchFromBTM method

async createSketchFromBTM({ documentId, workspaceId, elementId, planeId, entities, accessToken, apiKey, options = {} }) {
    try {
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

        const endpoint = `/api/v6/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`;
        const body = JSON.stringify(featurePayload);

        let headers;
        if (apiKey) {
            // API Key authentication
            headers = this._createApiKeyHeaders('POST', endpoint, body, apiKey.accessKey, apiKey.secretKey);
        } else if (accessToken) {
            // OAuth token authentication
            headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
        } else {
            throw new Error('No authentication provided');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetail;
            try {
                errorDetail = JSON.parse(errorText);
            } catch (e) {
                errorDetail = errorText;
            }
            throw new Error(`API Error ${response.status}: ${JSON.stringify(errorDetail)}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Create sketch error:', error);
        throw error;
    }
}

_createApiKeyHeaders(method, path, body, accessKey, secretKey) {
    const crypto = require('crypto');
    
    // Generate nonce and date
    const nonce = crypto.randomBytes(16).toString('hex');
    const date = new Date().toUTCString(); // RFC 2822 format
    
    // CRITICAL: All components must be lowercase
    // Format: METHOD\nNONCE\nDATE\nCONTENT-TYPE\nPATH\nQUERY\n
    const signatureString = [
        method.toLowerCase(),           // "post"
        nonce.toLowerCase(),            // "abc123..."
        date.toLowerCase(),             // "mon, 16 dec 2024..."
        'application/json',             // Already lowercase
        path.toLowerCase(),             // "/api/v6/partstudios/d/..."
        ''                              // Empty query string
    ].join('\n') + '\n';                // MUST end with newline
    
    console.log('Signature string:', JSON.stringify(signatureString));
    
    // Create HMAC signature using UTF-8 encoding
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(signatureString, 'utf8');
    const signature = hmac.digest('base64');
    
    // Create authorization header
    const authString = `On ${accessKey}:HmacSHA256:${signature}`;
    
    return {
        'Authorization': authString,
        'Date': date,                    // Original case for Date header
        'On-Nonce': nonce,              // Original case for nonce
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

_getPlaneId(planeId) {
    // Convert plane reference to deterministic ID
    if (planeId.includes('_XY') || planeId === 'TOP' || planeId === 'Front') return 'JDC';
    if (planeId.includes('_YZ') || planeId === 'FRONT') return 'JCC';
    if (planeId.includes('_XZ') || planeId === 'RIGHT' || planeId === 'Right') return 'JGC';
    
    // For custom planes, assume planeId is already a deterministic ID
    // or extract it from a format like "F4NrQBXyYct6nDV_Plane1"
    if (planeId.includes('_')) {
        return planeId.split('_')[0];
    }
    
    return planeId;
}
```

### Test Authentication First

Create a simple auth test script:

```javascript
// test-auth.js
import dotenv from 'dotenv';
dotenv.config();
import crypto from 'crypto';
import fetch from 'node-fetch';

async function testApiKeyAuth() {
    const accessKey = process.env.ONSHAPE_ACCESS_KEY;
    const secretKey = process.env.ONSHAPE_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
        console.error('Missing ONSHAPE_ACCESS_KEY or ONSHAPE_SECRET_KEY');
        process.exit(1);
    }
    
    const method = 'GET';
    const path = '/api/users/sessioninfo';
    const nonce = crypto.randomBytes(16).toString('hex');
    const date = new Date().toUTCString();
    
    // Create signature string - ALL LOWERCASE
    const signatureString = [
        method.toLowerCase(),
        nonce.toLowerCase(),
        date.toLowerCase(),
        'application/json',
        path.toLowerCase(),
        ''
    ].join('\n') + '\n';
    
    console.log('Signature string (showing escapes):');
    console.log(JSON.stringify(signatureString));
    
    // Create signature
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(signatureString, 'utf8');
    const signature = hmac.digest('base64');
    
    const authString = `On ${accessKey}:HmacSHA256:${signature}`;
    
    console.log('\nMaking request to:', `https://cad.onshape.com${path}`);
    console.log('Auth header:', authString.substring(0, 30) + '...');
    
    const response = await fetch(`https://cad.onshape.com${path}`, {
        method: method,
        headers: {
            'Authorization': authString,
            'Date': date,
            'On-Nonce': nonce,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });
    
    console.log('\nResponse status:', response.status);
    
    if (response.ok) {
        const data = await response.json();
        console.log('✅ Authentication successful!');
        console.log('User:', data.name || data.email);
        return true;
    } else {
        const errorText = await response.text();
        console.error('❌ Authentication failed');
        console.error('Response:', errorText);
        return false;
    }
}

testApiKeyAuth().then(success => {
    process.exit(success ? 0 : 1);
});
```

Run this first:
```bash
node test-auth.js
```

---

## Problem 2: OAuth Parameter Preservation

### Root Cause
Parameters are being lost or converted to literal "undefined" strings during the OAuth flow because:
1. Session data isn't being saved before redirect
2. Parameters aren't being properly validated before use
3. URL construction uses undefined values directly

### Fix for OAuth Flow

```javascript
// node.js (server) - OAuth routes

app.get('/oauthSignin', (req, res, next) => {
    console.log('OAuth signin - incoming params:', {
        documentId: req.query.documentId,
        workspaceId: req.query.workspaceId,
        elementId: req.query.elementId
    });
    
    const state = uuidv4();
    
    // Only save params if they're actually defined and not the string "undefined"
    const params = {};
    if (req.query.documentId && req.query.documentId !== 'undefined') {
        params.documentId = req.query.documentId;
    }
    if (req.query.workspaceId && req.query.workspaceId !== 'undefined') {
        params.workspaceId = req.query.workspaceId;
    }
    if (req.query.elementId && req.query.elementId !== 'undefined') {
        params.elementId = req.query.elementId;
    }
    
    // Add state to params
    params.state = state;
    
    console.log('Saving to session:', params);
    
    req.session.extraData = params;
    req.session.oauthState = state;

    // CRITICAL: Wait for session to save before redirecting
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.redirect('/?error=session_error');
        }
        
        console.log('Session saved, proceeding with OAuth');
        
        passport.authenticate('onshape', {
            scope: 'OAuth2ReadPII OAuth2Read OAuth2Write',
            state: state
        })(req, res, next);
    });
});

app.get('/oauthRedirect', (req, res, next) => {
    console.log('OAuth redirect - session data:', req.session.extraData);
    
    const savedState = req.session.oauthState;
    const savedParams = req.session.extraData || {};

    passport.authenticate('onshape', (err, user) => {
        if (err || !user) {
            console.error('OAuth authentication failed:', err);
            return res.redirect('/?error=auth_failed');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.redirect('/?error=login_failed');
            }

            // Build redirect URL with validated parameters
            let redirectUrl = '/';
            const validParams = [];
            
            // Only add params if they exist and aren't "undefined"
            if (savedParams.documentId && savedParams.documentId !== 'undefined') {
                validParams.push(`documentId=${encodeURIComponent(savedParams.documentId)}`);
            }
            if (savedParams.workspaceId && savedParams.workspaceId !== 'undefined') {
                validParams.push(`workspaceId=${encodeURIComponent(savedParams.workspaceId)}`);
            }
            if (savedParams.elementId && savedParams.elementId !== 'undefined') {
                validParams.push(`elementId=${encodeURIComponent(savedParams.elementId)}`);
            }
            
            if (validParams.length > 0) {
                redirectUrl += '?' + validParams.join('&');
            }
            
            console.log('Redirecting to:', redirectUrl);
            res.redirect(redirectUrl);
        });
    })(req, res, next);
});
```

### Fix for Frontend Parameter Handling

```javascript
// public/js/main.js or wherever you handle URL parameters

function getUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    // Extract parameters, filtering out "undefined" strings
    const documentId = params.get('documentId');
    const workspaceId = params.get('workspaceId');
    const elementId = params.get('elementId');
    
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

// Update initialization to handle missing parameters gracefully
async function initializeApp() {
    const urlParams = getUrlParameters();
    
    // Check if user is authenticated
    const authResponse = await fetch('/api/auth/status', {
        credentials: 'include'
    });
    
    if (!authResponse.ok) {
        console.log('Not authenticated, redirecting to login');
        // Build OAuth URL with available parameters
        const oauthParams = new URLSearchParams();
        if (urlParams.documentId) oauthParams.append('documentId', urlParams.documentId);
        if (urlParams.workspaceId) oauthParams.append('workspaceId', urlParams.workspaceId);
        if (urlParams.elementId) oauthParams.append('elementId', urlParams.elementId);
        
        const oauthUrl = `/oauthSignin${oauthParams.toString() ? '?' + oauthParams.toString() : ''}`;
        window.location.href = oauthUrl;
        return;
    }
    
    const authData = await authResponse.json();
    console.log('Authenticated as:', authData.email);
    
    // Load documents first
    await loadDocuments();
    
    // If we have URL parameters, try to use them
    if (urlParams.documentId) {
        console.log('Using documentId from URL:', urlParams.documentId);
        
        // Validate that this document exists in user's list
        const doc = documents.find(d => d.id === urlParams.documentId);
        if (doc) {
            currentDocumentId = urlParams.documentId;
            
            if (urlParams.workspaceId) {
                currentWorkspaceId = urlParams.workspaceId;
            }
            if (urlParams.elementId) {
                currentElementId = urlParams.elementId;
            }
            
            // Load workspaces/elements
            await loadWorkspaces(currentDocumentId);
        } else {
            console.warn('Document from URL not found in user documents, loading defaults');
            await loadDefaultDocument();
        }
    } else {
        // No URL parameters, load default document
        await loadDefaultDocument();
    }
}

async function loadDefaultDocument() {
    // Find "SVG to Sketch App" document or use first available
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

## Integration Testing Script

Once both fixes are in place, test the complete flow:

```javascript
// test-complete-flow.js
import dotenv from 'dotenv';
dotenv.config();

async function testCompleteFlow() {
    console.log('🧪 Testing Complete BTM Sketch Creation Flow\n');
    
    // Step 1: Test API Key Authentication
    console.log('Step 1: Testing API Key Authentication...');
    const authTest = await import('./test-auth.js');
    const authSuccess = await authTest.testApiKeyAuth();
    
    if (!authSuccess) {
        console.error('❌ Authentication failed - fix this first');
        return false;
    }
    
    console.log('✅ Authentication working\n');
    
    // Step 2: Test BTM Sketch Creation with simple-circle
    console.log('Step 2: Testing BTM Sketch Creation (simple-circle mode)...');
    process.env.TEST_MODE = 'simple-circle';
    process.env.ONSHAPE_DOCUMENT_ID = 'your-doc-id';
    process.env.ONSHAPE_WORKSPACE_ID = 'your-workspace-id';
    process.env.ONSHAPE_ELEMENT_ID = 'your-element-id';
    process.env.ONSHAPE_PLANE_ID = 'JDC'; // Front plane
    
    const btmTest = await import('./test-btm-sketch.js');
    // Run the test...
    
    console.log('\n✅ Complete flow working!');
    return true;
}

testCompleteFlow();
```

---

## Debugging Checklist

### API Key Auth
- [ ] Signature string ends with `\n`
- [ ] All components are lowercase
- [ ] Using UTF-8 encoding throughout
- [ ] Authorization header format: `On ${accessKey}:HmacSHA256:${signature}`
- [ ] Date header in RFC 2822 format
- [ ] Path includes `/api/v6/` prefix

### OAuth Flow
- [ ] Session saved before redirect
- [ ] Parameters validated (not "undefined" string)
- [ ] URL encoding applied
- [ ] Frontend filters out invalid parameters
- [ ] Default document loads if parameters invalid

### BTM Payload
- [ ] Correct btType values
- [ ] Deterministic plane ID correct
- [ ] Entities array well-formed
- [ ] Entity coordinates in meters (scale applied)

---

## Next Steps

1. **Fix authentication first**
   ```bash
   node test-auth.js
   ```
   This must work before anything else.

2. **Test OAuth flow**
   - Clear cookies/session
   - Try login flow
   - Check that parameters persist

3. **Test BTM creation**
   ```bash
   node test-btm-sketch.js --testMode simple-circle
   ```

4. **If still having issues**
   - Enable detailed logging in both fixes
   - Compare signature string byte-by-byte with Python debugger
   - Check network tab for actual request/response

Let me know which step fails and I'll help debug further!

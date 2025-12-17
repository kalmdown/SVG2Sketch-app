# Testing OAuth Parameter Preservation

Since OAuth flow testing requires a browser and real OAuth interaction, this document provides manual testing instructions.

## Prerequisites

1. Your server must be running
2. OAuth credentials must be configured in `.env`:
   - `OAUTH_CLIENT_ID`
   - `OAUTH_CLIENT_SECRET`
   - `OAUTH_CALLBACK_URL`
   - `SESSION_SECRET`

## Test Procedure

### Test 1: OAuth Flow Without Parameters

**Purpose:** Verify basic OAuth flow works

1. **Clear browser cookies/storage**
   - In browser DevTools: Application > Clear site data

2. **Navigate to your app**
   ```
   http://localhost:3000/
   ```

3. **Expected behavior:**
   - Redirected to `/oauthSignin`
   - Then to Onshape OAuth page
   - After login, redirected back to `/oauthRedirect`
   - Finally redirected to `/` (homepage)
   - Check browser console for logs:
     ```
     === OAuth Signin Started ===
     Incoming query params: {}
     Sanitized params to save: { state: '...' }
     Session saved successfully
     ```

4. **Verify:**
   - [ ] No errors in browser console
   - [ ] No errors in server terminal
   - [ ] You are logged in (check `/api/auth/status`)

---

### Test 2: OAuth Flow With Valid Parameters

**Purpose:** Verify parameters are preserved through OAuth flow

1. **Clear browser cookies/storage**

2. **Navigate with parameters**
   ```
   http://localhost:3000/?documentId=abc123&workspaceId=def456&elementId=ghi789
   ```

3. **Expected behavior:**
   - Redirected to `/oauthSignin?documentId=abc123&workspaceId=def456&elementId=ghi789`
   - Parameters saved to session
   - OAuth flow completes
   - Redirected back to `/?documentId=abc123&workspaceId=def456&elementId=ghi789`

4. **Check server logs:**
   ```
   === OAuth Signin Started ===
   Incoming query params: {
     documentId: 'abc123',
     workspaceId: 'def456',
     elementId: 'ghi789'
   }
   Sanitized params to save: {
     documentId: 'abc123',
     workspaceId: 'def456',
     elementId: 'ghi789',
     state: '...'
   }
   Session saved successfully
   ---
   === OAuth Redirect Received ===
   Retrieved saved params: {
     documentId: 'abc123',
     workspaceId: 'def456',
     elementId: 'ghi789',
     state: '...'
   }
   Login successful for user: your-email@example.com
   Redirecting to: /?documentId=abc123&workspaceId=def456&elementId=ghi789
   === OAuth Flow Complete ===
   ```

5. **Verify:**
   - [ ] URL after redirect contains all parameters
   - [ ] No "undefined" strings in URL
   - [ ] Parameters are valid document IDs

---

### Test 3: OAuth Flow With Invalid Parameters

**Purpose:** Verify invalid parameters are filtered out

1. **Clear browser cookies/storage**

2. **Navigate with invalid parameters**
   ```
   http://localhost:3000/?documentId=undefined&workspaceId=null&elementId=
   ```

3. **Expected behavior:**
   - Invalid parameters filtered out during OAuth flow
   - Redirected back to `/` with no parameters

4. **Check server logs:**
   ```
   === OAuth Signin Started ===
   Incoming query params: {
     documentId: 'undefined',
     workspaceId: 'null',
     elementId: ''
   }
   Sanitized params to save: { state: '...' }
   ---
   === OAuth Redirect Received ===
   Retrieved saved params: { state: '...' }
   Redirecting to: /
   ```

5. **Verify:**
   - [ ] URL after redirect has no invalid parameters
   - [ ] No "undefined" or "null" strings in URL
   - [ ] App defaults to loading default document

---

### Test 4: OAuth Flow With Mixed Parameters

**Purpose:** Verify only valid parameters are preserved

1. **Clear browser cookies/storage**

2. **Navigate with mixed parameters**
   ```
   http://localhost:3000/?documentId=abc123&workspaceId=undefined&elementId=ghi789
   ```

3. **Expected behavior:**
   - Only `documentId` and `elementId` preserved
   - `workspaceId` filtered out

4. **Check final URL:**
   ```
   http://localhost:3000/?documentId=abc123&elementId=ghi789
   ```

5. **Verify:**
   - [ ] Only valid parameters in final URL
   - [ ] Invalid parameters removed
   - [ ] App can load document with available parameters

---

## Common Issues and Solutions

### Issue: Session data lost

**Symptoms:**
- Parameters not preserved after OAuth
- Server logs show empty saved params

**Solutions:**
1. Check session middleware is configured:
   ```javascript
   app.use(session({
       secret: process.env.SESSION_SECRET,
       resave: true,
       saveUninitialized: true,
       cookie: {
           secure: process.env.NODE_ENV === 'production',
           maxAge: 24 * 60 * 60 * 1000
       }
   }));
   ```

2. Ensure session is saved before OAuth redirect:
   ```javascript
   req.session.save((err) => {
       if (err) return res.redirect('/?error=session_error');
       passport.authenticate('onshape', { ... })(req, res, next);
   });
   ```

3. Check `SESSION_SECRET` is set in `.env`

### Issue: Parameters become "undefined" strings

**Symptoms:**
- URL shows `?documentId=undefined`
- Frontend receives literal "undefined" string

**Solutions:**
1. Use sanitization function:
   ```javascript
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
   ```

2. Filter on frontend too:
   ```javascript
   function getUrlParameters() {
       const params = new URLSearchParams(window.location.search);
       const result = {};
       
       const documentId = params.get('documentId');
       if (documentId && documentId !== 'undefined' && documentId !== 'null') {
           result.documentId = documentId;
       }
       // ... repeat for other params
       
       return result;
   }
   ```

### Issue: CORS errors during OAuth

**Symptoms:**
- OAuth redirect fails with CORS error
- Network tab shows preflight failures

**Solutions:**
1. Ensure CORS is configured for OAuth domains:
   ```javascript
   app.use(cors({
       origin: ['https://cad.onshape.com', 'https://oauth.onshape.com'],
       credentials: true
   }));
   ```

2. Check callback URL matches exactly in OAuth app settings

---

## Debugging Tips

### Enable Detailed Logging

In your server file:
```javascript
// Before session middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    next();
});
```

### Check Session Persistence

```javascript
app.get('/debug/session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        authenticated: req.isAuthenticated(),
        user: req.user
    });
});
```

Navigate to `/debug/session` to see current session state.

### Browser Console Checks

```javascript
// Check current URL parameters
console.log(window.location.search);

// Check parsed parameters
const params = new URLSearchParams(window.location.search);
console.log('documentId:', params.get('documentId'));
console.log('workspaceId:', params.get('workspaceId'));
console.log('elementId:', params.get('elementId'));
```

---

## Success Criteria

OAuth flow is working correctly when:

✅ Parameters are preserved through entire OAuth flow
✅ Invalid parameters ("undefined", "null", empty) are filtered out  
✅ Final URL contains only valid parameters
✅ App can load correct document/workspace/element from parameters
✅ No "undefined" strings appear in URLs or console
✅ Session data persists across OAuth redirect
✅ No errors in server logs or browser console

---

## Next Steps

Once OAuth flow is working:
1. Test BTM sketch creation (run `node test-btm-sketch.js`)
2. Test complete end-to-end SVG upload flow
3. Deploy to production environment

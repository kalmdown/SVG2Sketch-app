# 🚀 Quick Start: Fixing Your BTM Sketch Creation

Based on your 112K-line debugging session, I've identified and fixed **both critical issues** blocking your SVG to Sketch tool.

---

## 📋 What I've Created For You

### 1. **INTEGRATION-GUIDE.md** ⭐ START HERE
Complete step-by-step guide to integrate all fixes into your codebase. Includes:
- Where to put each fix
- How to test each component
- Troubleshooting tips
- Rollback plan

### 2. **btm-sketch-fixes.md**
Detailed technical analysis of both problems:
- API Key Authentication (401 errors)
- OAuth Parameter Preservation ("undefined" strings)
- Root causes and solutions

### 3. **onshape-api-fixed.js**
Drop-in replacement for `services/onshape-api.js` with:
- ✅ Correct HMAC signature (lowercase, trailing \n)
- ✅ Support for both API keys and OAuth tokens
- ✅ Proper error handling

### 4. **oauth-fixed.js**
Drop-in OAuth routes with:
- ✅ Parameter sanitization
- ✅ Session persistence before redirect
- ✅ Filters out "undefined" strings

### 5. **test-auth.js**
Test script to verify API key authentication works:
```bash
node test-auth.js
```

### 6. **test-oauth-flow.md**
Manual testing guide for OAuth flow with step-by-step verification.

---

## 🎯 The Two Main Fixes

### Fix #1: API Key Authentication

**Problem:** 401 errors due to incorrect HMAC signature format

**Solution:** All signature components must be:
- Lowercase
- Separated by `\n`
- End with final `\n`

**Key Code:**
```javascript
const signatureString = [
    method.toLowerCase(),      // "post"
    nonce.toLowerCase(),       // hex nonce
    date.toLowerCase(),        // rfc 2822 date
    'application/json',
    path.toLowerCase(),        // "/api/v6/..."
    ''                         // empty query
].join('\n') + '\n';           // MUST END WITH \n
```

### Fix #2: OAuth Parameter Preservation

**Problem:** Parameters becoming literal "undefined" strings or being lost entirely

**Solution:** Sanitize parameters and ensure session saves before redirect

**Key Code:**
```javascript
function sanitizeParams(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
        if (!value || value === 'undefined' || value === 'null') {
            continue;  // Skip invalid values
        }
        sanitized[key] = value;
    }
    return sanitized;
}

// In OAuth route:
req.session.save((err) => {
    if (err) return res.redirect('/?error=session_error');
    // Now do OAuth redirect
});
```

---

## 🏁 Quick Start (5 Minutes)

### Step 1: Test Current Authentication (2 min)
```bash
# Add to .env:
ONSHAPE_ACCESS_KEY=your_key
ONSHAPE_SECRET_KEY=your_secret

# Run test:
node test-auth.js
```

**Expected:** ✅ Authentication successful

### Step 2: Update API Service (1 min)
```bash
# Backup current file:
cp services/onshape-api.js services/onshape-api.backup.js

# Copy fixed version:
cp onshape-api-fixed.js services/onshape-api.js
```

### Step 3: Update OAuth Routes (1 min)
Follow the instructions in **INTEGRATION-GUIDE.md** Section 3.

### Step 4: Test Again (1 min)
```bash
# Should now work:
node test-auth.js
```

### Step 5: Test Complete Flow
Follow **test-oauth-flow.md** for manual OAuth testing.

---

## ⚠️ Critical Points

### API Authentication
- ✅ Signature string MUST end with `\n`
- ✅ All components MUST be lowercase
- ✅ Use UTF-8 encoding throughout
- ✅ Date format is RFC 2822
- ✅ Authorization: `On ${accessKey}:HmacSHA256:${signature}`

### OAuth Flow
- ✅ Call `req.session.save()` BEFORE redirecting
- ✅ Filter out "undefined" and "null" strings
- ✅ Validate parameters before using them
- ✅ Handle missing parameters gracefully

---

## 📊 Success Criteria

Your fixes are working when:

**Authentication:**
- [ ] `node test-auth.js` returns 200 OK
- [ ] User info is retrieved successfully
- [ ] No 401 errors in logs

**OAuth Flow:**
- [ ] Parameters persist through OAuth redirect
- [ ] No "undefined" strings in URLs
- [ ] Session data is preserved
- [ ] App loads correct document from URL params

**BTM Sketch:**
- [ ] Sketch creates successfully
- [ ] No 400/401 errors
- [ ] Sketch appears in Onshape

---

## 🐛 If Something Breaks

1. **Rollback:**
   ```bash
   cp services/onshape-api.backup.js services/onshape-api.js
   ```

2. **Check logs:**
   - Server terminal output
   - Browser console
   - Network tab (especially 401/400 responses)

3. **Compare signatures:**
   - Run `test-auth.js` with `DEBUG_AUTH=true`
   - Compare with Python API debugger output
   - Check each component is lowercase

4. **Session issues:**
   - Verify SESSION_SECRET is set
   - Check session middleware configuration
   - Enable debug logging in OAuth routes

---

## 📚 Recommended Reading Order

1. **INTEGRATION-GUIDE.md** - How to implement everything
2. **test-auth.js** - Run this first to verify auth works
3. **btm-sketch-fixes.md** - Deep dive into technical details
4. **test-oauth-flow.md** - Manual OAuth testing instructions

---

## 💡 What's Next

Once both fixes are working:

1. ✅ Test with simple-circle mode
2. ✅ Test with real SVG files
3. ✅ Test web UI end-to-end
4. ✅ Deploy to production

---

## 🤝 Need Help?

If you hit issues:

1. Run `node test-auth.js` and share the output
2. Check what error code you're getting (401, 400, 500)
3. Enable debug logging: `DEBUG_AUTH=true node test-auth.js`
4. Look at the "Troubleshooting" section in INTEGRATION-GUIDE.md

The most common issue is the signature format - make sure ALL components are lowercase and the string ends with `\n`.

---

**Good luck! These fixes address the exact issues from your debugging session. The authentication signature format and OAuth parameter handling should now work correctly.** 🎉

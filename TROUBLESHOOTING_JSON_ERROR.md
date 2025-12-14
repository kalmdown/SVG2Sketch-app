# Troubleshooting "Error processing json"

## Common Causes

The "Error processing json" error from Onshape typically means the API request structure doesn't match what Onshape expects. Here are the most common causes:

### 1. **Wrong featureType ID** (Most Common)

The `featureType` must match **exactly** what's in your Onshape installation, including the unique ID.

**Symptoms:**
- Error: "Error processing json"
- Feature works when added directly in Onshape UI
- App fails when calling via API

**Solution:**
1. Find your exact `featureType` ID (see [FIND_FEATURE_TYPE_ID.md](./FIND_FEATURE_TYPE_ID.md))
2. Add to `.env`:
   ```env
   ONSHAPE_FEATURE_TYPE_ID_V47=SVG to Sketch 47::e7a355754e359de9fbe54de5
   ```
   (Replace with your actual ID)

3. Restart the server

**How to verify:**
- Check server logs - they now show the `featureType` being used
- Look for: `Creating feature with definition: { featureType: '...' }`

### 2. **Parameter Structure Mismatch**

The parameters sent to FeatureScript must match the parameter IDs defined in the FeatureScript.

**Check FeatureScript v47 parameters:**
- `inputText` (TextData)
- `sketchPlane` (Query)
- `scale` (Real)
- `debugMode` (boolean)
- `useIntermediateFormat` (boolean)

**Verify in code:**
The app sends these parameters in `services/onshape-api.js` around line 337-367. Make sure they match your FeatureScript.

### 3. **Invalid planeId Format**

The `planeId` must be a valid Onshape deterministic ID.

**Common issues:**
- Using element ID instead of plane ID
- Using plane name instead of ID
- ID format is wrong

**Solution:**
- Check that the plane selector is working correctly
- Verify the plane ID format in server logs
- Default planes use format: `${elementId}_XY`, `${elementId}_YZ`, `${elementId}_XZ`

### 4. **Intermediate Format Content Issues**

The IF content might be malformed or too large.

**Check:**
- Server logs show `ifLength: ...`
- IF content should start with `# Intermediate Format for SVG to Sketch v47`
- Very large IF content might cause issues

## Debugging Steps

### Step 1: Check Server Logs

The improved error handling now shows:
- Exact error message from Onshape
- FeatureType being used
- Parameter structure
- Plane ID

Look for lines like:
```
Creating feature with definition: {
  featureType: 'SVG to Sketch 47::...',
  parameterCount: 5,
  parameterIds: ['inputText', 'sketchPlane', 'scale', 'debugMode', 'useIntermediateFormat'],
  ifLength: 1234,
  planeId: '...'
}
```

### Step 2: Verify FeatureType ID

1. **Check `.env` file** has `ONSHAPE_FEATURE_TYPE_ID_V47` set
2. **Check server logs** show the correct featureType
3. **Compare with Onshape** - the ID should match what you see when adding the feature directly

### Step 3: Test Feature Directly in Onshape

1. Add the feature directly: **Insert → Feature → SVG to Sketch 47**
2. If it works directly but not via API, it's likely a `featureType` ID issue

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Convert an SVG via the app
3. Look for POST to `/api/partstudios/.../features`
4. Check the **Response** tab for detailed error message

### Step 5: Verify Parameter Structure

Check that the app is sending:
```json
{
  "btType": "BTFeatureDefinitionCall-1406",
  "feature": {
    "btType": "BTMFeature-134",
    "featureType": "SVG to Sketch 47::...",
    "parameters": [
      {
        "btType": "BTMParameterString-149",
        "parameterId": "inputText",
        "value": "# Intermediate Format..."
      },
      {
        "btType": "BTMParameterQueryList-148",
        "parameterId": "sketchPlane",
        "queries": [...]
      },
      ...
    ]
  }
}
```

## Quick Fix Checklist

- [ ] `.env` has `ONSHAPE_FEATURE_TYPE_ID_V47` set correctly
- [ ] Server restarted after updating `.env`
- [ ] FeatureScript v47 is saved and activated in Onshape
- [ ] Feature works when added directly in Onshape UI
- [ ] Plane selector is working (plane ID is valid)
- [ ] Server logs show correct featureType
- [ ] Network tab shows detailed error message

## Getting More Help

If the error persists:

1. **Check server console** for detailed error logs
2. **Check browser console** for client-side errors
3. **Check Network tab** for the actual API response
4. **Share the error details** from server logs (they now include more context)

The improved error handling should now show:
- The exact Onshape error message
- Which featureType was used
- Parameter structure details
- More context about what might be wrong

